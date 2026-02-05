-- ============================================
-- Ключевые Метрики Бизнеса
-- ============================================
--
-- Основные метрики для мониторинга здоровья проекта
-- Запускайте регулярно для анализа

-- ============================================
-- 1. ОБЩИЕ МЕТРИКИ (Daily Overview)
-- ============================================

-- Метрики за последние 7 дней
SELECT 
  date AS "Дата",
  active_users AS "Активных пользователей",
  new_users AS "Новых пользователей",
  total_sessions AS "Сессий",
  ROUND(total_events::NUMERIC / NULLIF(total_sessions, 0), 2) AS "События/Сессия",
  ROUND(avg_session_length_sec / 60.0, 2) AS "Средняя длительность (мин)",
  total_orders AS "Заказов",
  ROUND(total_orders::NUMERIC / NULLIF(active_users, 0) * 100, 2) AS "Конверсия (%)",
  ROUND(total_revenue, 2) AS "Выручка (₽)",
  ROUND(avg_order_value, 2) AS "Средний чек (₽)"
FROM daily_stats
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;


-- ============================================
-- 2. МЕТРИКИ ВОВЛЕЧЁННОСТИ (Engagement)
-- ============================================

-- Топ событий за последние 7 дней
SELECT 
  ec.event_name AS "Событие",
  COUNT(*) AS "Количество",
  COUNT(DISTINCT ec.user_id) AS "Уникальных пользователей",
  COUNT(DISTINCT ec.session_id) AS "Уникальных сессий",
  ROUND(COUNT(*)::NUMERIC / COUNT(DISTINCT ec.session_id), 2) AS "События/Сессия"
FROM events_clean ec
WHERE ec.event_time >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY ec.event_name
ORDER BY COUNT(*) DESC
LIMIT 20;


-- ============================================
-- 3. ВОРОНКА КОНВЕРСИИ (Funnel Analysis)
-- ============================================

-- Воронка за последние 7 дней (общая)
WITH funnel AS (
  SELECT 
    COUNT(DISTINCT session_id) AS total_sessions,
    COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'page_view') AS step_1_page_view,
    COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'product_view') AS step_2_product_view,
    COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'add_to_cart') AS step_3_add_to_cart,
    COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'checkout_started') AS step_4_checkout,
    COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'order_completed') AS step_5_order
  FROM events_clean
  WHERE event_time >= CURRENT_DATE - INTERVAL '7 days'
)
SELECT 
  'Всего сессий' AS "Этап",
  total_sessions AS "Количество",
  100.0 AS "% от начала",
  NULL AS "% от предыдущего"
FROM funnel
UNION ALL
SELECT 
  '1. Просмотр страницы',
  step_1_page_view,
  ROUND(step_1_page_view::NUMERIC / NULLIF(total_sessions, 0) * 100, 2),
  ROUND(step_1_page_view::NUMERIC / NULLIF(total_sessions, 0) * 100, 2)
FROM funnel
UNION ALL
SELECT 
  '2. Просмотр товара',
  step_2_product_view,
  ROUND(step_2_product_view::NUMERIC / NULLIF(total_sessions, 0) * 100, 2),
  ROUND(step_2_product_view::NUMERIC / NULLIF(step_1_page_view, 0) * 100, 2)
FROM funnel
UNION ALL
SELECT 
  '3. Добавление в корзину',
  step_3_add_to_cart,
  ROUND(step_3_add_to_cart::NUMERIC / NULLIF(total_sessions, 0) * 100, 2),
  ROUND(step_3_add_to_cart::NUMERIC / NULLIF(step_2_product_view, 0) * 100, 2)
FROM funnel
UNION ALL
SELECT 
  '4. Начало оформления',
  step_4_checkout,
  ROUND(step_4_checkout::NUMERIC / NULLIF(total_sessions, 0) * 100, 2),
  ROUND(step_4_checkout::NUMERIC / NULLIF(step_3_add_to_cart, 0) * 100, 2)
FROM funnel
UNION ALL
SELECT 
  '5. Завершение заказа',
  step_5_order,
  ROUND(step_5_order::NUMERIC / NULLIF(total_sessions, 0) * 100, 2),
  ROUND(step_5_order::NUMERIC / NULLIF(step_4_checkout, 0) * 100, 2)
FROM funnel;


-- ============================================
-- 4. RETENTION (Удержание пользователей)
-- ============================================

-- Retention по когортам (последние 30 дней)
SELECT 
  cohort_date AS "Дата когорты",
  COUNT(DISTINCT user_id) AS "Размер когорты",
  COUNT(DISTINCT user_id) FILTER (WHERE day_1) AS "День 1",
  ROUND(
    COUNT(DISTINCT user_id) FILTER (WHERE day_1)::NUMERIC / 
    NULLIF(COUNT(DISTINCT user_id), 0) * 100, 
    1
  ) AS "D1 (%)",
  COUNT(DISTINCT user_id) FILTER (WHERE day_7) AS "День 7",
  ROUND(
    COUNT(DISTINCT user_id) FILTER (WHERE day_7)::NUMERIC / 
    NULLIF(COUNT(DISTINCT user_id), 0) * 100, 
    1
  ) AS "D7 (%)",
  COUNT(DISTINCT user_id) FILTER (WHERE day_30) AS "День 30",
  ROUND(
    COUNT(DISTINCT user_id) FILTER (WHERE day_30)::NUMERIC / 
    NULLIF(COUNT(DISTINCT user_id), 0) * 100, 
    1
  ) AS "D30 (%)"
FROM user_retention
WHERE cohort_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY cohort_date
ORDER BY cohort_date DESC;


-- ============================================
-- 5. COHORT REVENUE ANALYSIS (Доход по когортам)
-- ============================================

-- Средний доход на пользователя по когортам
WITH user_cohorts AS (
  SELECT 
    user_id,
    DATE(MIN(event_time)) AS cohort_date
  FROM events_clean
  WHERE user_id IS NOT NULL
  GROUP BY user_id
),
cohort_revenue AS (
  SELECT 
    uc.cohort_date,
    COUNT(DISTINCT uc.user_id) AS cohort_size,
    COUNT(DISTINCT o.id) AS orders_count,
    COALESCE(SUM(o.total), 0) AS total_revenue,
    ROUND(COALESCE(SUM(o.total), 0) / NULLIF(COUNT(DISTINCT uc.user_id), 0), 2) AS revenue_per_user,
    ROUND(COUNT(DISTINCT o.id)::NUMERIC / NULLIF(COUNT(DISTINCT uc.user_id), 0) * 100, 2) AS paying_users_pct
  FROM user_cohorts uc
  LEFT JOIN users u ON uc.user_id = u.id
  LEFT JOIN orders o ON u.id = o.user_id AND o.status = 'paid'
  WHERE uc.cohort_date >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY uc.cohort_date
)
SELECT 
  cohort_date AS "Дата когорты",
  cohort_size AS "Размер когорты",
  orders_count AS "Заказов",
  paying_users_pct AS "% платящих",
  total_revenue AS "Выручка (₽)",
  revenue_per_user AS "ARPU (₽)"
FROM cohort_revenue
ORDER BY cohort_date DESC;


-- ============================================
-- 6. ТОП ТОВАРЫ (Product Performance)
-- ============================================

-- Топ-10 товаров по выручке за последние 30 дней
WITH product_stats AS (
  SELECT 
    p.id,
    p.name,
    p.tea_type,
    COUNT(DISTINCT ec.session_id) FILTER (WHERE ec.event_name = 'product_view') AS views,
    COUNT(DISTINCT ec.session_id) FILTER (WHERE ec.event_name = 'add_to_cart') AS adds_to_cart,
    (
      SELECT COUNT(*)
      FROM orders o,
      jsonb_array_elements(o.items::jsonb) AS item
      WHERE (item->>'id')::INTEGER = p.id
        AND o.status = 'paid'
        AND o.created_at >= (CURRENT_DATE - INTERVAL '30 days')::TEXT
    ) AS orders_count,
    (
      SELECT COALESCE(SUM((item->>'quantity')::INTEGER * (item->>'pricePerGram')::NUMERIC), 0)
      FROM orders o,
      jsonb_array_elements(o.items::jsonb) AS item
      WHERE (item->>'id')::INTEGER = p.id
        AND o.status = 'paid'
        AND o.created_at >= (CURRENT_DATE - INTERVAL '30 days')::TEXT
    ) AS revenue
  FROM products p
  LEFT JOIN events_clean ec ON ec.product_id = p.id 
    AND ec.event_time >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY p.id, p.name, p.tea_type
)
SELECT 
  name AS "Товар",
  tea_type AS "Тип",
  views AS "Просмотров",
  adds_to_cart AS "В корзину",
  ROUND(adds_to_cart::NUMERIC / NULLIF(views, 0) * 100, 1) AS "Конверсия в корзину (%)",
  orders_count AS "Заказов",
  ROUND(orders_count::NUMERIC / NULLIF(adds_to_cart, 0) * 100, 1) AS "Конверсия в заказ (%)",
  ROUND(revenue, 2) AS "Выручка (₽)"
FROM product_stats
WHERE revenue > 0
ORDER BY revenue DESC
LIMIT 10;


-- ============================================
-- 7. ВРЕМЯ НА САЙТЕ (Time on Site)
-- ============================================

-- Распределение длительности сессий за последние 7 дней
SELECT 
  CASE 
    WHEN session_length_sec < 30 THEN '< 30 сек'
    WHEN session_length_sec < 60 THEN '30-60 сек'
    WHEN session_length_sec < 180 THEN '1-3 мин'
    WHEN session_length_sec < 300 THEN '3-5 мин'
    WHEN session_length_sec < 600 THEN '5-10 мин'
    ELSE '> 10 мин'
  END AS "Длительность",
  COUNT(*) AS "Сессий",
  ROUND(COUNT(*)::NUMERIC / (SELECT COUNT(*) FROM sessions WHERE first_event_time >= CURRENT_DATE - INTERVAL '7 days') * 100, 1) AS "% от всех"
FROM sessions
WHERE first_event_time >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY 1
ORDER BY 
  CASE 
    WHEN session_length_sec < 30 THEN 1
    WHEN session_length_sec < 60 THEN 2
    WHEN session_length_sec < 180 THEN 3
    WHEN session_length_sec < 300 THEN 4
    WHEN session_length_sec < 600 THEN 5
    ELSE 6
  END;


-- ============================================
-- 8. ИСТОЧНИКИ ТРАФИКА (Traffic Sources)
-- ============================================

-- Топ источников трафика за последние 7 дней
SELECT 
  COALESCE(referrer, 'Direct') AS "Источник",
  COUNT(*) AS "Сессий",
  COUNT(DISTINCT user_id) AS "Уникальных пользователей",
  ROUND(AVG(session_length_sec) / 60.0, 2) AS "Средняя длительность (мин)",
  COUNT(*) FILTER (WHERE order_completed) AS "Заказов",
  ROUND(COUNT(*) FILTER (WHERE order_completed)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) AS "Конверсия (%)"
FROM sessions
WHERE first_event_time >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY COALESCE(referrer, 'Direct')
ORDER BY COUNT(*) DESC
LIMIT 10;


-- ============================================
-- 9. УСТРОЙСТВА (Device Breakdown)
-- ============================================

-- Метрики по типам устройств за последние 7 дней
SELECT 
  COALESCE(device_type, 'Unknown') AS "Устройство",
  COUNT(*) AS "Сессий",
  COUNT(DISTINCT user_id) AS "Пользователей",
  ROUND(AVG(session_length_sec) / 60.0, 2) AS "Средняя длительность (мин)",
  ROUND(AVG(events_count), 1) AS "Среднее событий",
  COUNT(*) FILTER (WHERE order_completed) AS "Заказов",
  ROUND(COUNT(*) FILTER (WHERE order_completed)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) AS "Конверсия (%)"
FROM sessions
WHERE first_event_time >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY COALESCE(device_type, 'Unknown')
ORDER BY COUNT(*) DESC;


-- ============================================
-- 10. ПОЧАСОВАЯ АКТИВНОСТЬ (Hourly Activity)
-- ============================================

-- Активность по часам дня (последние 7 дней)
SELECT 
  EXTRACT(HOUR FROM event_time) AS "Час",
  COUNT(*) AS "События",
  COUNT(DISTINCT session_id) AS "Сессии",
  COUNT(DISTINCT user_id) AS "Пользователи"
FROM events_clean
WHERE event_time >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY EXTRACT(HOUR FROM event_time)
ORDER BY "Час";


-- ============================================
-- 11. КРИТИЧЕСКИЕ МЕТРИКИ (Health Check)
-- ============================================

-- Сводка критических метрик (последние 24 часа vs предыдущие 24 часа)
WITH today AS (
  SELECT 
    COUNT(DISTINCT user_id) AS users,
    COUNT(DISTINCT session_id) AS sessions,
    COUNT(*) AS events,
    COUNT(DISTINCT order_id) AS orders,
    COALESCE(SUM(order_total), 0) AS revenue
  FROM events_clean
  WHERE event_time >= CURRENT_DATE
),
yesterday AS (
  SELECT 
    COUNT(DISTINCT user_id) AS users,
    COUNT(DISTINCT session_id) AS sessions,
    COUNT(*) AS events,
    COUNT(DISTINCT order_id) AS orders,
    COALESCE(SUM(order_total), 0) AS revenue
  FROM events_clean
  WHERE event_time >= CURRENT_DATE - INTERVAL '1 day'
    AND event_time < CURRENT_DATE
)
SELECT 
  'Пользователи' AS "Метрика",
  t.users AS "Сегодня",
  y.users AS "Вчера",
  ROUND((t.users - y.users)::NUMERIC / NULLIF(y.users, 0) * 100, 1) AS "Изменение (%)"
FROM today t, yesterday y
UNION ALL
SELECT 
  'Сессии',
  t.sessions,
  y.sessions,
  ROUND((t.sessions - y.sessions)::NUMERIC / NULLIF(y.sessions, 0) * 100, 1)
FROM today t, yesterday y
UNION ALL
SELECT 
  'События',
  t.events,
  y.events,
  ROUND((t.events - y.events)::NUMERIC / NULLIF(y.events, 0) * 100, 1)
FROM today t, yesterday y
UNION ALL
SELECT 
  'Заказы',
  t.orders,
  y.orders,
  ROUND((t.orders - y.orders)::NUMERIC / NULLIF(y.orders, 0) * 100, 1)
FROM today t, yesterday y
UNION ALL
SELECT 
  'Выручка (₽)',
  ROUND(t.revenue::NUMERIC, 0),
  ROUND(y.revenue::NUMERIC, 0),
  ROUND((t.revenue - y.revenue)::NUMERIC / NULLIF(y.revenue, 0) * 100, 1)
FROM today t, yesterday y;


-- ============================================
-- 12. LTV (Lifetime Value) по когортам
-- ============================================

-- LTV за 30, 60, 90 дней по когортам
WITH user_cohorts AS (
  SELECT 
    user_id,
    DATE(MIN(event_time)) AS cohort_date
  FROM events_clean
  WHERE user_id IS NOT NULL
  GROUP BY user_id
),
cohort_ltv AS (
  SELECT 
    uc.cohort_date,
    COUNT(DISTINCT uc.user_id) AS cohort_size,
    -- LTV 30 дней
    ROUND(
      COALESCE(SUM(o30.total) FILTER (WHERE o30.status = 'paid'), 0) / 
      NULLIF(COUNT(DISTINCT uc.user_id), 0), 
      2
    ) AS ltv_30,
    -- LTV 60 дней
    ROUND(
      COALESCE(SUM(o60.total) FILTER (WHERE o60.status = 'paid'), 0) / 
      NULLIF(COUNT(DISTINCT uc.user_id), 0), 
      2
    ) AS ltv_60,
    -- LTV 90 дней
    ROUND(
      COALESCE(SUM(o90.total) FILTER (WHERE o90.status = 'paid'), 0) / 
      NULLIF(COUNT(DISTINCT uc.user_id), 0), 
      2
    ) AS ltv_90
  FROM user_cohorts uc
  LEFT JOIN users u ON uc.user_id = u.id
  LEFT JOIN orders o30 ON u.id = o30.user_id 
    AND o30.created_at::DATE <= uc.cohort_date + INTERVAL '30 days'
  LEFT JOIN orders o60 ON u.id = o60.user_id 
    AND o60.created_at::DATE <= uc.cohort_date + INTERVAL '60 days'
  LEFT JOIN orders o90 ON u.id = o90.user_id 
    AND o90.created_at::DATE <= uc.cohort_date + INTERVAL '90 days'
  WHERE uc.cohort_date >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY uc.cohort_date
)
SELECT 
  cohort_date AS "Дата когорты",
  cohort_size AS "Размер когорты",
  ltv_30 AS "LTV 30 дней (₽)",
  ltv_60 AS "LTV 60 дней (₽)",
  ltv_90 AS "LTV 90 дней (₽)"
FROM cohort_ltv
ORDER BY cohort_date DESC;
