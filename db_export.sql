--
-- PostgreSQL database dump
--

\restrict fiKSp8h9IqVHlfjKVcxFqwyqNzntEt98lzAcKTeNZPVPhYBrcUMTUcVKTjKcdiP

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: aggregate_daily_stats(date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.aggregate_daily_stats(p_date date DEFAULT (CURRENT_DATE - '1 day'::interval)) RETURNS TABLE(success boolean)
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.aggregate_daily_stats(p_date date) OWNER TO postgres;

--
-- Name: FUNCTION aggregate_daily_stats(p_date date); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.aggregate_daily_stats(p_date date) IS 'Агрегирует общую статистику за указанную дату';


--
-- Name: aggregate_experiment_metrics_daily(date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.aggregate_experiment_metrics_daily(p_date date DEFAULT (CURRENT_DATE - '1 day'::interval)) RETURNS TABLE(processed_experiments integer)
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.aggregate_experiment_metrics_daily(p_date date) OWNER TO postgres;

--
-- Name: FUNCTION aggregate_experiment_metrics_daily(p_date date); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.aggregate_experiment_metrics_daily(p_date date) IS 'Агрегирует ежедневные метрики по A/B экспериментам';


--
-- Name: cleanup_old_raw_events(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.cleanup_old_raw_events(p_days_to_keep integer DEFAULT 90) RETURNS TABLE(deleted_count integer)
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.cleanup_old_raw_events(p_days_to_keep integer) OWNER TO postgres;

--
-- Name: FUNCTION cleanup_old_raw_events(p_days_to_keep integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.cleanup_old_raw_events(p_days_to_keep integer) IS 'Удаляет сырые события старше указанного количества дней';


--
-- Name: notify_etl_failures(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_etl_failures() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_failed_jobs RECORD;
BEGIN
  -- Ищем неудачные запуски за последние 24 часа
  FOR v_failed_jobs IN 
    SELECT 
      job_name,
      start_time,
      error_message,
      metadata
    FROM etl_runs
    WHERE status = 'failed'
      AND start_time > NOW() - INTERVAL '24 hours'
    ORDER BY start_time DESC
  LOOP
    -- Здесь можно добавить логику отправки уведомлений
    -- Например, вставка в таблицу notifications или вызов webhook
    RAISE NOTICE 'ETL Failure: % at % - %', 
      v_failed_jobs.job_name, 
      v_failed_jobs.start_time, 
      v_failed_jobs.error_message;
  END LOOP;
END;
$$;


ALTER FUNCTION public.notify_etl_failures() OWNER TO postgres;

--
-- Name: process_events_clean(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.process_events_clean() RETURNS TABLE(processed_count integer)
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.process_events_clean() OWNER TO postgres;

--
-- Name: FUNCTION process_events_clean(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.process_events_clean() IS 'Обрабатывает новые события из raw_events с дедупликацией и обогащением';


--
-- Name: process_sessions(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.process_sessions() RETURNS TABLE(processed_count integer)
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.process_sessions() OWNER TO postgres;

--
-- Name: FUNCTION process_sessions(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.process_sessions() IS 'Инкрементально обновляет таблицу sessions из raw_events';


--
-- Name: update_user_retention(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_user_retention() RETURNS TABLE(processed_users integer)
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.update_user_retention() OWNER TO postgres;

--
-- Name: FUNCTION update_user_retention(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.update_user_retention() IS 'Обновляет retention-метрики пользователей по когортам';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ab_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ab_events (
    id integer NOT NULL,
    event_type text NOT NULL,
    "timestamp" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    user_identifier text NOT NULL,
    user_id character varying,
    device_id text,
    test_assignments text,
    event_data text
);


ALTER TABLE public.ab_events OWNER TO postgres;

--
-- Name: ab_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ab_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ab_events_id_seq OWNER TO postgres;

--
-- Name: ab_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ab_events_id_seq OWNED BY public.ab_events.id;


--
-- Name: app_waitlist; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_waitlist (
    id integer NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    telegram text,
    email text,
    consent boolean DEFAULT false NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    survey_q1 text,
    survey_q2 text,
    survey_q3 text,
    survey_q4 text,
    survey_q4_custom text,
    survey_q5 text,
    survey_q5_custom text
);


ALTER TABLE public.app_waitlist OWNER TO postgres;

--
-- Name: app_waitlist_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.app_waitlist_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.app_waitlist_id_seq OWNER TO postgres;

--
-- Name: app_waitlist_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.app_waitlist_id_seq OWNED BY public.app_waitlist.id;


--
-- Name: cart_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cart_items (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    added_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    price_per_unit real
);


ALTER TABLE public.cart_items OWNER TO postgres;

--
-- Name: cart_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cart_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cart_items_id_seq OWNER TO postgres;

--
-- Name: cart_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cart_items_id_seq OWNED BY public.cart_items.id;


--
-- Name: daily_stats; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.daily_stats (
    date date NOT NULL,
    total_users integer DEFAULT 0,
    new_users integer DEFAULT 0,
    active_users integer DEFAULT 0,
    total_sessions integer DEFAULT 0,
    total_events integer DEFAULT 0,
    total_orders integer DEFAULT 0,
    total_revenue numeric DEFAULT 0,
    avg_session_length_sec numeric,
    avg_order_value numeric,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.daily_stats OWNER TO postgres;

--
-- Name: TABLE daily_stats; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.daily_stats IS 'Общая статистика по дням (для дашбордов)';


--
-- Name: device_user_mappings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.device_user_mappings (
    id integer NOT NULL,
    device_id text NOT NULL,
    user_id character varying NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.device_user_mappings OWNER TO postgres;

--
-- Name: device_user_mappings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.device_user_mappings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.device_user_mappings_id_seq OWNER TO postgres;

--
-- Name: device_user_mappings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.device_user_mappings_id_seq OWNED BY public.device_user_mappings.id;


--
-- Name: etl_runs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.etl_runs (
    id integer NOT NULL,
    job_name character varying NOT NULL,
    start_time timestamp with time zone DEFAULT now() NOT NULL,
    end_time timestamp with time zone,
    status character varying DEFAULT 'running'::character varying NOT NULL,
    rows_processed integer,
    error_message text,
    metadata jsonb
);


ALTER TABLE public.etl_runs OWNER TO postgres;

--
-- Name: TABLE etl_runs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.etl_runs IS 'История запусков ETL процессов';


--
-- Name: etl_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.etl_runs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.etl_runs_id_seq OWNER TO postgres;

--
-- Name: etl_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.etl_runs_id_seq OWNED BY public.etl_runs.id;


--
-- Name: events_clean; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.events_clean (
    id bigint NOT NULL,
    event_time timestamp with time zone NOT NULL,
    user_id character varying,
    session_id character varying,
    event_name character varying NOT NULL,
    source character varying NOT NULL,
    page character varying,
    experiment_key character varying,
    experiment_variant character varying,
    user_name character varying,
    user_loyalty_level integer,
    product_id integer,
    product_name character varying,
    order_id integer,
    order_total numeric,
    properties jsonb,
    processed_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.events_clean OWNER TO postgres;

--
-- Name: TABLE events_clean; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.events_clean IS 'Очищенные и обогащённые события для аналитики';


--
-- Name: COLUMN events_clean.processed_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.events_clean.processed_at IS 'Время обработки события ETL процессом';


--
-- Name: events_clean_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.events_clean_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.events_clean_id_seq OWNER TO postgres;

--
-- Name: events_clean_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.events_clean_id_seq OWNED BY public.events_clean.id;


--
-- Name: experiment_metrics_daily; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.experiment_metrics_daily (
    date date NOT NULL,
    experiment_key character varying NOT NULL,
    experiment_variant character varying NOT NULL,
    users_count integer DEFAULT 0 NOT NULL,
    new_users_count integer DEFAULT 0,
    returning_users_count integer DEFAULT 0,
    sessions_count integer DEFAULT 0 NOT NULL,
    avg_session_length_sec numeric,
    events_count integer DEFAULT 0 NOT NULL,
    page_views_count integer DEFAULT 0,
    add_to_cart_count integer DEFAULT 0,
    checkout_started_count integer DEFAULT 0,
    orders_count integer DEFAULT 0,
    orders_total_amount numeric DEFAULT 0,
    conversion_rate numeric,
    avg_order_value numeric,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.experiment_metrics_daily OWNER TO postgres;

--
-- Name: TABLE experiment_metrics_daily; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.experiment_metrics_daily IS 'Ежедневные метрики по A/B экспериментам';


--
-- Name: COLUMN experiment_metrics_daily.conversion_rate; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.experiment_metrics_daily.conversion_rate IS 'Процент пользователей, совершивших заказ';


--
-- Name: experiments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.experiments (
    id integer NOT NULL,
    test_id text NOT NULL,
    name text NOT NULL,
    description text,
    status text DEFAULT 'inactive'::text NOT NULL,
    variants text NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    target_user_ids text
);


ALTER TABLE public.experiments OWNER TO postgres;

--
-- Name: experiments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.experiments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.experiments_id_seq OWNER TO postgres;

--
-- Name: experiments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.experiments_id_seq OWNED BY public.experiments.id;


--
-- Name: info_banners; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.info_banners (
    id integer NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    icon text,
    theme text DEFAULT 'dark'::text NOT NULL,
    buttons text,
    desktop_slot text DEFAULT 'after_filters'::text NOT NULL,
    mobile_slot text DEFAULT 'after_filters'::text NOT NULL,
    desktop_order integer DEFAULT 0 NOT NULL,
    mobile_order integer DEFAULT 0 NOT NULL,
    hide_on_desktop boolean DEFAULT false NOT NULL,
    hide_on_mobile boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    between_row_index_desktop integer,
    between_row_index_mobile integer,
    width_variant text DEFAULT 'full'::text NOT NULL,
    height_variant text DEFAULT 'standard'::text NOT NULL
);


ALTER TABLE public.info_banners OWNER TO postgres;

--
-- Name: info_banners_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.info_banners_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.info_banners_id_seq OWNER TO postgres;

--
-- Name: info_banners_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.info_banners_id_seq OWNED BY public.info_banners.id;


--
-- Name: magic_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.magic_links (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    token_hash text NOT NULL,
    channel text DEFAULT 'telegram'::text NOT NULL,
    expires_at text NOT NULL,
    consumed_at text,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.magic_links OWNER TO postgres;

--
-- Name: magic_links_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.magic_links_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.magic_links_id_seq OWNER TO postgres;

--
-- Name: magic_links_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.magic_links_id_seq OWNED BY public.magic_links.id;


--
-- Name: media; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.media (
    id integer NOT NULL,
    product_id integer NOT NULL,
    type text NOT NULL,
    title text,
    description text,
    source text NOT NULL,
    source_type text DEFAULT 'file'::text NOT NULL,
    thumbnail text,
    featured boolean DEFAULT true NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.media OWNER TO postgres;

--
-- Name: media_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.media_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.media_id_seq OWNER TO postgres;

--
-- Name: media_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.media_id_seq OWNED BY public.media.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    user_id character varying,
    name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    address text NOT NULL,
    comment text,
    items text NOT NULL,
    total real NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    used_first_order_discount boolean DEFAULT false NOT NULL,
    payment_id text,
    payment_status text,
    payment_url text,
    receipt_email text,
    receipt_url text,
    receipt_sms_sent boolean DEFAULT false NOT NULL,
    telegram_chat_id text
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orders_id_seq OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: pending_telegram_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pending_telegram_orders (
    id integer NOT NULL,
    order_id text NOT NULL,
    user_id character varying NOT NULL,
    chat_id text NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    address text NOT NULL,
    items text NOT NULL,
    subtotal integer NOT NULL,
    discount integer DEFAULT 0 NOT NULL,
    total integer NOT NULL,
    discount_type text,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL
);


ALTER TABLE public.pending_telegram_orders OWNER TO postgres;

--
-- Name: pending_telegram_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pending_telegram_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pending_telegram_orders_id_seq OWNER TO postgres;

--
-- Name: pending_telegram_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pending_telegram_orders_id_seq OWNED BY public.pending_telegram_orders.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id integer NOT NULL,
    name text NOT NULL,
    price_per_gram real NOT NULL,
    description text NOT NULL,
    images text[] DEFAULT ARRAY[]::text[] NOT NULL,
    tea_type text NOT NULL,
    effects text[] DEFAULT ARRAY[]::text[] NOT NULL,
    available_quantities text[] DEFAULT ARRAY['25'::text, '50'::text, '100'::text] NOT NULL,
    fixed_quantity_only boolean DEFAULT false NOT NULL,
    fixed_quantity integer,
    category text DEFAULT 'tea'::text NOT NULL,
    out_of_stock boolean DEFAULT false NOT NULL,
    pricing_unit text DEFAULT 'gram'::text NOT NULL,
    default_quantity text,
    card_type text DEFAULT 'classic'::text NOT NULL
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.products_id_seq OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: raw_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.raw_events (
    id bigint NOT NULL,
    event_time timestamp with time zone DEFAULT now() NOT NULL,
    user_id character varying,
    session_id character varying,
    request_id character varying,
    event_name character varying NOT NULL,
    source character varying NOT NULL,
    page character varying,
    experiment_key character varying,
    experiment_variant character varying,
    properties jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.raw_events OWNER TO postgres;

--
-- Name: TABLE raw_events; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.raw_events IS 'Сырые события с фронтенда и бэкенда';


--
-- Name: COLUMN raw_events.event_time; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.raw_events.event_time IS 'Время события (от клиента или сервера)';


--
-- Name: COLUMN raw_events.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.raw_events.user_id IS 'ID пользователя (NULL для анонимных)';


--
-- Name: COLUMN raw_events.session_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.raw_events.session_id IS 'ID сессии для группировки событий';


--
-- Name: COLUMN raw_events.request_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.raw_events.request_id IS 'Уникальный ID запроса для дедупликации';


--
-- Name: COLUMN raw_events.properties; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.raw_events.properties IS 'Произвольные данные события в JSON';


--
-- Name: raw_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.raw_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.raw_events_id_seq OWNER TO postgres;

--
-- Name: raw_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.raw_events_id_seq OWNED BY public.raw_events.id;


--
-- Name: saved_addresses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.saved_addresses (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    address text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.saved_addresses OWNER TO postgres;

--
-- Name: saved_addresses_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.saved_addresses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.saved_addresses_id_seq OWNER TO postgres;

--
-- Name: saved_addresses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.saved_addresses_id_seq OWNED BY public.saved_addresses.id;


--
-- Name: session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.session OWNER TO postgres;

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sessions (
    session_id character varying NOT NULL,
    user_id character varying,
    first_event_time timestamp with time zone NOT NULL,
    last_event_time timestamp with time zone NOT NULL,
    session_length_sec integer,
    events_count integer DEFAULT 0 NOT NULL,
    landing_page character varying,
    exit_page character varying,
    experiment_key character varying,
    experiment_variant character varying,
    page_views_count integer DEFAULT 0,
    add_to_cart_count integer DEFAULT 0,
    checkout_started boolean DEFAULT false,
    order_completed boolean DEFAULT false,
    device_type character varying,
    referrer character varying,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sessions OWNER TO postgres;

--
-- Name: TABLE sessions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.sessions IS 'Агрегированные данные по сессиям пользователей';


--
-- Name: COLUMN sessions.session_length_sec; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sessions.session_length_sec IS 'Длительность сессии в секундах (last_event - first_event)';


--
-- Name: settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.settings (
    id integer NOT NULL,
    design_mode text DEFAULT 'classic'::text NOT NULL
);


ALTER TABLE public.settings OWNER TO postgres;

--
-- Name: settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.settings_id_seq OWNER TO postgres;

--
-- Name: settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.settings_id_seq OWNED BY public.settings.id;


--
-- Name: site_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.site_settings (
    id integer NOT NULL,
    contact_email text NOT NULL,
    contact_phone text NOT NULL,
    contact_telegram text NOT NULL,
    delivery_info text NOT NULL,
    first_order_discount integer DEFAULT 20 NOT NULL,
    loyalty_level2_min_xp integer DEFAULT 3000 NOT NULL,
    loyalty_level2_discount integer DEFAULT 5 NOT NULL,
    loyalty_level3_min_xp integer DEFAULT 7000 NOT NULL,
    loyalty_level3_discount integer DEFAULT 10 NOT NULL,
    loyalty_level4_min_xp integer DEFAULT 15000 NOT NULL,
    loyalty_level4_discount integer DEFAULT 15 NOT NULL,
    xp_multiplier integer DEFAULT 1 NOT NULL,
    loyalty_level1_perks text[] DEFAULT ARRAY['Доступ к базовому каталогу'::text] NOT NULL,
    loyalty_level2_perks text[] DEFAULT ARRAY['Доступ к базовому каталогу'::text] NOT NULL,
    loyalty_level3_perks text[] DEFAULT ARRAY['Персональный чат с консультациями'::text, 'Приглашения на закрытые чайные вечеринки'::text, 'Возможность запросить любой чай'::text] NOT NULL,
    loyalty_level4_perks text[] DEFAULT ARRAY['Все привилегии уровня 3'::text, 'Приоритетное обслуживание'::text, 'Эксклюзивные предложения'::text] NOT NULL
);


ALTER TABLE public.site_settings OWNER TO postgres;

--
-- Name: site_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.site_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.site_settings_id_seq OWNER TO postgres;

--
-- Name: site_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.site_settings_id_seq OWNED BY public.site_settings.id;


--
-- Name: sms_verifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sms_verifications (
    id integer NOT NULL,
    phone text NOT NULL,
    code text NOT NULL,
    type text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at text NOT NULL
);


ALTER TABLE public.sms_verifications OWNER TO postgres;

--
-- Name: sms_verifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sms_verifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sms_verifications_id_seq OWNER TO postgres;

--
-- Name: sms_verifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sms_verifications_id_seq OWNED BY public.sms_verifications.id;


--
-- Name: tea_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tea_types (
    id integer NOT NULL,
    name text NOT NULL,
    background_color text NOT NULL,
    text_color text NOT NULL
);


ALTER TABLE public.tea_types OWNER TO postgres;

--
-- Name: tea_types_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tea_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tea_types_id_seq OWNER TO postgres;

--
-- Name: tea_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tea_types_id_seq OWNED BY public.tea_types.id;


--
-- Name: telegram_cart; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.telegram_cart (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    product_id integer NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.telegram_cart OWNER TO postgres;

--
-- Name: telegram_cart_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.telegram_cart_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.telegram_cart_id_seq OWNER TO postgres;

--
-- Name: telegram_cart_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.telegram_cart_id_seq OWNED BY public.telegram_cart.id;


--
-- Name: telegram_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.telegram_profiles (
    id integer NOT NULL,
    chat_id text NOT NULL,
    username text,
    first_name text,
    user_id character varying,
    last_seen text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.telegram_profiles OWNER TO postgres;

--
-- Name: telegram_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.telegram_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.telegram_profiles_id_seq OWNER TO postgres;

--
-- Name: telegram_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.telegram_profiles_id_seq OWNED BY public.telegram_profiles.id;


--
-- Name: telegram_questions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.telegram_questions (
    id integer NOT NULL,
    chat_id text NOT NULL,
    username text,
    first_name text,
    question text NOT NULL,
    answer text,
    admin_chat_id text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    answered_at text
);


ALTER TABLE public.telegram_questions OWNER TO postgres;

--
-- Name: telegram_questions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.telegram_questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.telegram_questions_id_seq OWNER TO postgres;

--
-- Name: telegram_questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.telegram_questions_id_seq OWNED BY public.telegram_questions.id;


--
-- Name: tv_slides; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tv_slides (
    id integer NOT NULL,
    type text DEFAULT 'image'::text NOT NULL,
    image_url text,
    title text,
    duration_seconds integer DEFAULT 60 NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    leaderboard_month text
);


ALTER TABLE public.tv_slides OWNER TO postgres;

--
-- Name: tv_slides_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tv_slides_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tv_slides_id_seq OWNER TO postgres;

--
-- Name: tv_slides_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tv_slides_id_seq OWNED BY public.tv_slides.id;


--
-- Name: user_retention; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_retention (
    cohort_date date NOT NULL,
    user_id character varying NOT NULL,
    day_0 boolean DEFAULT false,
    day_1 boolean DEFAULT false,
    day_7 boolean DEFAULT false,
    day_30 boolean DEFAULT false,
    last_updated timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_retention OWNER TO postgres;

--
-- Name: TABLE user_retention; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_retention IS 'Retention-метрики пользователей по когортам';


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    email text,
    password text NOT NULL,
    name text,
    phone text,
    xp integer DEFAULT 0 NOT NULL,
    phone_verified boolean DEFAULT false NOT NULL,
    first_order_discount_used boolean DEFAULT false NOT NULL,
    custom_discount integer,
    wallet_balance integer DEFAULT 0 NOT NULL,
    analytics text
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_dim; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.users_dim AS
 SELECT id AS user_id,
    name,
    phone,
    email,
    phone_verified,
    xp,
    first_order_discount_used,
    custom_discount,
    wallet_balance,
        CASE
            WHEN (xp >= 15000) THEN 4
            WHEN (xp >= 7000) THEN 3
            WHEN (xp >= 3000) THEN 2
            ELSE 1
        END AS loyalty_level
   FROM public.users;


ALTER VIEW public.users_dim OWNER TO postgres;

--
-- Name: VIEW users_dim; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.users_dim IS 'Справочник пользователей для аналитики';


--
-- Name: v_analytics_daily_stats; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_analytics_daily_stats AS
 SELECT date AS "Дата",
    total_users AS "Всего пользователей",
    new_users AS "Новых пользователей",
    active_users AS "Активных пользователей",
    total_sessions AS "Сессий",
    total_events AS "Событий",
    total_orders AS "Заказов",
    round(total_revenue, 2) AS "Выручка",
    round(avg_session_length_sec, 2) AS "Средняя длительность сессии (сек)",
    round((avg_session_length_sec / 60.0), 2) AS "Средняя длительность сессии (мин)",
    round(avg_order_value, 2) AS "Средний чек",
        CASE
            WHEN (active_users > 0) THEN round((((total_orders)::numeric / (active_users)::numeric) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS "Конверсия (%)",
        CASE
            WHEN (total_sessions > 0) THEN round(((total_events)::numeric / (total_sessions)::numeric), 2)
            ELSE (0)::numeric
        END AS "События на сессию",
        CASE
            WHEN (active_users > 0) THEN round(((total_sessions)::numeric / (active_users)::numeric), 2)
            ELSE (0)::numeric
        END AS "Сессий на пользователя",
    EXTRACT(year FROM date) AS "Год",
    EXTRACT(month FROM date) AS "Месяц",
    EXTRACT(day FROM date) AS "День",
    EXTRACT(dow FROM date) AS "День недели",
    to_char((date)::timestamp with time zone, 'YYYY-MM'::text) AS "Год-Месяц",
    to_char((date)::timestamp with time zone, 'Day'::text) AS "Название дня недели"
   FROM public.daily_stats ds
  ORDER BY date DESC;


ALTER VIEW public.v_analytics_daily_stats OWNER TO postgres;

--
-- Name: VIEW v_analytics_daily_stats; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.v_analytics_daily_stats IS 'Общая статистика по дням';


--
-- Name: v_analytics_events; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_analytics_events AS
 SELECT id,
    event_time AS "Время события",
    event_name AS "Название события",
    source AS "Источник",
    page AS "Страница",
    user_id AS "ID пользователя",
    user_name AS "Имя пользователя",
        CASE user_loyalty_level
            WHEN 1 THEN 'Новичок'::text
            WHEN 2 THEN 'Знаток'::text
            WHEN 3 THEN 'Эксперт'::text
            WHEN 4 THEN 'Мастер'::text
            ELSE 'Неизвестно'::text
        END AS "Уровень лояльности",
    session_id AS "ID сессии",
    experiment_key AS "Ключ эксперимента",
    experiment_variant AS "Вариант эксперимента",
    product_id AS "ID товара",
    product_name AS "Название товара",
    order_id AS "ID заказа",
    order_total AS "Сумма заказа",
    date(event_time) AS "Дата",
    EXTRACT(year FROM event_time) AS "Год",
    EXTRACT(month FROM event_time) AS "Месяц",
    EXTRACT(day FROM event_time) AS "День",
    EXTRACT(dow FROM event_time) AS "День недели",
    EXTRACT(hour FROM event_time) AS "Час",
    to_char(event_time, 'YYYY-MM'::text) AS "Год-Месяц",
    to_char(event_time, 'YYYY-MM-DD'::text) AS "Дата (текст)",
    properties AS "Свойства (JSON)"
   FROM public.events_clean ec
  ORDER BY event_time DESC;


ALTER VIEW public.v_analytics_events OWNER TO postgres;

--
-- Name: VIEW v_analytics_events; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.v_analytics_events IS 'События для аналитики с человекочитаемыми названиями';


--
-- Name: v_analytics_experiments; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_analytics_experiments AS
 SELECT date AS "Дата",
    experiment_key AS "Название эксперимента",
    experiment_variant AS "Вариант",
    users_count AS "Пользователей",
    new_users_count AS "Новых пользователей",
    returning_users_count AS "Вернувшихся пользователей",
    sessions_count AS "Сессий",
    round(avg_session_length_sec, 2) AS "Средняя длительность сессии (сек)",
    round((avg_session_length_sec / 60.0), 2) AS "Средняя длительность сессии (мин)",
    events_count AS "Событий",
    page_views_count AS "Просмотров страниц",
    add_to_cart_count AS "Добавлений в корзину",
    checkout_started_count AS "Начали оформление",
    orders_count AS "Заказов",
    orders_total_amount AS "Общая сумма заказов",
    round(conversion_rate, 2) AS "Конверсия (%)",
    round(avg_order_value, 2) AS "Средний чек",
        CASE
            WHEN (sessions_count > 0) THEN round(((events_count)::numeric / (sessions_count)::numeric), 2)
            ELSE (0)::numeric
        END AS "События на сессию",
        CASE
            WHEN (users_count > 0) THEN round(((sessions_count)::numeric / (users_count)::numeric), 2)
            ELSE (0)::numeric
        END AS "Сессий на пользователя",
    EXTRACT(year FROM date) AS "Год",
    EXTRACT(month FROM date) AS "Месяц",
    EXTRACT(day FROM date) AS "День",
    to_char((date)::timestamp with time zone, 'YYYY-MM'::text) AS "Год-Месяц",
    updated_at AS "Обновлено"
   FROM public.experiment_metrics_daily em
  ORDER BY date DESC, experiment_key, experiment_variant;


ALTER VIEW public.v_analytics_experiments OWNER TO postgres;

--
-- Name: VIEW v_analytics_experiments; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.v_analytics_experiments IS 'Метрики A/B экспериментов по дням';


--
-- Name: v_analytics_funnel; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_analytics_funnel AS
 WITH funnel_data AS (
         SELECT date(ec.event_time) AS date,
            ec.experiment_key,
            ec.experiment_variant,
            count(DISTINCT ec.session_id) FILTER (WHERE ((ec.event_name)::text = 'page_view'::text)) AS step_1_page_view,
            count(DISTINCT ec.session_id) FILTER (WHERE ((ec.event_name)::text = 'product_view'::text)) AS step_2_product_view,
            count(DISTINCT ec.session_id) FILTER (WHERE ((ec.event_name)::text = 'add_to_cart'::text)) AS step_3_add_to_cart,
            count(DISTINCT ec.session_id) FILTER (WHERE ((ec.event_name)::text = 'checkout_started'::text)) AS step_4_checkout_started,
            count(DISTINCT ec.session_id) FILTER (WHERE ((ec.event_name)::text = 'order_completed'::text)) AS step_5_order_completed
           FROM public.events_clean ec
          GROUP BY (date(ec.event_time)), ec.experiment_key, ec.experiment_variant
        )
 SELECT date AS "Дата",
    experiment_key AS "Эксперимент",
    experiment_variant AS "Вариант",
    step_1_page_view AS "1. Просмотр страницы",
    step_2_product_view AS "2. Просмотр товара",
    step_3_add_to_cart AS "3. Добавление в корзину",
    step_4_checkout_started AS "4. Начало оформления",
    step_5_order_completed AS "5. Завершение заказа",
    round(
        CASE
            WHEN (step_1_page_view > 0) THEN (((step_2_product_view)::numeric / (step_1_page_view)::numeric) * (100)::numeric)
            ELSE (0)::numeric
        END, 2) AS "1→2 (%)",
    round(
        CASE
            WHEN (step_2_product_view > 0) THEN (((step_3_add_to_cart)::numeric / (step_2_product_view)::numeric) * (100)::numeric)
            ELSE (0)::numeric
        END, 2) AS "2→3 (%)",
    round(
        CASE
            WHEN (step_3_add_to_cart > 0) THEN (((step_4_checkout_started)::numeric / (step_3_add_to_cart)::numeric) * (100)::numeric)
            ELSE (0)::numeric
        END, 2) AS "3→4 (%)",
    round(
        CASE
            WHEN (step_4_checkout_started > 0) THEN (((step_5_order_completed)::numeric / (step_4_checkout_started)::numeric) * (100)::numeric)
            ELSE (0)::numeric
        END, 2) AS "4→5 (%)",
    round(
        CASE
            WHEN (step_1_page_view > 0) THEN (((step_5_order_completed)::numeric / (step_1_page_view)::numeric) * (100)::numeric)
            ELSE (0)::numeric
        END, 2) AS "Общая конверсия (%)"
   FROM funnel_data
  ORDER BY date DESC;


ALTER VIEW public.v_analytics_funnel OWNER TO postgres;

--
-- Name: VIEW v_analytics_funnel; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.v_analytics_funnel IS 'Воронка конверсии с процентами между этапами';


--
-- Name: v_analytics_products; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_analytics_products AS
 SELECT id AS "ID товара",
    name AS "Название",
    category AS "Категория",
    tea_type AS "Тип чая",
    price_per_gram AS "Цена за грамм",
    out_of_stock AS "Нет в наличии",
    ( SELECT count(*) AS count
           FROM public.events_clean ec
          WHERE (((ec.event_name)::text = 'product_view'::text) AND (ec.product_id = p.id))) AS "Просмотров",
    ( SELECT count(*) AS count
           FROM public.events_clean ec
          WHERE (((ec.event_name)::text = 'add_to_cart'::text) AND (ec.product_id = p.id))) AS "Добавлений в корзину",
    ( SELECT count(*) AS count
           FROM public.orders o,
            LATERAL jsonb_array_elements((o.items)::jsonb) item(value)
          WHERE (((item.value ->> 'id'::text))::integer = p.id)) AS "Заказов",
    ( SELECT sum(((item.value ->> 'quantity'::text))::integer) AS sum
           FROM public.orders o,
            LATERAL jsonb_array_elements((o.items)::jsonb) item(value)
          WHERE (((item.value ->> 'id'::text))::integer = p.id)) AS "Продано (грамм/шт)",
    round(
        CASE
            WHEN (( SELECT count(*) AS count
               FROM public.events_clean ec
              WHERE (((ec.event_name)::text = 'product_view'::text) AND (ec.product_id = p.id))) > 0) THEN (((( SELECT count(*) AS count
               FROM public.events_clean ec
              WHERE (((ec.event_name)::text = 'add_to_cart'::text) AND (ec.product_id = p.id))))::numeric / (( SELECT count(*) AS count
               FROM public.events_clean ec
              WHERE (((ec.event_name)::text = 'product_view'::text) AND (ec.product_id = p.id))))::numeric) * (100)::numeric)
            ELSE (0)::numeric
        END, 2) AS "Конверсия просмотр→корзина (%)"
   FROM public.products p
  ORDER BY ( SELECT count(*) AS count
           FROM public.events_clean ec
          WHERE (((ec.event_name)::text = 'product_view'::text) AND (ec.product_id = p.id))) DESC NULLS LAST;


ALTER VIEW public.v_analytics_products OWNER TO postgres;

--
-- Name: VIEW v_analytics_products; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.v_analytics_products IS 'Товары с метриками просмотров и продаж';


--
-- Name: v_analytics_retention; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_analytics_retention AS
 SELECT cohort_date AS "Дата когорты",
    count(DISTINCT user_id) AS "Размер когорты",
    count(DISTINCT user_id) FILTER (WHERE day_0) AS "День 0",
    count(DISTINCT user_id) FILTER (WHERE day_1) AS "День 1",
    count(DISTINCT user_id) FILTER (WHERE day_7) AS "День 7",
    count(DISTINCT user_id) FILTER (WHERE day_30) AS "День 30",
    round((((count(DISTINCT user_id) FILTER (WHERE day_1))::numeric / (NULLIF(count(DISTINCT user_id), 0))::numeric) * (100)::numeric), 2) AS "Retention День 1 (%)",
    round((((count(DISTINCT user_id) FILTER (WHERE day_7))::numeric / (NULLIF(count(DISTINCT user_id), 0))::numeric) * (100)::numeric), 2) AS "Retention День 7 (%)",
    round((((count(DISTINCT user_id) FILTER (WHERE day_30))::numeric / (NULLIF(count(DISTINCT user_id), 0))::numeric) * (100)::numeric), 2) AS "Retention День 30 (%)",
    EXTRACT(year FROM cohort_date) AS "Год",
    EXTRACT(month FROM cohort_date) AS "Месяц",
    to_char((cohort_date)::timestamp with time zone, 'YYYY-MM'::text) AS "Год-Месяц"
   FROM public.user_retention ur
  GROUP BY cohort_date
  ORDER BY cohort_date DESC;


ALTER VIEW public.v_analytics_retention OWNER TO postgres;

--
-- Name: VIEW v_analytics_retention; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.v_analytics_retention IS 'Retention анализ по когортам';


--
-- Name: v_analytics_sessions; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_analytics_sessions AS
 SELECT s.session_id AS "ID сессии",
    s.user_id AS "ID пользователя",
    u.name AS "Имя пользователя",
    s.first_event_time AS "Начало сессии",
    s.last_event_time AS "Конец сессии",
    s.session_length_sec AS "Длительность (сек)",
    round(((s.session_length_sec)::numeric / 60.0), 2) AS "Длительность (мин)",
    s.events_count AS "Количество событий",
    s.landing_page AS "Посадочная страница",
    s.exit_page AS "Страница выхода",
    s.page_views_count AS "Просмотров страниц",
    s.add_to_cart_count AS "Добавлений в корзину",
    s.checkout_started AS "Начал оформление",
    s.order_completed AS "Завершил заказ",
    s.experiment_key AS "Ключ эксперимента",
    s.experiment_variant AS "Вариант эксперимента",
    s.device_type AS "Тип устройства",
    s.referrer AS "Источник перехода",
    date(s.first_event_time) AS "Дата",
    EXTRACT(year FROM s.first_event_time) AS "Год",
    EXTRACT(month FROM s.first_event_time) AS "Месяц",
    EXTRACT(day FROM s.first_event_time) AS "День",
    EXTRACT(dow FROM s.first_event_time) AS "День недели",
    EXTRACT(hour FROM s.first_event_time) AS "Час",
    to_char(s.first_event_time, 'YYYY-MM'::text) AS "Год-Месяц"
   FROM (public.sessions s
     LEFT JOIN public.users u ON (((s.user_id)::text = (u.id)::text)))
  ORDER BY s.first_event_time DESC;


ALTER VIEW public.v_analytics_sessions OWNER TO postgres;

--
-- Name: VIEW v_analytics_sessions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.v_analytics_sessions IS 'Сессии пользователей для аналитики';


--
-- Name: v_analytics_users; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_analytics_users AS
 SELECT id AS "ID пользователя",
    name AS "Имя",
    email AS "Email",
    phone AS "Телефон",
    phone_verified AS "Телефон подтверждён",
    xp AS "Опыт (XP)",
        CASE
            WHEN (xp >= 15000) THEN 'Мастер'::text
            WHEN (xp >= 7000) THEN 'Эксперт'::text
            WHEN (xp >= 3000) THEN 'Знаток'::text
            ELSE 'Новичок'::text
        END AS "Уровень лояльности",
    first_order_discount_used AS "Использовал скидку за первый зака",
    custom_discount AS "Индивидуальная скидка (%)",
    wallet_balance AS "Баланс кошелька (коп)",
    round(((wallet_balance)::numeric / 100.0), 2) AS "Баланс кошелька (руб)",
    ( SELECT count(*) AS count
           FROM public.orders o
          WHERE ((o.user_id)::text = (u.id)::text)) AS "Количество заказов",
    ( SELECT sum(o.total) AS sum
           FROM public.orders o
          WHERE (((o.user_id)::text = (u.id)::text) AND (o.status = 'paid'::text))) AS "Общая сумма заказов",
    ( SELECT min(o.created_at) AS min
           FROM public.orders o
          WHERE ((o.user_id)::text = (u.id)::text)) AS "Первый заказ",
    ( SELECT max(o.created_at) AS max
           FROM public.orders o
          WHERE ((o.user_id)::text = (u.id)::text)) AS "Последний заказ",
    ( SELECT min(ec.event_time) AS min
           FROM public.events_clean ec
          WHERE ((ec.user_id)::text = (u.id)::text)) AS "Первое посещение",
    ( SELECT max(ec.event_time) AS max
           FROM public.events_clean ec
          WHERE ((ec.user_id)::text = (u.id)::text)) AS "Последнее посещение",
    ( SELECT count(DISTINCT ec.session_id) AS count
           FROM public.events_clean ec
          WHERE ((ec.user_id)::text = (u.id)::text)) AS "Количество сессий"
   FROM public.users u
  ORDER BY xp DESC;


ALTER VIEW public.v_analytics_users OWNER TO postgres;

--
-- Name: VIEW v_analytics_users; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.v_analytics_users IS 'Пользователи с метриками для аналитики';


--
-- Name: wallet_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wallet_transactions (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    type text NOT NULL,
    amount integer NOT NULL,
    description text NOT NULL,
    payment_id text,
    order_id integer,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.wallet_transactions OWNER TO postgres;

--
-- Name: wallet_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.wallet_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.wallet_transactions_id_seq OWNER TO postgres;

--
-- Name: wallet_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.wallet_transactions_id_seq OWNED BY public.wallet_transactions.id;


--
-- Name: xp_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.xp_transactions (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    amount integer NOT NULL,
    reason character varying NOT NULL,
    description text,
    order_id integer,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.xp_transactions OWNER TO postgres;

--
-- Name: xp_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.xp_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.xp_transactions_id_seq OWNER TO postgres;

--
-- Name: xp_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.xp_transactions_id_seq OWNED BY public.xp_transactions.id;


--
-- Name: ab_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ab_events ALTER COLUMN id SET DEFAULT nextval('public.ab_events_id_seq'::regclass);


--
-- Name: app_waitlist id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_waitlist ALTER COLUMN id SET DEFAULT nextval('public.app_waitlist_id_seq'::regclass);


--
-- Name: cart_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cart_items ALTER COLUMN id SET DEFAULT nextval('public.cart_items_id_seq'::regclass);


--
-- Name: device_user_mappings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_user_mappings ALTER COLUMN id SET DEFAULT nextval('public.device_user_mappings_id_seq'::regclass);


--
-- Name: etl_runs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etl_runs ALTER COLUMN id SET DEFAULT nextval('public.etl_runs_id_seq'::regclass);


--
-- Name: events_clean id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events_clean ALTER COLUMN id SET DEFAULT nextval('public.events_clean_id_seq'::regclass);


--
-- Name: experiments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.experiments ALTER COLUMN id SET DEFAULT nextval('public.experiments_id_seq'::regclass);


--
-- Name: info_banners id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.info_banners ALTER COLUMN id SET DEFAULT nextval('public.info_banners_id_seq'::regclass);


--
-- Name: magic_links id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.magic_links ALTER COLUMN id SET DEFAULT nextval('public.magic_links_id_seq'::regclass);


--
-- Name: media id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media ALTER COLUMN id SET DEFAULT nextval('public.media_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: pending_telegram_orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pending_telegram_orders ALTER COLUMN id SET DEFAULT nextval('public.pending_telegram_orders_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: raw_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.raw_events ALTER COLUMN id SET DEFAULT nextval('public.raw_events_id_seq'::regclass);


--
-- Name: saved_addresses id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.saved_addresses ALTER COLUMN id SET DEFAULT nextval('public.saved_addresses_id_seq'::regclass);


--
-- Name: settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.settings ALTER COLUMN id SET DEFAULT nextval('public.settings_id_seq'::regclass);


--
-- Name: site_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_settings ALTER COLUMN id SET DEFAULT nextval('public.site_settings_id_seq'::regclass);


--
-- Name: sms_verifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_verifications ALTER COLUMN id SET DEFAULT nextval('public.sms_verifications_id_seq'::regclass);


--
-- Name: tea_types id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tea_types ALTER COLUMN id SET DEFAULT nextval('public.tea_types_id_seq'::regclass);


--
-- Name: telegram_cart id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.telegram_cart ALTER COLUMN id SET DEFAULT nextval('public.telegram_cart_id_seq'::regclass);


--
-- Name: telegram_profiles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.telegram_profiles ALTER COLUMN id SET DEFAULT nextval('public.telegram_profiles_id_seq'::regclass);


--
-- Name: telegram_questions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.telegram_questions ALTER COLUMN id SET DEFAULT nextval('public.telegram_questions_id_seq'::regclass);


--
-- Name: tv_slides id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tv_slides ALTER COLUMN id SET DEFAULT nextval('public.tv_slides_id_seq'::regclass);


--
-- Name: wallet_transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallet_transactions ALTER COLUMN id SET DEFAULT nextval('public.wallet_transactions_id_seq'::regclass);


--
-- Name: xp_transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.xp_transactions ALTER COLUMN id SET DEFAULT nextval('public.xp_transactions_id_seq'::regclass);


--
-- Data for Name: ab_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ab_events (id, event_type, "timestamp", user_identifier, user_id, device_id, test_assignments, event_data) FROM stdin;
1	page_view	2026-01-26 20:48:06.078425+00	dev_370ae17b-bdae-4b4b-907a-8072bd692f69	\N	dev_370ae17b-bdae-4b4b-907a-8072bd692f69	{}	{"url":"/"}
2	page_view	2026-01-26 21:09:23.420142+00	dev_70c4008c-4eb5-4bb2-9b3c-a0aa99eb28c5	\N	dev_70c4008c-4eb5-4bb2-9b3c-a0aa99eb28c5	{}	{"url":"/"}
3	page_view	2026-01-27 05:06:44.516228+00	dev_5ce894b9-4da5-4cee-bc04-88c3f012591d	\N	dev_5ce894b9-4da5-4cee-bc04-88c3f012591d	{}	{"url":"/"}
4	page_view	2026-01-27 05:12:08.593484+00	dev_b281bf95-dfad-4724-8ad5-26b768d67a50	\N	dev_b281bf95-dfad-4724-8ad5-26b768d67a50	{}	{"url":"/"}
5	page_view	2026-01-27 05:35:35.826902+00	dev_e7ec0803-96cc-4f6b-be82-ffe83beaf30c	\N	dev_e7ec0803-96cc-4f6b-be82-ffe83beaf30c	{}	{"url":"/"}
6	page_view	2026-01-27 06:24:00.783376+00	dev_42ee4ba8-aed9-4473-bdfd-3a2e5e3b6df3	\N	dev_42ee4ba8-aed9-4473-bdfd-3a2e5e3b6df3	{}	{"url":"/"}
7	page_view	2026-01-27 07:01:20.298409+00	dev_76742cbb-8ea5-40f1-a9c7-1dca4f11b522	\N	dev_76742cbb-8ea5-40f1-a9c7-1dca4f11b522	{}	{"url":"/"}
8	page_view	2026-01-27 07:10:34.668138+00	dev_bc460e66-8284-4078-b73c-f9f938f3a722	\N	dev_bc460e66-8284-4078-b73c-f9f938f3a722	{}	{"url":"/"}
9	page_view	2026-01-27 07:20:43.243161+00	dev_cb43a8a9-9e29-4a66-a715-9754761d5768	\N	dev_cb43a8a9-9e29-4a66-a715-9754761d5768	{}	{"url":"/"}
10	page_view	2026-01-27 07:50:21.687529+00	dev_f3e70d10-0857-4546-8d80-db629fd19e57	\N	dev_f3e70d10-0857-4546-8d80-db629fd19e57	{}	{"url":"/"}
11	page_view	2026-01-27 08:25:56.800214+00	dev_d0a2cbdf-a7f4-40de-8763-a2dfb1043931	\N	dev_d0a2cbdf-a7f4-40de-8763-a2dfb1043931	{}	{"url":"/"}
12	page_view	2026-01-27 08:27:11.018633+00	dev_d0a2cbdf-a7f4-40de-8763-a2dfb1043931	\N	dev_d0a2cbdf-a7f4-40de-8763-a2dfb1043931	{}	{"url":"/"}
13	page_view	2026-01-27 08:59:30.117759+00	dev_1926696e-2532-4324-a47b-332177dded56	\N	dev_1926696e-2532-4324-a47b-332177dded56	{}	{"url":"/"}
14	page_view	2026-01-27 09:00:53.414229+00	dev_1a8599b9-7965-4166-b89e-ce8e02853c49	\N	dev_1a8599b9-7965-4166-b89e-ce8e02853c49	{}	{"url":"/"}
15	page_view	2026-01-27 09:03:46.735834+00	dev_4e498c0b-5a9b-4f58-a65d-cd37ad80dc79	\N	dev_4e498c0b-5a9b-4f58-a65d-cd37ad80dc79	{}	{"url":"/"}
16	page_view	2026-01-27 09:08:19.358365+00	dev_2527f3bf-2ab4-4f88-bf52-9c55dba56ada	\N	dev_2527f3bf-2ab4-4f88-bf52-9c55dba56ada	{}	{"url":"/"}
17	page_view	2026-01-27 09:24:36.274397+00	dev_08c80796-8517-4d12-9c54-6017ee75ebb1	\N	dev_08c80796-8517-4d12-9c54-6017ee75ebb1	{}	{"url":"/"}
18	page_view	2026-01-30 06:54:37.937036+00	dev_f2209a7b-26dd-43b7-a9e5-6c0352040234	\N	dev_f2209a7b-26dd-43b7-a9e5-6c0352040234	{}	{"url":"/"}
19	page_view	2026-01-30 06:56:18.936886+00	dev_bde536dc-9ca9-4bae-91ae-c68b5fed05dd	\N	dev_bde536dc-9ca9-4bae-91ae-c68b5fed05dd	{}	{"url":"/"}
20	add_to_cart	2026-01-30 06:56:52.369805+00	dev_bde536dc-9ca9-4bae-91ae-c68b5fed05dd	\N	dev_bde536dc-9ca9-4bae-91ae-c68b5fed05dd	{}	{"productId":4,"productName":"Шу Пуэр Мэнхай 2018","basePrice":15.5,"priceMultiplier":1,"finalPrice":16,"quantity":25}
21	page_view	2026-01-30 06:57:17.058217+00	dev_0f458e59-3cc3-4ab9-b008-b0951ac6ef15	\N	dev_0f458e59-3cc3-4ab9-b008-b0951ac6ef15	{}	{"url":"/"}
22	add_to_cart	2026-01-30 06:58:23.672081+00	dev_0f458e59-3cc3-4ab9-b008-b0951ac6ef15	\N	dev_0f458e59-3cc3-4ab9-b008-b0951ac6ef15	{}	{"productId":5,"productName":"Шэн Пуэр Дикие деревья","basePrice":28,"priceMultiplier":1,"finalPrice":28,"quantity":25}
23	page_view	2026-01-30 07:07:10.995423+00	dev_a229b461-13c6-43c9-bfdf-3655a29e24f3	\N	dev_a229b461-13c6-43c9-bfdf-3655a29e24f3	{}	{"url":"/"}
24	page_view	2026-01-30 07:48:49.401465+00	dev_92588737-74ad-441f-91bb-6a2bd51e83dd	\N	dev_92588737-74ad-441f-91bb-6a2bd51e83dd	{}	{"url":"/"}
25	page_view	2026-01-30 07:52:50.187706+00	dev_af63da12-edf1-4d07-b318-d52e759e0b93	\N	dev_af63da12-edf1-4d07-b318-d52e759e0b93	{}	{"url":"/"}
26	page_view	2026-01-30 07:54:21.446529+00	dev_726ab8be-9b4a-4bef-a465-1cde99c5e78e	\N	dev_726ab8be-9b4a-4bef-a465-1cde99c5e78e	{}	{"url":"/"}
27	page_view	2026-01-30 07:54:43.158233+00	dev_726ab8be-9b4a-4bef-a465-1cde99c5e78e	\N	dev_726ab8be-9b4a-4bef-a465-1cde99c5e78e	{}	{"url":"/"}
28	page_view	2026-01-30 07:55:31.331474+00	dev_5b4087f4-fb45-42a7-bfad-7f72700bfed4	\N	dev_5b4087f4-fb45-42a7-bfad-7f72700bfed4	{}	{"url":"/"}
29	page_view	2026-01-30 07:55:58.961835+00	dev_5b4087f4-fb45-42a7-bfad-7f72700bfed4	\N	dev_5b4087f4-fb45-42a7-bfad-7f72700bfed4	{}	{"url":"/"}
30	page_view	2026-01-30 08:03:11.40005+00	dev_a229b461-13c6-43c9-bfdf-3655a29e24f3	\N	dev_a229b461-13c6-43c9-bfdf-3655a29e24f3	{}	{"url":"/"}
31	page_view	2026-01-30 08:08:24.571312+00	dev_12c402f2-cc01-4e9a-aebf-f32cdffaa7d1	\N	dev_12c402f2-cc01-4e9a-aebf-f32cdffaa7d1	{}	{"url":"/"}
32	page_view	2026-01-30 08:09:15.660277+00	dev_12c402f2-cc01-4e9a-aebf-f32cdffaa7d1	\N	dev_12c402f2-cc01-4e9a-aebf-f32cdffaa7d1	{}	{"url":"/"}
33	page_view	2026-01-30 08:14:09.866013+00	dev_a229b461-13c6-43c9-bfdf-3655a29e24f3	\N	dev_a229b461-13c6-43c9-bfdf-3655a29e24f3	{}	{"url":"/"}
34	page_view	2026-01-30 08:15:23.931967+00	dev_723efa0d-8f0b-4ecd-a6a3-c01d34cbe76f	\N	dev_723efa0d-8f0b-4ecd-a6a3-c01d34cbe76f	{}	{"url":"/"}
35	page_view	2026-01-30 08:15:48.480965+00	dev_a229b461-13c6-43c9-bfdf-3655a29e24f3	\N	dev_a229b461-13c6-43c9-bfdf-3655a29e24f3	{}	{"url":"/"}
36	page_view	2026-01-31 03:43:56.910287+00	dev_961a870e-87d7-4132-a2b9-7c77069264b0	\N	dev_961a870e-87d7-4132-a2b9-7c77069264b0	{}	{"url":"/"}
37	page_view	2026-01-31 03:45:21.019484+00	dev_e16b7b60-303d-4e19-9d2a-4a8ecc675fa2	\N	dev_e16b7b60-303d-4e19-9d2a-4a8ecc675fa2	{}	{"url":"/"}
38	page_view	2026-01-31 03:45:58.68194+00	dev_e16b7b60-303d-4e19-9d2a-4a8ecc675fa2	\N	dev_e16b7b60-303d-4e19-9d2a-4a8ecc675fa2	{}	{"url":"/"}
39	page_view	2026-01-31 03:46:48.20165+00	dev_e16b7b60-303d-4e19-9d2a-4a8ecc675fa2	\N	dev_e16b7b60-303d-4e19-9d2a-4a8ecc675fa2	{}	{"url":"/"}
40	page_view	2026-01-31 03:47:20.160981+00	dev_e16b7b60-303d-4e19-9d2a-4a8ecc675fa2	\N	dev_e16b7b60-303d-4e19-9d2a-4a8ecc675fa2	{}	{"url":"/"}
41	page_view	2026-01-31 04:33:22.224076+00	dev_cf36c751-6a72-4b07-bed6-8d27741bee80	\N	dev_cf36c751-6a72-4b07-bed6-8d27741bee80	{}	{"url":"/"}
42	page_view	2026-01-31 04:36:30.22101+00	dev_a229b461-13c6-43c9-bfdf-3655a29e24f3	\N	dev_a229b461-13c6-43c9-bfdf-3655a29e24f3	{}	{"url":"/"}
43	add_to_cart	2026-01-31 04:37:09.993481+00	dev_a229b461-13c6-43c9-bfdf-3655a29e24f3	\N	dev_a229b461-13c6-43c9-bfdf-3655a29e24f3	{}	{"productId":4,"productName":"Шу Пуэр Мэнхай 2018","basePrice":15.5,"priceMultiplier":1,"finalPrice":16,"quantity":25}
44	page_view	2026-01-31 04:59:45.549244+00	dev_a229b461-13c6-43c9-bfdf-3655a29e24f3	\N	dev_a229b461-13c6-43c9-bfdf-3655a29e24f3	{}	{"url":"/"}
45	page_view	2026-01-31 05:20:41.06372+00	dev_064b8c72-592b-4f23-80e7-95e8494ed317	\N	dev_064b8c72-592b-4f23-80e7-95e8494ed317	{}	{"url":"/"}
46	page_view	2026-01-31 05:33:47.716673+00	dev_a229b461-13c6-43c9-bfdf-3655a29e24f3	\N	dev_a229b461-13c6-43c9-bfdf-3655a29e24f3	{}	{"url":"/"}
47	page_view	2026-01-31 05:50:41.030874+00	dev_a229b461-13c6-43c9-bfdf-3655a29e24f3	\N	dev_a229b461-13c6-43c9-bfdf-3655a29e24f3	{}	{"url":"/"}
48	page_view	2026-01-31 05:52:02.409511+00	dev_f12ca400-6434-4d75-81e5-989d7fb9ed6f	\N	dev_f12ca400-6434-4d75-81e5-989d7fb9ed6f	{}	{"url":"/"}
49	page_view	2026-01-31 05:52:54.032936+00	dev_a229b461-13c6-43c9-bfdf-3655a29e24f3	\N	dev_a229b461-13c6-43c9-bfdf-3655a29e24f3	{}	{"url":"/"}
50	page_view	2026-01-31 05:56:54.311231+00	dev_a229b461-13c6-43c9-bfdf-3655a29e24f3	\N	dev_a229b461-13c6-43c9-bfdf-3655a29e24f3	{}	{"url":"/"}
51	page_view	2026-02-01 07:36:29.721307+00	dev_1217a30a-c810-47b7-bafa-2bd627cd89b6	\N	dev_1217a30a-c810-47b7-bafa-2bd627cd89b6	{}	{"url":"/"}
52	page_view	2026-02-06 14:17:05.383721+00	dev_11f87fbe-9f86-4bab-bf3c-5853b63f384e	\N	dev_11f87fbe-9f86-4bab-bf3c-5853b63f384e	{}	{"url":"/"}
53	page_view	2026-02-06 14:27:35.925528+00	dev_a229b461-13c6-43c9-bfdf-3655a29e24f3	\N	dev_a229b461-13c6-43c9-bfdf-3655a29e24f3	{}	{"url":"/"}
54	page_view	2026-03-01 21:06:06.966123+00	dev_f87f270c-6385-469f-b3de-942924ea1eae	\N	dev_f87f270c-6385-469f-b3de-942924ea1eae	{}	{"url":"/"}
55	page_view	2026-03-01 21:12:37.965234+00	dev_98393efe-ca96-4aca-abdb-5d39c94d0b57	\N	dev_98393efe-ca96-4aca-abdb-5d39c94d0b57	{}	{"url":"/"}
56	page_view	2026-03-01 21:43:56.000857+00	dev_2f2e08ec-30a5-4329-ae5e-920b07a9e789	\N	dev_2f2e08ec-30a5-4329-ae5e-920b07a9e789	{}	{"url":"/"}
57	page_view	2026-03-01 21:45:27.108928+00	dev_a59dc8eb-0c92-482d-b53e-a277d9a0f5d8	\N	dev_a59dc8eb-0c92-482d-b53e-a277d9a0f5d8	{}	{"url":"/"}
58	page_view	2026-03-02 01:05:50.731182+00	dev_b0e23cae-0618-4a4b-a7e2-b2218a08cf68	\N	dev_b0e23cae-0618-4a4b-a7e2-b2218a08cf68	{}	{"url":"/"}
59	page_view	2026-03-02 01:08:46.076836+00	dev_a229b461-13c6-43c9-bfdf-3655a29e24f3	\N	dev_a229b461-13c6-43c9-bfdf-3655a29e24f3	{}	{"url":"/"}
60	page_view	2026-03-12 18:10:18.215054+00	dev_951fa092-f0f9-4f2d-a9c4-6604a23cff36	\N	dev_951fa092-f0f9-4f2d-a9c4-6604a23cff36	{}	{"url":"/"}
61	page_view	2026-03-12 18:13:09.122645+00	dev_0b88add6-ec7f-4320-874d-720e82c7609d	\N	dev_0b88add6-ec7f-4320-874d-720e82c7609d	{}	{"url":"/"}
62	page_view	2026-03-13 23:57:40.519477+00	dev_6cf59db5-4de5-43dc-a93c-3bb2a3fcdd20	\N	dev_6cf59db5-4de5-43dc-a93c-3bb2a3fcdd20	{}	{"url":"/"}
63	page_view	2026-04-10 13:06:02.646072+00	dev_844c34a0-b6c5-43cc-91df-0113e75bbd34	\N	dev_844c34a0-b6c5-43cc-91df-0113e75bbd34	{}	{"url":"/"}
64	page_view	2026-04-10 13:17:57.057125+00	dev_9a5e3837-01bc-4696-a3cb-ac605b1c0c3d	\N	dev_9a5e3837-01bc-4696-a3cb-ac605b1c0c3d	{}	{"url":"/"}
65	add_to_cart	2026-04-10 13:18:39.21417+00	dev_9a5e3837-01bc-4696-a3cb-ac605b1c0c3d	\N	dev_9a5e3837-01bc-4696-a3cb-ac605b1c0c3d	{}	{"productId":4,"productName":"Шу Пуэр Мэнхай 2018","basePrice":15.5,"priceMultiplier":1,"finalPrice":14.4,"quantity":100}
66	page_view	2026-04-26 03:29:23.719425+00	dev_6c852a99-85ff-49c3-8f82-476ddec2dcd5	\N	dev_6c852a99-85ff-49c3-8f82-476ddec2dcd5	{}	{"url":"/"}
67	page_view	2026-04-26 03:30:37.937094+00	dev_6b5fff9a-e5ad-4ef9-9f8a-75b80dd28b8a	\N	dev_6b5fff9a-e5ad-4ef9-9f8a-75b80dd28b8a	{}	{"url":"/"}
68	page_view	2026-04-26 03:46:40.539702+00	dev_a229b461-13c6-43c9-bfdf-3655a29e24f3	\N	dev_a229b461-13c6-43c9-bfdf-3655a29e24f3	{}	{"url":"/"}
69	page_view	2026-04-26 04:08:40.27215+00	dev_8d9d014c-1fad-44e6-93f0-b53fda030654	\N	dev_8d9d014c-1fad-44e6-93f0-b53fda030654	{}	{"url":"/"}
70	page_view	2026-05-04 14:29:14.971215+00	dev_24c0e400-1940-42df-86d0-1d5a4150a273	\N	dev_24c0e400-1940-42df-86d0-1d5a4150a273	{}	{"url":"/"}
71	page_view	2026-05-04 15:02:41.927771+00	dev_ad194fc4-d3ca-4ad2-987c-fed68c0cdd66	\N	dev_ad194fc4-d3ca-4ad2-987c-fed68c0cdd66	{}	{"url":"/"}
72	page_view	2026-05-27 11:19:30.398317+00	dev_4805e1a6-a304-4aac-a2ce-c5e6b15f049b	\N	dev_4805e1a6-a304-4aac-a2ce-c5e6b15f049b	{}	{"url":"/"}
73	page_view	2026-05-27 11:36:35.278351+00	dev_d1eb6897-8a69-42d0-a671-ce3a8388db3e	\N	dev_d1eb6897-8a69-42d0-a671-ce3a8388db3e	{}	{"url":"/"}
74	page_view	2026-05-28 13:44:25.113083+00	dev_6e2029b9-b05a-4b55-87b9-5505e4526d87	\N	dev_6e2029b9-b05a-4b55-87b9-5505e4526d87	{}	{"url":"/"}
\.


--
-- Data for Name: app_waitlist; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.app_waitlist (id, name, phone, telegram, email, consent, created_at, survey_q1, survey_q2, survey_q3, survey_q4, survey_q4_custom, survey_q5, survey_q5_custom) FROM stdin;
1	Тест Пользователь	+79991234567	@testuser	test@example.com	t	2026-03-12 18:13:30.068772+00	\N	\N	\N	\N	\N	\N	\N
2	Тест	+79991234567	\N	\N	t	2026-04-26 03:31:29.610806+00	1 раз	Дома	Скорее да	Свой вариант	\N	Свой вариант	\N
\.


--
-- Data for Name: cart_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cart_items (id, user_id, product_id, quantity, added_at, price_per_unit) FROM stdin;
99	209e1694-ce83-4a8a-8b72-f33438a7e66a	7	100	2025-12-27 20:31:04.723186+00	31.5
100	209e1694-ce83-4a8a-8b72-f33438a7e66a	5	25	2025-12-27 20:50:20.029946+00	28
\.


--
-- Data for Name: daily_stats; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.daily_stats (date, total_users, new_users, active_users, total_sessions, total_events, total_orders, total_revenue, avg_session_length_sec, avg_order_value, updated_at) FROM stdin;
2026-02-05	0	4	4	5	15	1	350	118.0000000000000000	350.0000000000000000	2026-02-05 12:40:26.675664+00
\.


--
-- Data for Name: device_user_mappings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.device_user_mappings (id, device_id, user_id, created_at) FROM stdin;
\.


--
-- Data for Name: etl_runs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.etl_runs (id, job_name, start_time, end_time, status, rows_processed, error_message, metadata) FROM stdin;
1	process_sessions	2026-02-05 12:40:26.448006+00	2026-02-05 12:40:26.448006+00	success	5	\N	\N
2	process_events_clean	2026-02-05 12:40:26.562086+00	2026-02-05 12:40:26.562086+00	success	15	\N	\N
3	aggregate_daily_stats	2026-02-05 12:40:26.675664+00	2026-02-05 12:40:26.675664+00	success	1	\N	{"date": "2026-02-05"}
\.


--
-- Data for Name: events_clean; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.events_clean (id, event_time, user_id, session_id, event_name, source, page, experiment_key, experiment_variant, user_name, user_loyalty_level, product_id, product_name, order_id, order_total, properties, processed_at) FROM stdin;
1	2026-02-05 10:40:26.230726+00	test-user-1	sess_test_1	page_view	frontend	/	pricing-test	control	\N	1	\N	\N	\N	\N	{"referrer": "google.com"}	2026-02-05 12:40:26.562086+00
2	2026-02-05 10:40:31.230726+00	test-user-1	sess_test_1	product_view	frontend	/products/123	pricing-test	control	\N	1	123	Зелёный чай	\N	\N	{"product_id": 123, "product_name": "Зелёный чай"}	2026-02-05 12:40:26.562086+00
3	2026-02-05 10:40:56.230726+00	test-user-1	sess_test_1	add_to_cart	frontend	/products/123	pricing-test	control	\N	1	123	\N	\N	\N	{"quantity": 50, "product_id": 123}	2026-02-05 12:40:26.562086+00
4	2026-02-05 10:42:26.230726+00	test-user-1	sess_test_1	checkout_started	frontend	/checkout	pricing-test	control	\N	1	\N	\N	\N	\N	{"cart_total": 350}	2026-02-05 12:40:26.562086+00
5	2026-02-05 10:45:26.230726+00	test-user-1	sess_test_1	order_completed	frontend	/success	pricing-test	control	\N	1	\N	\N	1001	350	{"order_id": 1001, "order_total": 350}	2026-02-05 12:40:26.562086+00
6	2026-02-05 11:40:26.230726+00	test-user-2	sess_test_2	page_view	frontend	/	pricing-test	variant-b	\N	1	\N	\N	\N	\N	{"referrer": "direct"}	2026-02-05 12:40:26.562086+00
7	2026-02-05 11:40:36.230726+00	test-user-2	sess_test_2	product_view	frontend	/products/456	pricing-test	variant-b	\N	1	456	Чёрный чай	\N	\N	{"product_id": 456, "product_name": "Чёрный чай"}	2026-02-05 12:40:26.562086+00
8	2026-02-05 11:41:11.230726+00	test-user-2	sess_test_2	add_to_cart	frontend	/products/456	pricing-test	variant-b	\N	1	456	\N	\N	\N	{"quantity": 100, "product_id": 456}	2026-02-05 12:40:26.562086+00
9	2026-02-05 11:41:26.230726+00	test-user-2	sess_test_2	checkout_started	frontend	/checkout	pricing-test	variant-b	\N	1	\N	\N	\N	\N	{"cart_total": 450}	2026-02-05 12:40:26.562086+00
10	2026-02-05 12:10:26.230726+00	\N	sess_test_3	page_view	frontend	/	\N	\N	\N	1	\N	\N	\N	\N	{"referrer": "yandex.ru"}	2026-02-05 12:40:26.562086+00
11	2026-02-05 12:10:41.230726+00	\N	sess_test_3	product_view	frontend	/products/789	\N	\N	\N	1	789	Белый чай	\N	\N	{"product_id": 789, "product_name": "Белый чай"}	2026-02-05 12:40:26.562086+00
12	2026-02-05 09:40:26.230726+00	test-user-3	sess_test_4	page_view	frontend	/	pricing-test	control	\N	1	\N	\N	\N	\N	{}	2026-02-05 12:40:26.562086+00
13	2026-02-05 09:40:26.230726+00	test-user-3	sess_test_4	product_view	frontend	/products/123	pricing-test	control	\N	1	123	\N	\N	\N	{"product_id": 123}	2026-02-05 12:40:26.562086+00
14	2026-02-05 08:40:26.230726+00	test-user-4	sess_test_5	page_view	frontend	/	pricing-test	variant-b	\N	1	\N	\N	\N	\N	{}	2026-02-05 12:40:26.562086+00
15	2026-02-05 08:40:26.230726+00	test-user-4	sess_test_5	search_performed	frontend	/	pricing-test	variant-b	\N	1	\N	\N	\N	\N	{"query": "зелёный чай", "results_count": 5}	2026-02-05 12:40:26.562086+00
\.


--
-- Data for Name: experiment_metrics_daily; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.experiment_metrics_daily (date, experiment_key, experiment_variant, users_count, new_users_count, returning_users_count, sessions_count, avg_session_length_sec, events_count, page_views_count, add_to_cart_count, checkout_started_count, orders_count, orders_total_amount, conversion_rate, avg_order_value, updated_at) FROM stdin;
\.


--
-- Data for Name: experiments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.experiments (id, test_id, name, description, status, variants, created_at, updated_at, target_user_ids) FROM stdin;
\.


--
-- Data for Name: info_banners; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.info_banners (id, title, description, icon, theme, buttons, desktop_slot, mobile_slot, desktop_order, mobile_order, hide_on_desktop, hide_on_mobile, is_active, created_at, between_row_index_desktop, between_row_index_mobile, width_variant, height_variant) FROM stdin;
2	Гарантия	Прямые поставки из Китая, обеспечивающие высочайшее качество чайного листа	Shield	dark	\N	after_filters	after_filters	999	999	f	f	t	2025-12-24 14:41:20.252467+00	\N	\N	full	compact
1	Бесплатно доставляем при заказе от 2000 рублей	Отправляем чай в любой город через CDEK, Яндекс Доставку и WB Track. Способ и стоимость доставки рассчитывается после оформления заказа 	Truck	dark	\N	between_products	between_products	999	999	f	f	t	2025-12-11 22:42:28.119643+00	1	0	full	standard
\.


--
-- Data for Name: magic_links; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.magic_links (id, user_id, token_hash, channel, expires_at, consumed_at, created_at) FROM stdin;
1	209e1694-ce83-4a8a-8b72-f33438a7e66a	a55b462793d73ae40d7d15f666151ff095d95efc5b8c25f12c3984fa21b9df9e	telegram	2025-12-09T04:34:20.682Z	\N	2025-12-09 04:19:20.733484+00
2	209e1694-ce83-4a8a-8b72-f33438a7e66a	a459c4fe9931792634005cdf96d9bfca492db1dd155f526edf1f583dd681bdc8	telegram	2025-12-09T04:47:59.562Z	\N	2025-12-09 04:32:59.619689+00
3	209e1694-ce83-4a8a-8b72-f33438a7e66a	bceed16a5b47f5dba13dd72486b2f38e1a2228508d573e42baebd9212970c73d	telegram	2025-12-09T04:57:59.100Z	\N	2025-12-09 04:42:59.152155+00
4	209e1694-ce83-4a8a-8b72-f33438a7e66a	99813927e1739e05f7fac41f40d021ef6bd1c6537e72b7829234263ddaba60f3	telegram	2025-12-09T05:45:55.849Z	\N	2025-12-09 05:30:55.901+00
\.


--
-- Data for Name: media; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.media (id, product_id, type, title, description, source, source_type, thumbnail, featured, display_order, created_at, updated_at) FROM stdin;
1	4	image	\N	\N	/public/media/f59d642e-8c91-45f1-8507-3f5305565564.webp	file	\N	t	0	2026-01-27 09:09:51.714645+00	2026-01-27 09:09:51.714645+00
2	18	image	\N	\N	/public/media/f1bd5a87-8d96-43b6-9fb6-121d36f367e7.webp	file	\N	t	0	2026-01-27 09:27:36.02326+00	2026-01-27 09:27:36.02326+00
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (id, user_id, name, email, phone, address, comment, items, total, created_at, status, used_first_order_discount, payment_id, payment_status, payment_url, receipt_email, receipt_url, receipt_sms_sent, telegram_chat_id) FROM stdin;
2	d36c5271-440e-46a3-b9f7-4ebab6fcb33d	Hermes	semen.learning@gmail.com	+79168257455	chatgpt 4.0 chatgpt 4.1, https://ai.yandex-team.ru (внутренний ресурс для сотрудников Яндекса)		[{"id":5,"name":"Шэн Пуэр Дикие деревья","pricePerGram":28,"quantity":50}]	1400	2025-10-15 19:16:09.883466+00	pending	f	\N	\N	\N	\N	\N	f	\N
26	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, конечная		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 19:12:45.887505+00	pending	f	\N	\N	\N	\N	\N	f	\N
8	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	570	2025-11-20 15:43:02.862665+00	pending	f	\N	\N	\N	\N	\N	f	\N
9	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 16:26:08.495659+00	pending	f	\N	\N	\N	\N	\N	f	\N
10	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений тест	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 16:34:25.53948+00	pending	f	\N	\N	\N	\N	\N	f	\N
11	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений тест	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 16:37:29.808429+00	pending	f	\N	\N	\N	\N	\N	f	\N
12	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений test	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 16:47:53.656716+00	pending	f	\N	\N	\N	\N	\N	f	\N
13	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений тест	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 16:53:32.050223+00	pending	f	\N	\N	\N	\N	\N	f	\N
14	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений тесто	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 17:02:05.193341+00	pending	f	\N	\N	\N	\N	\N	f	\N
15	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений тест	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 17:09:55.369024+00	pending	f	\N	\N	\N	\N	\N	f	\N
6	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":4,"name":"Шу Пуэр Мэнхай 2018","pricePerGram":15.5,"quantity":25},{"id":5,"name":"Шэн Пуэр Дикие деревья","pricePerGram":28,"quantity":25}]	826.5	2025-11-05 21:14:56.079218+00	cancelled	t	\N	\N	\N	\N	\N	f	\N
7	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":4,"name":"Шу Пуэр Мэнхай 2018","pricePerGram":15.5,"quantity":25},{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	864.5	2025-11-05 21:21:17.941232+00	paid	t	\N	\N	\N	\N	\N	f	\N
1	630229ca-85ee-4bfe-acb2-1c7c3f33761b	Test User	testuser_oGIICa@example.com	+79991234567	Test Address, Moscow		[{"id":4,"name":"Шу Пуэр Мэнхай 2018","pricePerGram":15.5,"quantity":100}]	1550	2025-10-15 18:34:33.862924+00	completed	f	\N	\N	\N	\N	\N	f	\N
16	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений t	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 17:22:16.983907+00	pending	f	\N	\N	\N	\N	\N	f	\N
17	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений тестовый улун	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, улица Потерянной Надежды		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 17:24:31.739231+00	pending	f	\N	\N	\N	\N	\N	f	\N
18	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений те	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 17:30:00.252886+00	pending	f	\N	\N	\N	\N	\N	f	\N
19	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений testo	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, помогите		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 17:36:32.931707+00	pending	f	\N	\N	\N	\N	\N	f	\N
20	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 17:41:26.211193+00	pending	f	\N	\N	\N	\N	\N	f	\N
21	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений 	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 17:45:17.158307+00	pending	f	\N	\N	\N	\N	\N	f	\N
22	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений test	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 18:48:06.168155+00	pending	f	\N	\N	\N	\N	\N	f	\N
23	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 18:52:53.029132+00	pending	f	\N	\N	\N	\N	\N	f	\N
24	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений тесто	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, попытка 125		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 18:58:41.118124+00	pending	f	\N	\N	\N	\N	\N	f	\N
25	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, дурка		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 19:02:05.345076+00	pending	f	\N	\N	\N	\N	\N	f	\N
27	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, южный централ		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 19:15:39.130961+00	pending	f	\N	\N	\N	\N	\N	f	\N
29	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 20:27:02.549676+00	pending	f	\N	\N	\N	\N	\N	f	\N
30	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 20:33:58.979643+00	pending	f	\N	\N	\N	\N	\N	f	\N
31	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 20:42:38.286081+00	pending	f	\N	\N	\N	\N	\N	f	\N
32	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 20:48:51.606119+00	pending	f	\N	\N	\N	\N	\N	f	\N
33	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 20:56:01.210433+00	pending	f	\N	\N	\N	\N	\N	f	\N
34	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений тест	aleshin.evgeniy@outlook.com	+79290017195	Москва, улица		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 20:58:27.76108+00	pending	f	\N	\N	\N	\N	\N	f	\N
35	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, сталь		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 21:04:51.798332+00	pending	f	\N	\N	\N	\N	\N	f	\N
36	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, электросталь		[{"id":5,"name":"Шэн Пуэр Дикие деревья","pricePerGram":28,"quantity":25}]	665	2025-11-20 21:08:25.075212+00	pending	f	\N	\N	\N	\N	\N	f	\N
37	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Москва, москва	попытка номер 100500	[{"id":4,"name":"Шу Пуэр Мэнхай 2018","pricePerGram":15.5,"quantity":50}]	736.25	2025-11-20 21:15:43.357433+00	pending	f	\N	\N	\N	\N	\N	f	\N
38	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, электросталь		[{"id":4,"name":"Шу Пуэр Мэнхай 2018","pricePerGram":15.5,"quantity":50}]	736.25	2025-11-20 21:24:29.982563+00	pending	f	\N	\N	\N	\N	\N	f	\N
39	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электро, сталь 		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 21:39:11.795287+00	pending	f	\N	\N	\N	\N	\N	f	\N
40	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, москва		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 21:43:27.272928+00	pending	f	7415199251	NEW	https://pay.tbank.ru/NoFyS7LN	\N	\N	f	\N
41	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 21:52:37.502191+00	pending	f	7415226914	NEW	https://pay.tbank.ru/9gCY4H1i	\N	\N	f	\N
42	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 21:55:04.282894+00	pending	f	7415233821	NEW	https://pay.tbank.ru/2YicfsVK	\N	\N	f	\N
43	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 21:57:18.870959+00	pending	f	7415239915	NEW	https://pay.tbank.ru/6TyHWsBQ	\N	\N	f	\N
45	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Пуэр паб, электросталь		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 22:08:19.569189+00	cancelled	f	7415272786	REJECTED	https://pay.tbank.ru/YaFYa5lC	\N	\N	f	\N
44	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Москва, пуэр паб		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 22:02:49.43184+00	paid	f	7415255885	CONFIRMED	https://pay.tbank.ru/sbJ0OxTj	\N	\N	f	\N
46	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 22:10:14.87796+00	pending	f	7415278535	REFUNDED	https://pay.tbank.ru/4wGcuwGJ	\N	\N	f	\N
47	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, предпоследний тест		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 22:22:50.353161+00	pending	f	\N	\N	\N	\N	\N	f	\N
50	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, сука 50 заказов		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 22:43:28.542142+00	pending	f	7415358732	NEW	https://pay.tbank.ru/OJdd8gbV	\N	\N	f	\N
48	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, поторопился я конечно..		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 22:30:01.178574+00	pending	f	\N	\N	\N	\N	\N	f	\N
49	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, До талого		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 22:40:26.817664+00	pending	f	\N	\N	\N	\N	\N	f	\N
51	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, сбп		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":50}]	1425	2025-11-20 23:08:42.415332+00	pending	f	7415414167	NEW	https://pay.tbank.ru/C3wlNJUX	\N	\N	f	\N
52	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, мде		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 23:13:42.1271+00	pending	f	7415424545	NEW	https://pay.tbank.ru/jemx07b1	\N	\N	f	\N
53	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 23:31:09.963463+00	pending	f	7415462100	NEW	https://pay.tbank.ru/nfpCOUoQ	\N	\N	f	\N
54	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, юху мы близко		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 23:36:17.789659+00	pending	f	7415472829	NEW	https://pay.tbank.ru/PhYk3rFF	\N	\N	f	\N
55	\N	Евген привет	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	750	2025-11-20 23:39:14.119796+00	pending	f	7415478904	NEW	https://pay.tbank.ru/LYDRF8ok	\N	\N	f	\N
56	\N	Евген ну что	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	750	2025-11-20 23:45:32.830308+00	pending	f	7415491558	NEW	https://pay.tbank.ru/ol88ePgX	\N	\N	f	\N
57	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений тест	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":7,"name":"Красный Пуэр Императорский","pricePerGram":35,"quantity":25}]	831.25	2025-11-21 08:23:57.055086+00	cancelled	f	7417414147	CONFIRMED	https://pay.tbank.ru/1Rp1Wj1o	\N	\N	f	\N
28	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Москва, москвариум		[{"id":9,"name":"Тестовый Улун","pricePerGram":30,"quantity":25}]	712.5	2025-11-20 20:23:00.008516+00	paid	f	7435487905	CONFIRMED	\N	\N	https://lk.platformaofd.ru/web/noauth/cheque?fn=7380440902536594&fp=1729755279&i=14294	f	\N
61	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений тест	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":6,"name":"Лунный свет","pricePerGram":22.5,"quantity":25}]	534.375	2025-11-24 11:12:54.697041+00	pending	f	7434509585	REFUNDED	https://pay.tbank.ru/lLnITexB	\N	\N	f	\N
58	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, тестовая		[{"id":5,"name":"Шэн Пуэр Дикие деревья","pricePerGram":28,"quantity":25}]	665	2025-11-21 08:29:40.218818+00	pending	f	7417443487	REFUNDED	https://pay.tbank.ru/sZ4868MS	\N	\N	f	\N
59	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":5,"name":"Шэн Пуэр Дикие деревья","pricePerGram":28,"quantity":25}]	665	2025-11-21 16:24:23.717738+00	pending	f	7419815218	NEW	https://pay.tbank.ru/grPqccZN	\N	\N	f	\N
66	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, тест		[{"id":6,"name":"Лунный свет","pricePerGram":22.5,"quantity":25}]	506.25	2025-11-25 10:30:09.253802+00	pending	f	7439856683	REFUNDED	https://pay.tbank.ru/P6foHEud	\N	https://lk.platformaofd.ru/web/noauth/cheque?fn=7380440902536215&fp=407430078&i=24517	f	\N
62	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб	еще разок	[{"id":6,"name":"Лунный свет","pricePerGram":22.5,"quantity":25}]	506.25	2025-11-24 12:13:42.722994+00	pending	f	7434781569	REFUNDED	https://pay.tbank.ru/zWozaO22	\N	\N	f	\N
65	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений test	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, тест		[{"id":6,"name":"Лунный свет","pricePerGram":22.5,"quantity":25}]	506.25	2025-11-24 21:13:37.932183+00	pending	f	7436921377	REFUNDED	https://pay.tbank.ru/YUrokUcp	\N	\N	f	\N
60	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб		[{"id":5,"name":"Шэн Пуэр Дикие деревья","pricePerGram":28,"quantity":25}]	665	2025-11-21 17:08:10.746258+00	pending	f	7420030334	REFUNDED	https://pay.tbank.ru/jI3WNXm3	\N	\N	f	\N
63	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, пуэр паб	тест	[{"id":6,"name":"Лунный свет","pricePerGram":22.5,"quantity":25}]	506.25	2025-11-24 12:57:05.516006+00	cancelled	f	7434973171	REFUNDED	https://pay.tbank.ru/WtsJg2cq	\N	\N	f	\N
64	209e1694-ce83-4a8a-8b72-f33438a7e66a	Евгений тест	aleshin.evgeniy@outlook.com	+79290017195	Электросталь, тест		[{"id":6,"name":"Лунный свет","pricePerGram":22.5,"quantity":25}]	506.25	2025-11-24 18:41:53.763323+00	cancelled	f	7436522256	REFUNDED	https://pay.tbank.ru/dKW1gXdu	\N	\N	f	\N
\.


--
-- Data for Name: pending_telegram_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pending_telegram_orders (id, order_id, user_id, chat_id, name, phone, address, items, subtotal, discount, total, discount_type, created_at, status) FROM stdin;
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (id, name, price_per_gram, description, images, tea_type, effects, available_quantities, fixed_quantity_only, fixed_quantity, category, out_of_stock, pricing_unit, default_quantity, card_type) FROM stdin;
4	Шу Пуэр Мэнхай 2018	15.5	Классический выдержанный Шу Пуэр из провинции Юньнань. Насыщенный землистый вкус с нотками орехов и древесины. Идеален для ежедневного чаепития.	{}	Шу Пуэр	{Бодрит,Концентрирует}	{25,50,100}	f	\N	tea	f	gram	\N	classic
5	Шэн Пуэр Дикие деревья	28	Редкий Шэн Пуэр с дикорастущих деревьев. Свежий цветочно-медовый аромат с долгим послевкусием. Для истинных ценителей.	{}	Шэн Пуэр	{Концентрирует,Расслабляет}	{25,50,100}	f	\N	tea	f	gram	\N	classic
9	Тестовый Улун	30	Новый улун для тестирования динамических тегов	{/public/c0ff569d-f5fc-4d22-8a06-22cc07397dbc.png}	Улун	{Охлаждает}	{25,50,100}	f	\N	tea	f	gram	\N	classic
10	Габа Тайвань	32	Свежий Габа чай из Тайваня	{/public/59083fba-9e01-4ef2-af2f-913a6f254317.png}	Габа	{Освежает}	{25,50,100}	f	\N	tea	f	gram	\N	classic
11	пуэрыч	0.3	авыававыавыавыавыа	{/public/cc7ae6b0-6668-4dc4-b060-4fa1e92a3601.jpg}	дед	{Согревает,Тонизирует}	{25,50,100}	f	\N	tea	f	gram	\N	classic
14	Гайвань керамическая 150мл	2500	Традиционная керамическая гайвань для заваривания чая. Объем 150 мл.	{https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800}	Посуда	{}	{1}	t	1	teaware	f	gram	\N	classic
15	Чайник из исинской глины	4500	Классический чайник из знаменитой исинской глины. Объем 200 мл.	{https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=800}	Посуда	{}	{1}	t	1	teaware	f	gram	\N	classic
16	Пиала керамическая набор 3 шт	1800	Набор из трёх традиционных керамических пиал для чаепития.	{https://images.unsplash.com/photo-1577968897966-3d61b2a3c303?w=800}	Посуда	{}	{1}	t	1	teaware	f	gram	\N	classic
17	Дяньхун	18	Прекрасный чай с приятными карамельными нотками и легким ароматом шиповника	{/public/8af3cddf-30dc-4d66-952f-b5ece7b477be.jpg}	Красный чай	{}	{25,50,100}	f	\N	tea	f	gram	\N	classic
6	Лунный свет	22.5	Деликатный белый чай с мягким сладковатым вкусом. Легкий цветочный аромат успокаивает и гармонизирует.	{/public/5eec4a9f-c5ad-49bc-a7f8-2f3734b25769.jpg}	Белый чай	{Успокаивает,Расслабляет}	{25,50,100}	f	\N	tea	f	gram	\N	classic
7	Красный Пуэр Императорский	35	Премиальный красный пуэр глубокой ферментации. Бархатистый вкус с нотками сухофруктов и специй.	{/public/113ee4c0-b56e-4f7c-bbee-4429e669994b.jpg}	Шу Пуэр	{Согревает,Тонизирует}	{25,50,100}	f	\N	tea	f	gram	\N	classic
8	Чёрный Пуэр Старые головы	18.75	Насыщенный чёрный пуэр из крупных листьев. Глубокий вкус с оттенками шоколада и карамели.	{/public/8bf7c6c8-910a-4091-9c5b-b26b69b3fc8e.jpg}	Шу Пуэр	{Бодрит,Согревает}	{25,50,100}	f	\N	tea	f	gram	\N	classic
12	дракон	150	ыыыыыыыыыва	{/public/f441ce3e-bbab-48b3-9058-063edf8a5394.png}	Красный чай	{Расслабляет}	{25,50,100}	f	\N	tea	f	piece	\N	classic
13	Лун Цзин (Dragon Well)	25	«Лун Цзин» («Колодец дракона») — знаменитый китайский зелёный чай, который считается символом чайной культуры Китая. Собирают его ранней весной, когда листья ещё молодые и нежные, что придаёт напитку характерный мягкий и маслянистый вкус. Аромат включает ноты жареных семечек, запечённого каштана и пекана, а также оттенки свежескошенной травы и морского бриза. Чай богат полифенолами, которые поддерживают иммунитет и способствуют замедлению процессов старения. Регулярное употребление Лун Цзина положительно влияет на обмен веществ и общее состояние организма.	{/public/b3b58518-db97-4a1b-a7c0-7ef7323dda70.jpg}	Зеленый чай	{Бодрит}	{25,50,100}	f	\N	tea	t	gram	\N	classic
18	Тестовый чай для медиа K5_ERk	100	Тестовый товар	{/public/7551799b-e241-43cc-8ad3-ee09268a87e6.webp}	Шу Пуэр	{}	{25,50,100}	f	\N	tea	f	gram	\N	media
\.


--
-- Data for Name: raw_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.raw_events (id, event_time, user_id, session_id, request_id, event_name, source, page, experiment_key, experiment_variant, properties, created_at) FROM stdin;
1	2026-02-05 10:40:26.230726+00	test-user-1	sess_test_1	req_1_1	page_view	frontend	/	pricing-test	control	{"referrer": "google.com"}	2026-02-05 12:40:26.230726+00
2	2026-02-05 10:40:31.230726+00	test-user-1	sess_test_1	req_1_2	product_view	frontend	/products/123	pricing-test	control	{"product_id": 123, "product_name": "Зелёный чай"}	2026-02-05 12:40:26.230726+00
3	2026-02-05 10:40:56.230726+00	test-user-1	sess_test_1	req_1_3	add_to_cart	frontend	/products/123	pricing-test	control	{"quantity": 50, "product_id": 123}	2026-02-05 12:40:26.230726+00
4	2026-02-05 10:42:26.230726+00	test-user-1	sess_test_1	req_1_4	checkout_started	frontend	/checkout	pricing-test	control	{"cart_total": 350}	2026-02-05 12:40:26.230726+00
5	2026-02-05 10:45:26.230726+00	test-user-1	sess_test_1	req_1_5	order_completed	frontend	/success	pricing-test	control	{"order_id": 1001, "order_total": 350}	2026-02-05 12:40:26.230726+00
6	2026-02-05 11:40:26.230726+00	test-user-2	sess_test_2	req_2_1	page_view	frontend	/	pricing-test	variant-b	{"referrer": "direct"}	2026-02-05 12:40:26.230726+00
7	2026-02-05 11:40:36.230726+00	test-user-2	sess_test_2	req_2_2	product_view	frontend	/products/456	pricing-test	variant-b	{"product_id": 456, "product_name": "Чёрный чай"}	2026-02-05 12:40:26.230726+00
8	2026-02-05 11:41:11.230726+00	test-user-2	sess_test_2	req_2_3	add_to_cart	frontend	/products/456	pricing-test	variant-b	{"quantity": 100, "product_id": 456}	2026-02-05 12:40:26.230726+00
9	2026-02-05 11:41:26.230726+00	test-user-2	sess_test_2	req_2_4	checkout_started	frontend	/checkout	pricing-test	variant-b	{"cart_total": 450}	2026-02-05 12:40:26.230726+00
10	2026-02-05 12:10:26.230726+00	\N	sess_test_3	req_3_1	page_view	frontend	/	\N	\N	{"referrer": "yandex.ru"}	2026-02-05 12:40:26.230726+00
11	2026-02-05 12:10:41.230726+00	\N	sess_test_3	req_3_2	product_view	frontend	/products/789	\N	\N	{"product_id": 789, "product_name": "Белый чай"}	2026-02-05 12:40:26.230726+00
12	2026-02-05 09:40:26.230726+00	test-user-3	sess_test_4	req_4_1	page_view	frontend	/	pricing-test	control	{}	2026-02-05 12:40:26.230726+00
13	2026-02-05 09:40:26.230726+00	test-user-3	sess_test_4	req_4_2	product_view	frontend	/products/123	pricing-test	control	{"product_id": 123}	2026-02-05 12:40:26.230726+00
14	2026-02-05 08:40:26.230726+00	test-user-4	sess_test_5	req_5_1	page_view	frontend	/	pricing-test	variant-b	{}	2026-02-05 12:40:26.230726+00
15	2026-02-05 08:40:26.230726+00	test-user-4	sess_test_5	req_5_2	search_performed	frontend	/	pricing-test	variant-b	{"query": "зелёный чай", "results_count": 5}	2026-02-05 12:40:26.230726+00
16	2026-02-06 14:17:04.939+00	\N	sess_u37pGZP9OyA1b0q3vs3Fx	req_4QucI9AW6U2hgMB9eWDMu	page_view	frontend	/	\N	\N	{"page": "/"}	2026-02-06 14:17:07.082102+00
17	2026-02-06 14:27:34.624+00	\N	sess_GOH6Y9E9drBQDnlEXxQ6W	req_Y5zBS7zqhTG0wROCXY5eh	page_view	frontend	/	\N	\N	{"page": "/"}	2026-02-06 14:27:39.910142+00
18	2026-02-06 15:19:14.184+00	\N	sess__HNYgqOdgO3FP31cS-ap_	req_-f05wI3pQNY6ONocKBVNx	page_view	frontend	/	\N	\N	{"page": "/"}	2026-02-06 15:20:45.985866+00
19	2026-03-01 21:06:06.856+00	\N	sess_bCtCsGfgihTiVPusVgPr0	req_N15FJLKrJFkT3BI94QJjq	page_view	frontend	/	\N	\N	{"page": "/"}	2026-03-01 21:06:08.627143+00
20	2026-03-01 21:12:37.883+00	\N	sess_q9-4Ht-IUj85HwES22SI-	req_895VnIqxZdkM0G-djhoYG	page_view	frontend	/	\N	\N	{"page": "/"}	2026-03-01 21:12:41.118639+00
21	2026-03-01 21:12:41.661+00	\N	sess_q9-4Ht-IUj85HwES22SI-	req_SifVhunJXqvB9PZHDLoKP	page_view	frontend	/admin	\N	\N	{"page": "/admin"}	2026-03-01 21:12:46.669142+00
22	2026-03-01 21:43:55.916+00	\N	sess_3UpHhJZHTMVOfSTZqizWu	req_pVwDip7SrAyBX1h6hOD5d	page_view	frontend	/	\N	\N	{"page": "/"}	2026-03-01 21:43:57.677894+00
23	2026-03-01 21:45:26.972+00	\N	sess_57E2p3KS-AydumEZqNccx	req_oWj1fSf80svgn8ZBXIZCK	page_view	frontend	/	\N	\N	{"page": "/"}	2026-03-01 21:45:30.186261+00
24	2026-03-01 21:45:30.687+00	\N	sess_57E2p3KS-AydumEZqNccx	req_FHT9PgTq34SfM_cd7E2wt	page_view	frontend	/admin	\N	\N	{"page": "/admin"}	2026-03-01 21:45:35.694276+00
25	2026-03-02 01:05:50.184+00	\N	sess_ovJ48lKgxA1z5E7whkUxo	req_TnF3SG-5lBgyI6X0P6Whe	page_view	frontend	/	\N	\N	{"page": "/"}	2026-03-02 01:05:52.462753+00
26	2026-03-02 01:08:45.861+00	\N	sess_UIFTkKaTUn6tcPV3WvNXq	req_xmu3Pc3YcGnL7TrXzOpu_	page_view	frontend	/	\N	\N	{"page": "/"}	2026-03-02 01:08:50.981866+00
27	2026-03-12 18:10:18.06+00	\N	sess_0DHjdQk-SGrr5U2NzVdPw	req_XfbIP3SngBbnS0kvDwg7N	page_view	frontend	/	\N	\N	{"page": "/"}	2026-03-12 18:10:20.237775+00
28	2026-03-12 18:13:09.03+00	\N	sess_jyV93HPym0c1iALKhfR10	req_gUTIrpJnRltNnT6VDGvme	page_view	frontend	/	\N	\N	{"page": "/"}	2026-03-12 18:13:11.982611+00
29	2026-03-12 18:13:12.677+00	\N	sess_jyV93HPym0c1iALKhfR10	req_4ZEmxQ-lj4mbpDXKAJAPv	page_view	frontend	/app-waitlist	\N	\N	{"page": "/app-waitlist"}	2026-03-12 18:13:17.694876+00
30	2026-03-13 23:57:40.402+00	\N	sess_t7sI93Xu1baPIAXZZJb4b	req_jQyqkbvGMXfNTFKh9HrvT	page_view	frontend	/	\N	\N	{"page": "/"}	2026-03-13 23:57:42.698973+00
31	2026-04-10 13:17:56.962+00	\N	sess_ZP8CMFdbF61QkgSOetGDY	req_t9slFR-6aYoPm-2IhVfFB	page_view	frontend	/	\N	\N	{"page": "/"}	2026-04-10 13:18:01.972925+00
32	2026-04-26 03:29:23.594+00	\N	sess_Dz6m-xu2RMzbkn6e_3YC_	req_GdFLmceM5fL3v1NzLKZv2	page_view	frontend	/	\N	\N	{"page": "/"}	2026-04-26 03:29:25.742823+00
33	2026-04-26 03:29:54.56+00	\N	sess_Dz6m-xu2RMzbkn6e_3YC_	req_ONAJ3dm36KE74APD9sUUv	page_view	frontend	/app-waitlist	\N	\N	{"page": "/app-waitlist"}	2026-04-26 03:29:56.124983+00
34	2026-04-26 03:30:37.811+00	\N	sess_jo7OlNStjTpJ7xcZmbOdS	req_8gH1Vv1yRp1uOzctgkx6w	page_view	frontend	/	\N	\N	{"page": "/"}	2026-04-26 03:30:41.561906+00
35	2026-04-26 03:30:42.16+00	\N	sess_jo7OlNStjTpJ7xcZmbOdS	req_u_QdJbKYrSStSwq2dhVm9	page_view	frontend	/app-waitlist	\N	\N	{"page": "/app-waitlist"}	2026-04-26 03:30:47.176128+00
36	2026-04-26 03:46:21.599+00	\N	sess_lRHbMmbAMkpLCiFMiouff	req_WCP41SlNe83zaxreMlOWq	page_view	frontend	/	\N	\N	{"page": "/"}	2026-04-26 03:46:26.343425+00
37	2026-04-26 03:46:40.241+00	\N	sess_lRHbMmbAMkpLCiFMiouff	req_8nCe5HkVsaHyDytLx11Ix	page_view	frontend	/	\N	\N	{"page": "/"}	2026-04-26 03:46:45.350423+00
38	2026-04-26 03:46:56.725+00	\N	sess_lRHbMmbAMkpLCiFMiouff	req_KfiNPkCPFkYXQua8GvP8y	page_view	frontend	/app-waitlist	\N	\N	{"page": "/app-waitlist"}	2026-04-26 03:47:00.640028+00
39	2026-04-26 03:47:15.168+00	\N	sess_lRHbMmbAMkpLCiFMiouff	req__8Y-kYPB3RAAaJH1YkNcd	page_view	frontend	/app-waitlist	\N	\N	{"page": "/app-waitlist"}	2026-04-26 03:47:20.260489+00
40	2026-04-26 04:08:40.166+00	\N	sess_v8lmgiWQKr-hwt9EJULLK	req_7tV6VmKwU93_AChno5l-K	page_view	frontend	/	\N	\N	{"page": "/"}	2026-04-26 04:08:42.299816+00
41	2026-05-04 14:29:14.87+00	\N	sess_Pr7wpLVZoEwc5Nk9R2dRe	req_GuTN-jXuk3wLgPkU9evcd	page_view	frontend	/	\N	\N	{"page": "/"}	2026-05-04 14:29:17.004752+00
42	2026-05-04 15:02:41.829+00	\N	sess_gtYa3ZDoSMiESmqxLPxGn	req_sYTpA6Op36s7LCXZfnIIF	page_view	frontend	/	\N	\N	{"page": "/"}	2026-05-04 15:02:43.976208+00
43	2026-05-27 11:19:30.271+00	\N	sess_O8n3Yxe0vkE7I2LzKSjvq	req_NAbUjPt6zW84ZZMVe913K	page_view	frontend	/	\N	\N	{"page": "/"}	2026-05-27 11:19:32.569712+00
44	2026-05-27 11:36:35.188+00	\N	sess_gWtSrgzeHA7XoV8EyZi4_	req_PGUBru16ccIGZBsyXqWo2	page_view	frontend	/	\N	\N	{"page": "/"}	2026-05-27 11:36:37.2235+00
45	2026-05-28 13:44:25.005+00	\N	sess_mWvO6qyIG1WklDbTmDQlw	req_AN4jF9sYFZB-c3ApV6tAr	page_view	frontend	/	\N	\N	{"page": "/"}	2026-05-28 13:44:27.423299+00
\.


--
-- Data for Name: saved_addresses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.saved_addresses (id, user_id, address, is_default, created_at) FROM stdin;
1	209e1694-ce83-4a8a-8b72-f33438a7e66a	Электросталь, тест	f	2025-11-24 18:41:54.076115+00
\.


--
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.session (sid, sess, expire) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sessions (session_id, user_id, first_event_time, last_event_time, session_length_sec, events_count, landing_page, exit_page, experiment_key, experiment_variant, page_views_count, add_to_cart_count, checkout_started, order_completed, device_type, referrer, updated_at) FROM stdin;
sess_test_4	test-user-3	2026-02-05 09:40:26.230726+00	2026-02-05 09:40:26.230726+00	0	2	/	/	pricing-test	control	1	0	f	f	\N	\N	2026-02-05 12:40:26.448006+00
sess_test_1	test-user-1	2026-02-05 10:40:26.230726+00	2026-02-05 10:45:26.230726+00	300	5	/	/	pricing-test	control	1	1	t	t	\N	google.com	2026-02-05 12:40:26.448006+00
sess_test_2	test-user-2	2026-02-05 11:40:26.230726+00	2026-02-05 11:41:26.230726+00	60	4	/	/	pricing-test	variant-b	1	1	t	f	\N	direct	2026-02-05 12:40:26.448006+00
sess_test_5	test-user-4	2026-02-05 08:40:26.230726+00	2026-02-05 08:40:26.230726+00	0	2	/	/	pricing-test	variant-b	1	0	f	f	\N	\N	2026-02-05 12:40:26.448006+00
sess_test_3	\N	2026-02-05 12:10:26.230726+00	2026-02-05 12:10:41.230726+00	15	2	/	/	\N	\N	1	0	f	f	\N	yandex.ru	2026-02-05 12:40:26.448006+00
\.


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.settings (id, design_mode) FROM stdin;
1	minimalist
\.


--
-- Data for Name: site_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.site_settings (id, contact_email, contact_phone, contact_telegram, delivery_info, first_order_discount, loyalty_level2_min_xp, loyalty_level2_discount, loyalty_level3_min_xp, loyalty_level3_discount, loyalty_level4_min_xp, loyalty_level4_discount, xp_multiplier, loyalty_level1_perks, loyalty_level2_perks, loyalty_level3_perks, loyalty_level4_perks) FROM stdin;
1	SimonErmak@yandex.ru	+79667364077	@HotlineEugene	Доставка осуществляется через CDEK, Яндекс или WB по всей России в течение 15 рабочих дней	20	3000	5	7000	10	15000	15	1	{"Доступ к базовому каталогу"}	{"Доступ к базовому каталогу"}	{"Персональный чат с консультациями","Приглашения на закрытые чайные вечеринки","Возможность запросить любой чай"}	{"Все привилегии уровня 3","Приоритетное обслуживание","Эксклюзивные предложения"}
\.


--
-- Data for Name: sms_verifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sms_verifications (id, phone, code, type, attempts, created_at, expires_at) FROM stdin;
9	+79290017195	fd1b8702ef8b2242e0358287de2324ef687dfbf9a0ee7538e306e19b1051e15dbd9515fc85f91102366b421fe1cee33ab420b2e7f10fd40259a3bfb96d513575.e6558f2a1a070456300a5e714fb677fa	password_reset	0	2025-11-05 19:38:21.674463+00	2025-11-05T19:43:21.623Z
\.


--
-- Data for Name: tea_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tea_types (id, name, background_color, text_color) FROM stdin;
1	Шу Пуэр	#8B4513	#FFFFFF
2	Шэн Пуэр	#228B22	#FFFFFF
7	Красный чай	#B22222	#FFFFFF
10	Габа	#9370DB	#FFFFFF
11	Другие чаи	#e29140	#faf5f5
3	Белый чай	#fafafa	#050505
6	Светлый Улун	#00bfff	#FFFFFF
9	Тёмный улун	#072c9c	#f7f7f7
8	Зелёный чай	#32CD32	#f7f7f7
5	Чёрный чай	#2F4F4F	#FFFFFF
4	Травяные сборы 	#b4f77e	#050505
\.


--
-- Data for Name: telegram_cart; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.telegram_cart (id, user_id, product_id, quantity, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: telegram_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.telegram_profiles (id, chat_id, username, first_name, user_id, last_seen, created_at) FROM stdin;
1	1649402722	HotlineEugene	evgeniy	\N	2025-12-09T05:41:01.902Z	2025-12-09 04:37:30.362639+00
\.


--
-- Data for Name: telegram_questions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.telegram_questions (id, chat_id, username, first_name, question, answer, admin_chat_id, status, created_at, answered_at) FROM stdin;
\.


--
-- Data for Name: tv_slides; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tv_slides (id, type, image_url, title, duration_seconds, order_index, is_active, created_at, leaderboard_month) FROM stdin;
\.


--
-- Data for Name: user_retention; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_retention (cohort_date, user_id, day_0, day_1, day_7, day_30, last_updated) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, password, name, phone, xp, phone_verified, first_order_discount_used, custom_discount, wallet_balance, analytics) FROM stdin;
209e1694-ce83-4a8a-8b72-f33438a7e66a	\N	57bd3c034cd3ed08ce9bdc1812586dc4d4c5587bc08d9900406fea5540793039db090afaef34794683cad7851321186bd4fb5c58a06c4c2bf256440bd5364006.254c031e26ad02b342918f27bcf7699f	Евгений	+79290017195	10571	t	t	\N	0	\N
d36c5271-440e-46a3-b9f7-4ebab6fcb33d	semen.learning@gmail.com	95fa24d37ec90f0fd7388f5126e6cfffd31577ea77f42ed67bf6fed8f4024194014c8dd8a42e13a62773ddbf55bf7c5ec87cc7007284bd54237c83ea57848f8c.a494711da6691951a59f2c1483a04f66	Hermes	+79168257455	1500	t	f	\N	0	\N
2b0b44b1-5199-41ef-9c7a-76e83e156653	test-kekkNC@example.com	4134de6462af74a8dcc4bcf987737db35866b565f41fa93c37bd5a5561162ee3bd15e9df5e978f8a94d4d76c25815589fba1a9262543a9e2cb232af23acdb186.9ffb0febc75c513cd0f6aa327ffcf897	Test User	+71234567890	0	t	f	\N	0	\N
e9ef727b-0e66-4377-a1ea-a7c0729083e7	test-loyalty-O1zCd2@example.com	3444692f5b80c40f81c2c7f4d14c0b453303680a9ea39e768c00a285c8873418242c09554e39e8ba9e0da71c99ba977cfbe76a426b9a76218b4d61d9763efa2d.6c9dff2cde91b35723664914d20119bd	Test User	+79001234567	0	t	f	\N	0	\N
630229ca-85ee-4bfe-acb2-1c7c3f33761b	testuser_KtEzP9@example.com	b849b36ded53c90cff74adecbad49aae91cd0fef157fd0a65f56fae738aeb14c9bcc9de1c78992150dcb2fcc0340c631ee8ab78efc6402b19b5906ce2d494cbc.cce4a3b14bb7681d3bae7436ca3ca352	Test User	+79991234567	1550	t	f	\N	0	\N
\.


--
-- Data for Name: wallet_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wallet_transactions (id, user_id, type, amount, description, payment_id, order_id, created_at) FROM stdin;
\.


--
-- Data for Name: xp_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.xp_transactions (id, user_id, amount, reason, description, order_id, created_by, created_at) FROM stdin;
1	209e1694-ce83-4a8a-8b72-f33438a7e66a	100	manual_adjustment	Ручное начисление: +100 XP	\N	admin	2025-12-23 23:19:20.764071
2	209e1694-ce83-4a8a-8b72-f33438a7e66a	100	manual_adjustment	Ручное начисление: +100 XP	\N	admin	2025-12-23 23:19:22.28094
3	d36c5271-440e-46a3-b9f7-4ebab6fcb33d	100	manual_adjustment	Ручное начисление: +100 XP	\N	admin	2025-12-23 23:19:34.491656
\.


--
-- Name: ab_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ab_events_id_seq', 74, true);


--
-- Name: app_waitlist_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.app_waitlist_id_seq', 2, true);


--
-- Name: cart_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cart_items_id_seq', 100, true);


--
-- Name: device_user_mappings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.device_user_mappings_id_seq', 1, false);


--
-- Name: etl_runs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.etl_runs_id_seq', 3, true);


--
-- Name: events_clean_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.events_clean_id_seq', 15, true);


--
-- Name: experiments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.experiments_id_seq', 1, false);


--
-- Name: info_banners_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.info_banners_id_seq', 2, true);


--
-- Name: magic_links_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.magic_links_id_seq', 4, true);


--
-- Name: media_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.media_id_seq', 2, true);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.orders_id_seq', 66, true);


--
-- Name: pending_telegram_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pending_telegram_orders_id_seq', 1, false);


--
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.products_id_seq', 18, true);


--
-- Name: raw_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.raw_events_id_seq', 45, true);


--
-- Name: saved_addresses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.saved_addresses_id_seq', 1, true);


--
-- Name: settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.settings_id_seq', 1, true);


--
-- Name: site_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.site_settings_id_seq', 1, true);


--
-- Name: sms_verifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sms_verifications_id_seq', 10, true);


--
-- Name: tea_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tea_types_id_seq', 11, true);


--
-- Name: telegram_cart_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.telegram_cart_id_seq', 1, false);


--
-- Name: telegram_profiles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.telegram_profiles_id_seq', 1, true);


--
-- Name: telegram_questions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.telegram_questions_id_seq', 1, false);


--
-- Name: tv_slides_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tv_slides_id_seq', 1, false);


--
-- Name: wallet_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.wallet_transactions_id_seq', 1, false);


--
-- Name: xp_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.xp_transactions_id_seq', 3, true);


--
-- Name: ab_events ab_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ab_events
    ADD CONSTRAINT ab_events_pkey PRIMARY KEY (id);


--
-- Name: app_waitlist app_waitlist_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_waitlist
    ADD CONSTRAINT app_waitlist_pkey PRIMARY KEY (id);


--
-- Name: cart_items cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);


--
-- Name: cart_items cart_items_user_product_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_user_product_unique UNIQUE (user_id, product_id);


--
-- Name: daily_stats daily_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_stats
    ADD CONSTRAINT daily_stats_pkey PRIMARY KEY (date);


--
-- Name: device_user_mappings device_user_mappings_device_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_user_mappings
    ADD CONSTRAINT device_user_mappings_device_id_key UNIQUE (device_id);


--
-- Name: device_user_mappings device_user_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_user_mappings
    ADD CONSTRAINT device_user_mappings_pkey PRIMARY KEY (id);


--
-- Name: etl_runs etl_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etl_runs
    ADD CONSTRAINT etl_runs_pkey PRIMARY KEY (id);


--
-- Name: events_clean events_clean_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events_clean
    ADD CONSTRAINT events_clean_pkey PRIMARY KEY (id);


--
-- Name: experiment_metrics_daily experiment_metrics_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.experiment_metrics_daily
    ADD CONSTRAINT experiment_metrics_daily_pkey PRIMARY KEY (date, experiment_key, experiment_variant);


--
-- Name: experiments experiments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.experiments
    ADD CONSTRAINT experiments_pkey PRIMARY KEY (id);


--
-- Name: experiments experiments_test_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.experiments
    ADD CONSTRAINT experiments_test_id_key UNIQUE (test_id);


--
-- Name: info_banners info_banners_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.info_banners
    ADD CONSTRAINT info_banners_pkey PRIMARY KEY (id);


--
-- Name: magic_links magic_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.magic_links
    ADD CONSTRAINT magic_links_pkey PRIMARY KEY (id);


--
-- Name: magic_links magic_links_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.magic_links
    ADD CONSTRAINT magic_links_token_hash_key UNIQUE (token_hash);


--
-- Name: media media_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: pending_telegram_orders pending_telegram_orders_order_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pending_telegram_orders
    ADD CONSTRAINT pending_telegram_orders_order_id_key UNIQUE (order_id);


--
-- Name: pending_telegram_orders pending_telegram_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pending_telegram_orders
    ADD CONSTRAINT pending_telegram_orders_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: raw_events raw_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.raw_events
    ADD CONSTRAINT raw_events_pkey PRIMARY KEY (id);


--
-- Name: saved_addresses saved_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.saved_addresses
    ADD CONSTRAINT saved_addresses_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (session_id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: site_settings site_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_pkey PRIMARY KEY (id);


--
-- Name: sms_verifications sms_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_verifications
    ADD CONSTRAINT sms_verifications_pkey PRIMARY KEY (id);


--
-- Name: tea_types tea_types_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tea_types
    ADD CONSTRAINT tea_types_name_key UNIQUE (name);


--
-- Name: tea_types tea_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tea_types
    ADD CONSTRAINT tea_types_pkey PRIMARY KEY (id);


--
-- Name: telegram_cart telegram_cart_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.telegram_cart
    ADD CONSTRAINT telegram_cart_pkey PRIMARY KEY (id);


--
-- Name: telegram_profiles telegram_profiles_chat_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.telegram_profiles
    ADD CONSTRAINT telegram_profiles_chat_id_key UNIQUE (chat_id);


--
-- Name: telegram_profiles telegram_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.telegram_profiles
    ADD CONSTRAINT telegram_profiles_pkey PRIMARY KEY (id);


--
-- Name: telegram_questions telegram_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.telegram_questions
    ADD CONSTRAINT telegram_questions_pkey PRIMARY KEY (id);


--
-- Name: tv_slides tv_slides_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tv_slides
    ADD CONSTRAINT tv_slides_pkey PRIMARY KEY (id);


--
-- Name: user_retention user_retention_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_retention
    ADD CONSTRAINT user_retention_pkey PRIMARY KEY (cohort_date, user_id);


--
-- Name: users users_phone_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_unique UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (email);


--
-- Name: wallet_transactions wallet_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id);


--
-- Name: xp_transactions xp_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.xp_transactions
    ADD CONSTRAINT xp_transactions_pkey PRIMARY KEY (id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- Name: idx_etl_runs_job_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_etl_runs_job_name ON public.etl_runs USING btree (job_name, start_time DESC);


--
-- Name: idx_etl_runs_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_etl_runs_status ON public.etl_runs USING btree (status, start_time DESC);


--
-- Name: idx_events_clean_event_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_events_clean_event_name ON public.events_clean USING btree (event_name, event_time DESC);


--
-- Name: idx_events_clean_event_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_events_clean_event_time ON public.events_clean USING btree (event_time DESC);


--
-- Name: idx_events_clean_experiment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_events_clean_experiment ON public.events_clean USING btree (experiment_key, experiment_variant) WHERE (experiment_key IS NOT NULL);


--
-- Name: idx_events_clean_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_events_clean_session ON public.events_clean USING btree (session_id, event_time DESC);


--
-- Name: idx_events_clean_user_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_events_clean_user_time ON public.events_clean USING btree (user_id, event_time DESC);


--
-- Name: idx_experiment_metrics_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_experiment_metrics_date ON public.experiment_metrics_daily USING btree (date DESC);


--
-- Name: idx_experiment_metrics_experiment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_experiment_metrics_experiment ON public.experiment_metrics_daily USING btree (experiment_key, date DESC);


--
-- Name: idx_raw_events_event_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_raw_events_event_name ON public.raw_events USING btree (event_name, event_time DESC);


--
-- Name: idx_raw_events_event_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_raw_events_event_time ON public.raw_events USING btree (event_time DESC);


--
-- Name: idx_raw_events_experiment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_raw_events_experiment ON public.raw_events USING btree (experiment_key, experiment_variant) WHERE (experiment_key IS NOT NULL);


--
-- Name: idx_raw_events_properties; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_raw_events_properties ON public.raw_events USING gin (properties);


--
-- Name: idx_raw_events_request_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_raw_events_request_id ON public.raw_events USING btree (request_id) WHERE (request_id IS NOT NULL);


--
-- Name: idx_raw_events_session_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_raw_events_session_time ON public.raw_events USING btree (session_id, event_time DESC);


--
-- Name: idx_raw_events_user_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_raw_events_user_time ON public.raw_events USING btree (user_id, event_time DESC);


--
-- Name: idx_retention_cohort; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_retention_cohort ON public.user_retention USING btree (cohort_date DESC);


--
-- Name: idx_sessions_experiment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sessions_experiment ON public.sessions USING btree (experiment_key, experiment_variant) WHERE (experiment_key IS NOT NULL);


--
-- Name: idx_sessions_first_event; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sessions_first_event ON public.sessions USING btree (first_event_time DESC);


--
-- Name: idx_sessions_order_completed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sessions_order_completed ON public.sessions USING btree (order_completed, first_event_time DESC);


--
-- Name: idx_sessions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sessions_user_id ON public.sessions USING btree (user_id, first_event_time DESC);


--
-- Name: ab_events ab_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ab_events
    ADD CONSTRAINT ab_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: cart_items cart_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: cart_items cart_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: device_user_mappings device_user_mappings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_user_mappings
    ADD CONSTRAINT device_user_mappings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: magic_links magic_links_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.magic_links
    ADD CONSTRAINT magic_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: media media_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: pending_telegram_orders pending_telegram_orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pending_telegram_orders
    ADD CONSTRAINT pending_telegram_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: saved_addresses saved_addresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.saved_addresses
    ADD CONSTRAINT saved_addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: telegram_cart telegram_cart_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.telegram_cart
    ADD CONSTRAINT telegram_cart_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: telegram_cart telegram_cart_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.telegram_cart
    ADD CONSTRAINT telegram_cart_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: telegram_profiles telegram_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.telegram_profiles
    ADD CONSTRAINT telegram_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: wallet_transactions wallet_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: xp_transactions xp_transactions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.xp_transactions
    ADD CONSTRAINT xp_transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: xp_transactions xp_transactions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.xp_transactions
    ADD CONSTRAINT xp_transactions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict fiKSp8h9IqVHlfjKVcxFqwyqNzntEt98lzAcKTeNZPVPhYBrcUMTUcVKTjKcdiP

