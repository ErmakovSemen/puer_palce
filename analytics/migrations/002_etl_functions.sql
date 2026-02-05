-- ============================================
-- Analytics System - ETL Functions
-- ============================================
--
-- SQL функции для обработки сырых событий и формирования
-- аналитических таблиц внутри PostgreSQL
--

-- ============================================
-- ФУНКЦИЯ 1: Обработка сессий из raw_events
-- ============================================

CREATE OR REPLACE FUNCTION process_sessions()
RETURNS TABLE(processed_count INTEGER) AS $$
DECLARE
  v_processed_count INTEGER := 0;
  v_run_id INTEGER;
BEGIN
  -- Логируем начало ETL
  INSERT INTO etl_runs (job_name, status)
  VALUES ('process_sessions', 'running')
  RETURNING id INTO v_run_id;

  -- Обновляем существующие сессии и вставляем новые
  WITH session_stats AS (
    SELECT 
      session_id,
      MIN(user_id) AS user_id,  -- Берём первый user_id (может меняться при авторизации)
      MIN(event_time) AS first_event_time,
      MAX(event_time) AS last_event_time,
      EXTRACT(EPOCH FROM (MAX(event_time) - MIN(event_time)))::INTEGER AS session_length_sec,
      COUNT(*) AS events_count,
      MIN(page) FILTER (WHERE event_name = 'page_view') AS landing_page,
      MAX(page) FILTER (WHERE event_name = 'page_view') AS exit_page,
      MIN(experiment_key) AS experiment_key,
      MIN(experiment_variant) AS experiment_variant,
      COUNT(*) FILTER (WHERE event_name = 'page_view') AS page_views_count,
      COUNT(*) FILTER (WHERE event_name = 'add_to_cart') AS add_to_cart_count,
      BOOL_OR(event_name = 'checkout_started') AS checkout_started,
      BOOL_OR(event_name = 'order_completed') AS order_completed,
      MIN(properties->>'device_type') AS device_type,
      MIN(properties->>'referrer') AS referrer
    FROM raw_events
    WHERE session_id IS NOT NULL
      AND event_time > COALESCE(
        (SELECT MAX(last_event_time) FROM sessions), 
        NOW() - INTERVAL '7 days'  -- Первый запуск: берём последние 7 дней
      )
    GROUP BY session_id
  )
  INSERT INTO sessions (
    session_id, user_id, first_event_time, last_event_time, 
    session_length_sec, events_count, landing_page, exit_page,
    experiment_key, experiment_variant,
    page_views_count, add_to_cart_count, checkout_started, order_completed,
    device_type, referrer, updated_at
  )
  SELECT 
    session_id, user_id, first_event_time, last_event_time,
    session_length_sec, events_count, landing_page, exit_page,
    experiment_key, experiment_variant,
    page_views_count, add_to_cart_count, checkout_started, order_completed,
    device_type, referrer, NOW()
  FROM session_stats
  ON CONFLICT (session_id) DO UPDATE SET
    user_id = COALESCE(EXCLUDED.user_id, sessions.user_id),
    last_event_time = EXCLUDED.last_event_time,
    session_length_sec = EXCLUDED.session_length_sec,
    events_count = EXCLUDED.events_count,
    exit_page = EXCLUDED.exit_page,
    page_views_count = EXCLUDED.page_views_count,
    add_to_cart_count = EXCLUDED.add_to_cart_count,
    checkout_started = sessions.checkout_started OR EXCLUDED.checkout_started,
    order_completed = sessions.order_completed OR EXCLUDED.order_completed,
    updated_at = NOW();

  GET DIAGNOSTICS v_processed_count = ROW_COUNT;

  -- Логируем успешное завершение
  UPDATE etl_runs 
  SET 
    end_time = NOW(),
    status = 'success',
    rows_processed = v_processed_count
  WHERE id = v_run_id;

  RETURN QUERY SELECT v_processed_count;

EXCEPTION WHEN OTHERS THEN
  -- Логируем ошибку
  UPDATE etl_runs 
  SET 
    end_time = NOW(),
    status = 'failed',
    error_message = SQLERRM
  WHERE id = v_run_id;
  
  RAISE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_sessions IS 'Инкрементально обновляет таблицу sessions из raw_events';


-- ============================================
-- ФУНКЦИЯ 2: Очистка и обогащение событий
-- ============================================

CREATE OR REPLACE FUNCTION process_events_clean()
RETURNS TABLE(processed_count INTEGER) AS $$
DECLARE
  v_processed_count INTEGER := 0;
  v_run_id INTEGER;
  v_last_processed_id BIGINT;
BEGIN
  -- Логируем начало ETL
  INSERT INTO etl_runs (job_name, status)
  VALUES ('process_events_clean', 'running')
  RETURNING id INTO v_run_id;

  -- Получаем ID последнего обработанного события
  SELECT COALESCE(MAX(id), 0) INTO v_last_processed_id FROM events_clean;

  -- Вставляем новые очищенные события с обогащением
  INSERT INTO events_clean (
    event_time, user_id, session_id, event_name, source, page,
    experiment_key, experiment_variant,
    user_name, user_loyalty_level,
    product_id, product_name, order_id, order_total,
    properties, processed_at
  )
  SELECT DISTINCT ON (re.request_id, re.event_time, re.event_name)  -- Дедупликация
    re.event_time,
    re.user_id,
    re.session_id,
    re.event_name,
    re.source,
    re.page,
    re.experiment_key,
    re.experiment_variant,
    -- Обогащение данными пользователя
    u.name AS user_name,
    CASE 
      WHEN u.xp >= 15000 THEN 4
      WHEN u.xp >= 7000 THEN 3
      WHEN u.xp >= 3000 THEN 2
      ELSE 1
    END AS user_loyalty_level,
    -- Извлечение популярных полей из JSONB
    (re.properties->>'product_id')::INTEGER AS product_id,
    re.properties->>'product_name' AS product_name,
    (re.properties->>'order_id')::INTEGER AS order_id,
    (re.properties->>'order_total')::NUMERIC AS order_total,
    -- Остальные свойства
    re.properties,
    NOW() AS processed_at
  FROM raw_events re
  LEFT JOIN users u ON re.user_id = u.id
  WHERE re.id > v_last_processed_id
    AND re.request_id IS NOT NULL  -- Только события с request_id для дедупликации
  ORDER BY re.request_id, re.event_time, re.event_name, re.id;

  GET DIAGNOSTICS v_processed_count = ROW_COUNT;

  -- Логируем успешное завершение
  UPDATE etl_runs 
  SET 
    end_time = NOW(),
    status = 'success',
    rows_processed = v_processed_count
  WHERE id = v_run_id;

  RETURN QUERY SELECT v_processed_count;

EXCEPTION WHEN OTHERS THEN
  UPDATE etl_runs 
  SET 
    end_time = NOW(),
    status = 'failed',
    error_message = SQLERRM
  WHERE id = v_run_id;
  
  RAISE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_events_clean IS 'Обрабатывает новые события из raw_events с дедупликацией и обогащением';


-- ============================================
-- ФУНКЦИЯ 3: Агрегация метрик экспериментов
-- ============================================

CREATE OR REPLACE FUNCTION aggregate_experiment_metrics_daily(p_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day')
RETURNS TABLE(processed_experiments INTEGER) AS $$
DECLARE
  v_processed_count INTEGER := 0;
  v_run_id INTEGER;
BEGIN
  -- Логируем начало ETL
  INSERT INTO etl_runs (job_name, status, metadata)
  VALUES ('aggregate_experiment_metrics_daily', 'running', jsonb_build_object('date', p_date))
  RETURNING id INTO v_run_id;

  -- Агрегируем метрики по экспериментам за указанную дату
  WITH daily_experiment_stats AS (
    SELECT 
      p_date AS date,
      ec.experiment_key,
      ec.experiment_variant,
      -- Метрики пользователей
      COUNT(DISTINCT ec.user_id) AS users_count,
      COUNT(DISTINCT ec.user_id) FILTER (
        WHERE NOT EXISTS (
          SELECT 1 FROM events_clean ec2 
          WHERE ec2.user_id = ec.user_id 
            AND ec2.event_time < p_date
        )
      ) AS new_users_count,
      -- Метрики сессий
      COUNT(DISTINCT ec.session_id) AS sessions_count,
      AVG(s.session_length_sec) AS avg_session_length_sec,
      -- Метрики событий
      COUNT(*) AS events_count,
      COUNT(*) FILTER (WHERE ec.event_name = 'page_view') AS page_views_count,
      COUNT(*) FILTER (WHERE ec.event_name = 'add_to_cart') AS add_to_cart_count,
      COUNT(DISTINCT ec.session_id) FILTER (WHERE ec.event_name = 'checkout_started') AS checkout_started_count,
      -- Конверсионные метрики
      COUNT(DISTINCT ec.order_id) AS orders_count,
      COALESCE(SUM(ec.order_total), 0) AS orders_total_amount
    FROM events_clean ec
    LEFT JOIN sessions s ON ec.session_id = s.session_id
    WHERE ec.event_time >= p_date 
      AND ec.event_time < p_date + INTERVAL '1 day'
      AND ec.experiment_key IS NOT NULL
    GROUP BY ec.experiment_key, ec.experiment_variant
  )
  INSERT INTO experiment_metrics_daily (
    date, experiment_key, experiment_variant,
    users_count, new_users_count, returning_users_count,
    sessions_count, avg_session_length_sec,
    events_count, page_views_count, add_to_cart_count, checkout_started_count,
    orders_count, orders_total_amount, conversion_rate, avg_order_value,
    updated_at
  )
  SELECT 
    date, experiment_key, experiment_variant,
    users_count, new_users_count, 
    users_count - new_users_count AS returning_users_count,
    sessions_count, avg_session_length_sec,
    events_count, page_views_count, add_to_cart_count, checkout_started_count,
    orders_count, orders_total_amount,
    CASE WHEN users_count > 0 THEN (orders_count::NUMERIC / users_count * 100) ELSE 0 END AS conversion_rate,
    CASE WHEN orders_count > 0 THEN (orders_total_amount / orders_count) ELSE 0 END AS avg_order_value,
    NOW()
  FROM daily_experiment_stats
  ON CONFLICT (date, experiment_key, experiment_variant) DO UPDATE SET
    users_count = EXCLUDED.users_count,
    new_users_count = EXCLUDED.new_users_count,
    returning_users_count = EXCLUDED.returning_users_count,
    sessions_count = EXCLUDED.sessions_count,
    avg_session_length_sec = EXCLUDED.avg_session_length_sec,
    events_count = EXCLUDED.events_count,
    page_views_count = EXCLUDED.page_views_count,
    add_to_cart_count = EXCLUDED.add_to_cart_count,
    checkout_started_count = EXCLUDED.checkout_started_count,
    orders_count = EXCLUDED.orders_count,
    orders_total_amount = EXCLUDED.orders_total_amount,
    conversion_rate = EXCLUDED.conversion_rate,
    avg_order_value = EXCLUDED.avg_order_value,
    updated_at = NOW();

  GET DIAGNOSTICS v_processed_count = ROW_COUNT;

  -- Логируем успешное завершение
  UPDATE etl_runs 
  SET 
    end_time = NOW(),
    status = 'success',
    rows_processed = v_processed_count
  WHERE id = v_run_id;

  RETURN QUERY SELECT v_processed_count;

EXCEPTION WHEN OTHERS THEN
  UPDATE etl_runs 
  SET 
    end_time = NOW(),
    status = 'failed',
    error_message = SQLERRM
  WHERE id = v_run_id;
  
  RAISE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION aggregate_experiment_metrics_daily IS 'Агрегирует ежедневные метрики по A/B экспериментам';


-- ============================================
-- ФУНКЦИЯ 4: Обновление retention метрик
-- ============================================

CREATE OR REPLACE FUNCTION update_user_retention()
RETURNS TABLE(processed_users INTEGER) AS $$
DECLARE
  v_processed_count INTEGER := 0;
  v_run_id INTEGER;
BEGIN
  -- Логируем начало ETL
  INSERT INTO etl_runs (job_name, status)
  VALUES ('update_user_retention', 'running')
  RETURNING id INTO v_run_id;

  -- Обновляем retention метрики для пользователей
  WITH user_first_visit AS (
    SELECT 
      user_id,
      DATE(MIN(event_time)) AS cohort_date
    FROM events_clean
    WHERE user_id IS NOT NULL
    GROUP BY user_id
  ),
  user_activity AS (
    SELECT DISTINCT
      ufv.cohort_date,
      ec.user_id,
      DATE(ec.event_time) AS activity_date
    FROM events_clean ec
    INNER JOIN user_first_visit ufv ON ec.user_id = ufv.user_id
    WHERE ec.user_id IS NOT NULL
  )
  INSERT INTO user_retention (cohort_date, user_id, day_0, day_1, day_7, day_30, last_updated)
  SELECT 
    cohort_date,
    user_id,
    BOOL_OR(activity_date = cohort_date) AS day_0,
    BOOL_OR(activity_date = cohort_date + INTERVAL '1 day') AS day_1,
    BOOL_OR(activity_date >= cohort_date + INTERVAL '7 days' 
            AND activity_date < cohort_date + INTERVAL '8 days') AS day_7,
    BOOL_OR(activity_date >= cohort_date + INTERVAL '30 days' 
            AND activity_date < cohort_date + INTERVAL '31 days') AS day_30,
    NOW()
  FROM user_activity
  GROUP BY cohort_date, user_id
  ON CONFLICT (cohort_date, user_id) DO UPDATE SET
    day_0 = user_retention.day_0 OR EXCLUDED.day_0,
    day_1 = user_retention.day_1 OR EXCLUDED.day_1,
    day_7 = user_retention.day_7 OR EXCLUDED.day_7,
    day_30 = user_retention.day_30 OR EXCLUDED.day_30,
    last_updated = NOW();

  GET DIAGNOSTICS v_processed_count = ROW_COUNT;

  -- Логируем успешное завершение
  UPDATE etl_runs 
  SET 
    end_time = NOW(),
    status = 'success',
    rows_processed = v_processed_count
  WHERE id = v_run_id;

  RETURN QUERY SELECT v_processed_count;

EXCEPTION WHEN OTHERS THEN
  UPDATE etl_runs 
  SET 
    end_time = NOW(),
    status = 'failed',
    error_message = SQLERRM
  WHERE id = v_run_id;
  
  RAISE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_user_retention IS 'Обновляет retention-метрики пользователей по когортам';


-- ============================================
-- ФУНКЦИЯ 5: Агрегация общей дневной статистики
-- ============================================

CREATE OR REPLACE FUNCTION aggregate_daily_stats(p_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day')
RETURNS TABLE(success BOOLEAN) AS $$
DECLARE
  v_run_id INTEGER;
BEGIN
  -- Логируем начало ETL
  INSERT INTO etl_runs (job_name, status, metadata)
  VALUES ('aggregate_daily_stats', 'running', jsonb_build_object('date', p_date))
  RETURNING id INTO v_run_id;

  -- Агрегируем общую статистику за день
  INSERT INTO daily_stats (
    date, total_users, new_users, active_users,
    total_sessions, total_events, total_orders, total_revenue,
    avg_session_length_sec, avg_order_value, updated_at
  )
  SELECT 
    p_date AS date,
    (SELECT COUNT(*) FROM users WHERE id IN (
      SELECT DISTINCT user_id FROM events_clean WHERE event_time < p_date + INTERVAL '1 day'
    )) AS total_users,
    COUNT(DISTINCT ec.user_id) FILTER (
      WHERE NOT EXISTS (
        SELECT 1 FROM events_clean ec2 
        WHERE ec2.user_id = ec.user_id 
          AND ec2.event_time < p_date
      )
    ) AS new_users,
    COUNT(DISTINCT ec.user_id) AS active_users,
    COUNT(DISTINCT ec.session_id) AS total_sessions,
    COUNT(*) AS total_events,
    COUNT(DISTINCT ec.order_id) AS total_orders,
    COALESCE(SUM(ec.order_total), 0) AS total_revenue,
    AVG(s.session_length_sec) AS avg_session_length_sec,
    CASE 
      WHEN COUNT(DISTINCT ec.order_id) > 0 
      THEN SUM(ec.order_total) / COUNT(DISTINCT ec.order_id) 
      ELSE 0 
    END AS avg_order_value,
    NOW()
  FROM events_clean ec
  LEFT JOIN sessions s ON ec.session_id = s.session_id
  WHERE ec.event_time >= p_date 
    AND ec.event_time < p_date + INTERVAL '1 day'
  ON CONFLICT (date) DO UPDATE SET
    total_users = EXCLUDED.total_users,
    new_users = EXCLUDED.new_users,
    active_users = EXCLUDED.active_users,
    total_sessions = EXCLUDED.total_sessions,
    total_events = EXCLUDED.total_events,
    total_orders = EXCLUDED.total_orders,
    total_revenue = EXCLUDED.total_revenue,
    avg_session_length_sec = EXCLUDED.avg_session_length_sec,
    avg_order_value = EXCLUDED.avg_order_value,
    updated_at = NOW();

  -- Логируем успешное завершение
  UPDATE etl_runs 
  SET 
    end_time = NOW(),
    status = 'success',
    rows_processed = 1
  WHERE id = v_run_id;

  RETURN QUERY SELECT TRUE;

EXCEPTION WHEN OTHERS THEN
  UPDATE etl_runs 
  SET 
    end_time = NOW(),
    status = 'failed',
    error_message = SQLERRM
  WHERE id = v_run_id;
  
  RAISE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION aggregate_daily_stats IS 'Агрегирует общую статистику за указанную дату';


-- ============================================
-- ФУНКЦИЯ 6: Очистка старых сырых логов
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_old_raw_events(p_days_to_keep INTEGER DEFAULT 90)
RETURNS TABLE(deleted_count INTEGER) AS $$
DECLARE
  v_deleted_count INTEGER := 0;
  v_run_id INTEGER;
BEGIN
  -- Логируем начало ETL
  INSERT INTO etl_runs (job_name, status, metadata)
  VALUES ('cleanup_old_raw_events', 'running', jsonb_build_object('days_to_keep', p_days_to_keep))
  RETURNING id INTO v_run_id;

  -- Удаляем события старше N дней
  DELETE FROM raw_events
  WHERE event_time < NOW() - (p_days_to_keep || ' days')::INTERVAL;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Логируем успешное завершение
  UPDATE etl_runs 
  SET 
    end_time = NOW(),
    status = 'success',
    rows_processed = v_deleted_count
  WHERE id = v_run_id;

  RETURN QUERY SELECT v_deleted_count;

EXCEPTION WHEN OTHERS THEN
  UPDATE etl_runs 
  SET 
    end_time = NOW(),
    status = 'failed',
    error_message = SQLERRM
  WHERE id = v_run_id;
  
  RAISE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_raw_events IS 'Удаляет сырые события старше указанного количества дней';
