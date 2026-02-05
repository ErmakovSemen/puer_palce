-- ============================================
-- ДЕМОНСТРАЦИОННЫЕ ДАННЫЕ
-- ============================================
--
-- Этот скрипт создаёт тестовые данные для проверки работы системы
-- ВНИМАНИЕ: Используйте только в dev/test окружении!
--

-- ============================================
-- 1. Создаём тестовые события
-- ============================================

\echo '=== СОЗДАНИЕ ТЕСТОВЫХ СОБЫТИЙ ==='

-- Создаём 3 сессии с разными пользователями
INSERT INTO raw_events (
  event_time,
  user_id,
  session_id,
  request_id,
  event_name,
  source,
  page,
  experiment_key,
  experiment_variant,
  properties
) VALUES
-- Сессия 1: Пользователь прошёл всю воронку (конверсия)
(NOW() - INTERVAL '2 hours', 'test-user-1', 'sess_test_1', 'req_1_1', 'page_view', 'frontend', '/', 'pricing-test', 'control', '{"referrer": "google.com"}'::jsonb),
(NOW() - INTERVAL '2 hours' + INTERVAL '5 seconds', 'test-user-1', 'sess_test_1', 'req_1_2', 'product_view', 'frontend', '/products/123', 'pricing-test', 'control', '{"product_id": 123, "product_name": "Зелёный чай"}'::jsonb),
(NOW() - INTERVAL '2 hours' + INTERVAL '30 seconds', 'test-user-1', 'sess_test_1', 'req_1_3', 'add_to_cart', 'frontend', '/products/123', 'pricing-test', 'control', '{"product_id": 123, "quantity": 50}'::jsonb),
(NOW() - INTERVAL '2 hours' + INTERVAL '2 minutes', 'test-user-1', 'sess_test_1', 'req_1_4', 'checkout_started', 'frontend', '/checkout', 'pricing-test', 'control', '{"cart_total": 350}'::jsonb),
(NOW() - INTERVAL '2 hours' + INTERVAL '5 minutes', 'test-user-1', 'sess_test_1', 'req_1_5', 'order_completed', 'frontend', '/success', 'pricing-test', 'control', '{"order_id": 1001, "order_total": 350}'::jsonb),

-- Сессия 2: Пользователь добавил в корзину, но не завершил (вариант B)
(NOW() - INTERVAL '1 hour', 'test-user-2', 'sess_test_2', 'req_2_1', 'page_view', 'frontend', '/', 'pricing-test', 'variant-b', '{"referrer": "direct"}'::jsonb),
(NOW() - INTERVAL '1 hour' + INTERVAL '10 seconds', 'test-user-2', 'sess_test_2', 'req_2_2', 'product_view', 'frontend', '/products/456', 'pricing-test', 'variant-b', '{"product_id": 456, "product_name": "Чёрный чай"}'::jsonb),
(NOW() - INTERVAL '1 hour' + INTERVAL '45 seconds', 'test-user-2', 'sess_test_2', 'req_2_3', 'add_to_cart', 'frontend', '/products/456', 'pricing-test', 'variant-b', '{"product_id": 456, "quantity": 100}'::jsonb),
(NOW() - INTERVAL '1 hour' + INTERVAL '1 minute', 'test-user-2', 'sess_test_2', 'req_2_4', 'checkout_started', 'frontend', '/checkout', 'pricing-test', 'variant-b', '{"cart_total": 450}'::jsonb),

-- Сессия 3: Анонимный пользователь только просмотрел
(NOW() - INTERVAL '30 minutes', NULL, 'sess_test_3', 'req_3_1', 'page_view', 'frontend', '/', NULL, NULL, '{"referrer": "yandex.ru"}'::jsonb),
(NOW() - INTERVAL '30 minutes' + INTERVAL '15 seconds', NULL, 'sess_test_3', 'req_3_2', 'product_view', 'frontend', '/products/789', NULL, NULL, '{"product_id": 789, "product_name": "Белый чай"}'::jsonb),

-- Дополнительные события для статистики
(NOW() - INTERVAL '3 hours', 'test-user-3', 'sess_test_4', 'req_4_1', 'page_view', 'frontend', '/', 'pricing-test', 'control', '{}'::jsonb),
(NOW() - INTERVAL '3 hours', 'test-user-3', 'sess_test_4', 'req_4_2', 'product_view', 'frontend', '/products/123', 'pricing-test', 'control', '{"product_id": 123}'::jsonb),
(NOW() - INTERVAL '4 hours', 'test-user-4', 'sess_test_5', 'req_5_1', 'page_view', 'frontend', '/', 'pricing-test', 'variant-b', '{}'::jsonb),
(NOW() - INTERVAL '4 hours', 'test-user-4', 'sess_test_5', 'req_5_2', 'search_performed', 'frontend', '/', 'pricing-test', 'variant-b', '{"query": "зелёный чай", "results_count": 5}'::jsonb);

SELECT 
  '✓ Создано тестовых событий: ' || COUNT(*) AS status
FROM raw_events
WHERE session_id LIKE 'sess_test_%';

-- ============================================
-- 2. Запускаем ETL для обработки
-- ============================================

\echo ''
\echo '=== ЗАПУСК ETL ОБРАБОТКИ ==='

-- Обработка сессий
SELECT process_sessions();

-- Очистка событий
SELECT process_events_clean();

-- Агрегация за сегодня
SELECT aggregate_daily_stats(CURRENT_DATE);

\echo '✓ ETL обработка завершена'

-- ============================================
-- 3. Проверяем результаты
-- ============================================

\echo ''
\echo '=== РЕЗУЛЬТАТЫ ОБРАБОТКИ ==='

\echo ''
\echo '--- СЕССИИ ---'
SELECT 
  session_id,
  user_id,
  events_count AS "События",
  ROUND(session_length_sec / 60.0, 2) AS "Длительность (мин)",
  CASE WHEN order_completed THEN '✓ Да' ELSE '✗ Нет' END AS "Конверсия"
FROM sessions
WHERE session_id LIKE 'sess_test_%'
ORDER BY first_event_time;

\echo ''
\echo '--- ВОРОНКА КОНВЕРСИИ ---'
WITH funnel AS (
  SELECT 
    COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'page_view') AS step_1,
    COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'product_view') AS step_2,
    COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'add_to_cart') AS step_3,
    COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'checkout_started') AS step_4,
    COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'order_completed') AS step_5
  FROM events_clean
  WHERE session_id LIKE 'sess_test_%'
)
SELECT 
  'Просмотр страницы' AS "Этап",
  step_1 AS "Сессий",
  100.0 AS "% от начала"
FROM funnel
UNION ALL
SELECT 
  'Просмотр товара',
  step_2,
  ROUND(step_2::NUMERIC / NULLIF(step_1, 0) * 100, 1)
FROM funnel
UNION ALL
SELECT 
  'Добавление в корзину',
  step_3,
  ROUND(step_3::NUMERIC / NULLIF(step_1, 0) * 100, 1)
FROM funnel
UNION ALL
SELECT 
  'Начало оформления',
  step_4,
  ROUND(step_4::NUMERIC / NULLIF(step_1, 0) * 100, 1)
FROM funnel
UNION ALL
SELECT 
  'Завершение заказа',
  step_5,
  ROUND(step_5::NUMERIC / NULLIF(step_1, 0) * 100, 1)
FROM funnel;

\echo ''
\echo '--- A/B ТЕСТ (PRICING-TEST) ---'
SELECT 
  experiment_variant AS "Вариант",
  COUNT(DISTINCT user_id) AS "Пользователей",
  COUNT(DISTINCT session_id) AS "Сессий",
  COUNT(*) FILTER (WHERE event_name = 'order_completed') AS "Конверсий",
  ROUND(
    COUNT(*) FILTER (WHERE event_name = 'order_completed')::NUMERIC /
    NULLIF(COUNT(DISTINCT user_id), 0) * 100,
    1
  ) AS "Конверсия %"
FROM events_clean
WHERE experiment_key = 'pricing-test'
GROUP BY experiment_variant
ORDER BY experiment_variant;

\echo ''
\echo '--- СТАТИСТИКА ЗА СЕГОДНЯ ---'
SELECT 
  date AS "Дата",
  active_users AS "Активных",
  total_sessions AS "Сессий",
  total_events AS "События",
  total_orders AS "Заказов",
  ROUND(total_revenue, 2) AS "Выручка"
FROM daily_stats
WHERE date = CURRENT_DATE;

\echo ''
\echo '=== ДЕМО ДАННЫЕ ГОТОВЫ ==='
\echo ''
\echo 'Теперь вы можете:'
\echo '1. Посмотреть события: SELECT * FROM v_analytics_events LIMIT 10;'
\echo '2. Посмотреть сессии: SELECT * FROM v_analytics_sessions;'
\echo '3. Проверить воронку: SELECT * FROM v_analytics_funnel WHERE "Дата" = CURRENT_DATE;'
\echo '4. Подключить DataLens и создать дашборд'
\echo ''
\echo 'Для удаления демо данных выполните:'
\echo 'DELETE FROM raw_events WHERE session_id LIKE ''sess_test_%'';'
