-- ============================================
-- Analytics System - BI Views
-- ============================================
--
-- VIEW для подключения BI инструментов (Yandex DataLens, Metabase)
-- Эти представления скрывают технические детали и предоставляют
-- удобный интерфейс для построения дашбордов
--

-- ============================================
-- VIEW 1: События для аналитики
-- ============================================

CREATE OR REPLACE VIEW v_analytics_events AS
SELECT 
  ec.id,
  ec.event_time AS "Время события",
  ec.event_name AS "Название события",
  ec.source AS "Источник",
  ec.page AS "Страница",
  -- Пользователь
  ec.user_id AS "ID пользователя",
  ec.user_name AS "Имя пользователя",
  CASE ec.user_loyalty_level
    WHEN 1 THEN 'Новичок'
    WHEN 2 THEN 'Знаток'
    WHEN 3 THEN 'Эксперт'
    WHEN 4 THEN 'Мастер'
    ELSE 'Неизвестно'
  END AS "Уровень лояльности",
  -- Сессия
  ec.session_id AS "ID сессии",
  -- Эксперимент
  ec.experiment_key AS "Ключ эксперимента",
  ec.experiment_variant AS "Вариант эксперимента",
  -- Продукт
  ec.product_id AS "ID товара",
  ec.product_name AS "Название товара",
  -- Заказ
  ec.order_id AS "ID заказа",
  ec.order_total AS "Сумма заказа",
  -- Временные измерения
  DATE(ec.event_time) AS "Дата",
  EXTRACT(YEAR FROM ec.event_time) AS "Год",
  EXTRACT(MONTH FROM ec.event_time) AS "Месяц",
  EXTRACT(DAY FROM ec.event_time) AS "День",
  EXTRACT(DOW FROM ec.event_time) AS "День недели",
  EXTRACT(HOUR FROM ec.event_time) AS "Час",
  TO_CHAR(ec.event_time, 'YYYY-MM') AS "Год-Месяц",
  TO_CHAR(ec.event_time, 'YYYY-MM-DD') AS "Дата (текст)",
  -- Дополнительные свойства
  ec.properties AS "Свойства (JSON)"
FROM events_clean ec
ORDER BY ec.event_time DESC;

COMMENT ON VIEW v_analytics_events IS 'События для аналитики с человекочитаемыми названиями';


-- ============================================
-- VIEW 2: Сессии для аналитики
-- ============================================

CREATE OR REPLACE VIEW v_analytics_sessions AS
SELECT 
  s.session_id AS "ID сессии",
  s.user_id AS "ID пользователя",
  u.name AS "Имя пользователя",
  s.first_event_time AS "Начало сессии",
  s.last_event_time AS "Конец сессии",
  s.session_length_sec AS "Длительность (сек)",
  ROUND(s.session_length_sec / 60.0, 2) AS "Длительность (мин)",
  s.events_count AS "Количество событий",
  s.landing_page AS "Посадочная страница",
  s.exit_page AS "Страница выхода",
  s.page_views_count AS "Просмотров страниц",
  s.add_to_cart_count AS "Добавлений в корзину",
  s.checkout_started AS "Начал оформление",
  s.order_completed AS "Завершил заказ",
  -- Эксперимент
  s.experiment_key AS "Ключ эксперимента",
  s.experiment_variant AS "Вариант эксперимента",
  -- Устройство
  s.device_type AS "Тип устройства",
  s.referrer AS "Источник перехода",
  -- Временные измерения
  DATE(s.first_event_time) AS "Дата",
  EXTRACT(YEAR FROM s.first_event_time) AS "Год",
  EXTRACT(MONTH FROM s.first_event_time) AS "Месяц",
  EXTRACT(DAY FROM s.first_event_time) AS "День",
  EXTRACT(DOW FROM s.first_event_time) AS "День недели",
  EXTRACT(HOUR FROM s.first_event_time) AS "Час",
  TO_CHAR(s.first_event_time, 'YYYY-MM') AS "Год-Месяц"
FROM sessions s
LEFT JOIN users u ON s.user_id = u.id
ORDER BY s.first_event_time DESC;

COMMENT ON VIEW v_analytics_sessions IS 'Сессии пользователей для аналитики';


-- ============================================
-- VIEW 3: Метрики экспериментов
-- ============================================

CREATE OR REPLACE VIEW v_analytics_experiments AS
SELECT 
  em.date AS "Дата",
  em.experiment_key AS "Название эксперимента",
  em.experiment_variant AS "Вариант",
  -- Метрики пользователей
  em.users_count AS "Пользователей",
  em.new_users_count AS "Новых пользователей",
  em.returning_users_count AS "Вернувшихся пользователей",
  -- Метрики сессий
  em.sessions_count AS "Сессий",
  ROUND(em.avg_session_length_sec, 2) AS "Средняя длительность сессии (сек)",
  ROUND(em.avg_session_length_sec / 60.0, 2) AS "Средняя длительность сессии (мин)",
  -- Метрики событий
  em.events_count AS "Событий",
  em.page_views_count AS "Просмотров страниц",
  em.add_to_cart_count AS "Добавлений в корзину",
  em.checkout_started_count AS "Начали оформление",
  -- Конверсионные метрики
  em.orders_count AS "Заказов",
  em.orders_total_amount AS "Общая сумма заказов",
  ROUND(em.conversion_rate, 2) AS "Конверсия (%)",
  ROUND(em.avg_order_value, 2) AS "Средний чек",
  -- Вычисляемые метрики
  CASE 
    WHEN em.sessions_count > 0 
    THEN ROUND(em.events_count::NUMERIC / em.sessions_count, 2)
    ELSE 0 
  END AS "События на сессию",
  CASE 
    WHEN em.users_count > 0 
    THEN ROUND(em.sessions_count::NUMERIC / em.users_count, 2)
    ELSE 0 
  END AS "Сессий на пользователя",
  -- Временные измерения
  EXTRACT(YEAR FROM em.date) AS "Год",
  EXTRACT(MONTH FROM em.date) AS "Месяц",
  EXTRACT(DAY FROM em.date) AS "День",
  TO_CHAR(em.date, 'YYYY-MM') AS "Год-Месяц",
  em.updated_at AS "Обновлено"
FROM experiment_metrics_daily em
ORDER BY em.date DESC, em.experiment_key, em.experiment_variant;

COMMENT ON VIEW v_analytics_experiments IS 'Метрики A/B экспериментов по дням';


-- ============================================
-- VIEW 4: Общая статистика по дням
-- ============================================

CREATE OR REPLACE VIEW v_analytics_daily_stats AS
SELECT 
  ds.date AS "Дата",
  ds.total_users AS "Всего пользователей",
  ds.new_users AS "Новых пользователей",
  ds.active_users AS "Активных пользователей",
  ds.total_sessions AS "Сессий",
  ds.total_events AS "Событий",
  ds.total_orders AS "Заказов",
  ROUND(ds.total_revenue, 2) AS "Выручка",
  ROUND(ds.avg_session_length_sec, 2) AS "Средняя длительность сессии (сек)",
  ROUND(ds.avg_session_length_sec / 60.0, 2) AS "Средняя длительность сессии (мин)",
  ROUND(ds.avg_order_value, 2) AS "Средний чек",
  -- Вычисляемые метрики
  CASE 
    WHEN ds.active_users > 0 
    THEN ROUND(ds.total_orders::NUMERIC / ds.active_users * 100, 2)
    ELSE 0 
  END AS "Конверсия (%)",
  CASE 
    WHEN ds.total_sessions > 0 
    THEN ROUND(ds.total_events::NUMERIC / ds.total_sessions, 2)
    ELSE 0 
  END AS "События на сессию",
  CASE 
    WHEN ds.active_users > 0 
    THEN ROUND(ds.total_sessions::NUMERIC / ds.active_users, 2)
    ELSE 0 
  END AS "Сессий на пользователя",
  -- Временные измерения
  EXTRACT(YEAR FROM ds.date) AS "Год",
  EXTRACT(MONTH FROM ds.date) AS "Месяц",
  EXTRACT(DAY FROM ds.date) AS "День",
  EXTRACT(DOW FROM ds.date) AS "День недели",
  TO_CHAR(ds.date, 'YYYY-MM') AS "Год-Месяц",
  TO_CHAR(ds.date, 'Day') AS "Название дня недели"
FROM daily_stats ds
ORDER BY ds.date DESC;

COMMENT ON VIEW v_analytics_daily_stats IS 'Общая статистика по дням';


-- ============================================
-- VIEW 5: Retention анализ
-- ============================================

CREATE OR REPLACE VIEW v_analytics_retention AS
SELECT 
  ur.cohort_date AS "Дата когорты",
  COUNT(DISTINCT ur.user_id) AS "Размер когорты",
  COUNT(DISTINCT ur.user_id) FILTER (WHERE ur.day_0) AS "День 0",
  COUNT(DISTINCT ur.user_id) FILTER (WHERE ur.day_1) AS "День 1",
  COUNT(DISTINCT ur.user_id) FILTER (WHERE ur.day_7) AS "День 7",
  COUNT(DISTINCT ur.user_id) FILTER (WHERE ur.day_30) AS "День 30",
  -- Retention в процентах
  ROUND(
    COUNT(DISTINCT ur.user_id) FILTER (WHERE ur.day_1)::NUMERIC / 
    NULLIF(COUNT(DISTINCT ur.user_id), 0) * 100, 
    2
  ) AS "Retention День 1 (%)",
  ROUND(
    COUNT(DISTINCT ur.user_id) FILTER (WHERE ur.day_7)::NUMERIC / 
    NULLIF(COUNT(DISTINCT ur.user_id), 0) * 100, 
    2
  ) AS "Retention День 7 (%)",
  ROUND(
    COUNT(DISTINCT ur.user_id) FILTER (WHERE ur.day_30)::NUMERIC / 
    NULLIF(COUNT(DISTINCT ur.user_id), 0) * 100, 
    2
  ) AS "Retention День 30 (%)",
  -- Временные измерения
  EXTRACT(YEAR FROM ur.cohort_date) AS "Год",
  EXTRACT(MONTH FROM ur.cohort_date) AS "Месяц",
  TO_CHAR(ur.cohort_date, 'YYYY-MM') AS "Год-Месяц"
FROM user_retention ur
GROUP BY ur.cohort_date
ORDER BY ur.cohort_date DESC;

COMMENT ON VIEW v_analytics_retention IS 'Retention анализ по когортам';


-- ============================================
-- VIEW 6: Пользователи для аналитики
-- ============================================

CREATE OR REPLACE VIEW v_analytics_users AS
SELECT 
  u.id AS "ID пользователя",
  u.name AS "Имя",
  u.email AS "Email",
  u.phone AS "Телефон",
  u.phone_verified AS "Телефон подтверждён",
  u.xp AS "Опыт (XP)",
  CASE 
    WHEN u.xp >= 15000 THEN 'Мастер'
    WHEN u.xp >= 7000 THEN 'Эксперт'
    WHEN u.xp >= 3000 THEN 'Знаток'
    ELSE 'Новичок'
  END AS "Уровень лояльности",
  u.first_order_discount_used AS "Использовал скидку за первый заказ",
  u.custom_discount AS "Индивидуальная скидка (%)",
  u.wallet_balance AS "Баланс кошелька (коп)",
  ROUND(u.wallet_balance / 100.0, 2) AS "Баланс кошелька (руб)",
  -- Статистика заказов
  (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS "Количество заказов",
  (SELECT SUM(o.total) FROM orders o WHERE o.user_id = u.id AND o.status = 'paid') AS "Общая сумма заказов",
  -- Первый и последний заказ
  (SELECT MIN(o.created_at) FROM orders o WHERE o.user_id = u.id) AS "Первый заказ",
  (SELECT MAX(o.created_at) FROM orders o WHERE o.user_id = u.id) AS "Последний заказ",
  -- Активность
  (SELECT MIN(ec.event_time) FROM events_clean ec WHERE ec.user_id = u.id) AS "Первое посещение",
  (SELECT MAX(ec.event_time) FROM events_clean ec WHERE ec.user_id = u.id) AS "Последнее посещение",
  (SELECT COUNT(DISTINCT ec.session_id) FROM events_clean ec WHERE ec.user_id = u.id) AS "Количество сессий"
FROM users u
ORDER BY u.xp DESC;

COMMENT ON VIEW v_analytics_users IS 'Пользователи с метриками для аналитики';


-- ============================================
-- VIEW 7: Воронка конверсии
-- ============================================

CREATE OR REPLACE VIEW v_analytics_funnel AS
WITH funnel_data AS (
  SELECT 
    DATE(ec.event_time) AS date,
    ec.experiment_key,
    ec.experiment_variant,
    COUNT(DISTINCT ec.session_id) FILTER (WHERE ec.event_name = 'page_view') AS step_1_page_view,
    COUNT(DISTINCT ec.session_id) FILTER (WHERE ec.event_name = 'product_view') AS step_2_product_view,
    COUNT(DISTINCT ec.session_id) FILTER (WHERE ec.event_name = 'add_to_cart') AS step_3_add_to_cart,
    COUNT(DISTINCT ec.session_id) FILTER (WHERE ec.event_name = 'checkout_started') AS step_4_checkout_started,
    COUNT(DISTINCT ec.session_id) FILTER (WHERE ec.event_name = 'order_completed') AS step_5_order_completed
  FROM events_clean ec
  GROUP BY DATE(ec.event_time), ec.experiment_key, ec.experiment_variant
)
SELECT 
  date AS "Дата",
  experiment_key AS "Эксперимент",
  experiment_variant AS "Вариант",
  step_1_page_view AS "1. Просмотр страницы",
  step_2_product_view AS "2. Просмотр товара",
  step_3_add_to_cart AS "3. Добавление в корзину",
  step_4_checkout_started AS "4. Начало оформления",
  step_5_order_completed AS "5. Завершение заказа",
  -- Конверсия между этапами (%)
  ROUND(
    CASE WHEN step_1_page_view > 0 
    THEN step_2_product_view::NUMERIC / step_1_page_view * 100 
    ELSE 0 END, 
    2
  ) AS "1→2 (%)",
  ROUND(
    CASE WHEN step_2_product_view > 0 
    THEN step_3_add_to_cart::NUMERIC / step_2_product_view * 100 
    ELSE 0 END, 
    2
  ) AS "2→3 (%)",
  ROUND(
    CASE WHEN step_3_add_to_cart > 0 
    THEN step_4_checkout_started::NUMERIC / step_3_add_to_cart * 100 
    ELSE 0 END, 
    2
  ) AS "3→4 (%)",
  ROUND(
    CASE WHEN step_4_checkout_started > 0 
    THEN step_5_order_completed::NUMERIC / step_4_checkout_started * 100 
    ELSE 0 END, 
    2
  ) AS "4→5 (%)",
  -- Общая конверсия
  ROUND(
    CASE WHEN step_1_page_view > 0 
    THEN step_5_order_completed::NUMERIC / step_1_page_view * 100 
    ELSE 0 END, 
    2
  ) AS "Общая конверсия (%)"
FROM funnel_data
ORDER BY date DESC;

COMMENT ON VIEW v_analytics_funnel IS 'Воронка конверсии с процентами между этапами';


-- ============================================
-- VIEW 8: Товары - метрики продаж
-- ============================================

CREATE OR REPLACE VIEW v_analytics_products AS
SELECT 
  p.id AS "ID товара",
  p.name AS "Название",
  p.category AS "Категория",
  p.tea_type AS "Тип чая",
  p.price_per_gram AS "Цена за грамм",
  p.out_of_stock AS "Нет в наличии",
  -- Метрики просмотров
  (SELECT COUNT(*) FROM events_clean ec 
   WHERE ec.event_name = 'product_view' 
     AND ec.product_id = p.id) AS "Просмотров",
  -- Метрики добавлений в корзину
  (SELECT COUNT(*) FROM events_clean ec 
   WHERE ec.event_name = 'add_to_cart' 
     AND ec.product_id = p.id) AS "Добавлений в корзину",
  -- Метрики заказов (из таблицы orders)
  (SELECT COUNT(*) FROM orders o, 
   jsonb_array_elements(o.items::jsonb) AS item
   WHERE (item->>'id')::INTEGER = p.id) AS "Заказов",
  (SELECT SUM((item->>'quantity')::INTEGER) FROM orders o,
   jsonb_array_elements(o.items::jsonb) AS item
   WHERE (item->>'id')::INTEGER = p.id) AS "Продано (грамм/шт)",
  -- Конверсия
  ROUND(
    CASE 
      WHEN (SELECT COUNT(*) FROM events_clean ec 
            WHERE ec.event_name = 'product_view' 
              AND ec.product_id = p.id) > 0
      THEN (SELECT COUNT(*) FROM events_clean ec 
            WHERE ec.event_name = 'add_to_cart' 
              AND ec.product_id = p.id)::NUMERIC /
           (SELECT COUNT(*) FROM events_clean ec 
            WHERE ec.event_name = 'product_view' 
              AND ec.product_id = p.id) * 100
      ELSE 0
    END,
    2
  ) AS "Конверсия просмотр→корзина (%)"
FROM products p
ORDER BY "Просмотров" DESC NULLS LAST;

COMMENT ON VIEW v_analytics_products IS 'Товары с метриками просмотров и продаж';


-- ============================================
-- СПИСОК ВСЕХ VIEW ДЛЯ ПОДКЛЮЧЕНИЯ В BI
-- ============================================

/*
Для подключения к Yandex DataLens или Metabase используйте следующие VIEW:

1. v_analytics_events - События (события пользователей)
2. v_analytics_sessions - Сессии (пользовательские сессии)
3. v_analytics_experiments - A/B эксперименты (метрики по вариантам)
4. v_analytics_daily_stats - Общая статистика (дневные агрегаты)
5. v_analytics_retention - Retention (возвращаемость пользователей)
6. v_analytics_users - Пользователи (профили с метриками)
7. v_analytics_funnel - Воронка конверсии (этапы покупки)
8. v_analytics_products - Товары (метрики продаж)

Все VIEW имеют человекочитаемые названия колонок на русском языке.
*/
