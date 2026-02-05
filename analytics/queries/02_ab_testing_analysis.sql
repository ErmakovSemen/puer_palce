-- ============================================
-- A/B Тестирование - Анализ Экспериментов
-- ============================================
--
-- Комплексные запросы для анализа A/B экспериментов
-- и статистической значимости результатов

-- ============================================
-- 1. ОБЗОР ВСЕХ АКТИВНЫХ ЭКСПЕРИМЕНТОВ
-- ============================================

-- Список активных экспериментов с основными метриками
SELECT 
  e.test_id AS "ID эксперимента",
  e.name AS "Название",
  e.status AS "Статус",
  e.created_at AS "Создан",
  -- Подсчёт участников
  (
    SELECT COUNT(DISTINCT user_id)
    FROM events_clean ec
    WHERE ec.experiment_key = e.test_id
      AND ec.event_time >= e.created_at::TIMESTAMPTZ
  ) AS "Всего участников",
  -- Подсчёт вариантов
  jsonb_array_length(e.variants::jsonb) AS "Количество вариантов"
FROM experiments e
WHERE e.status = 'active'
ORDER BY e.created_at DESC;


-- ============================================
-- 2. СРАВНЕНИЕ ВАРИАНТОВ (Базовый анализ)
-- ============================================

-- Замените 'your-experiment-key' на реальный ключ эксперимента
-- Например: 'checkout-button-color', 'pricing-test', etc.

WITH experiment_data AS (
  SELECT 
    experiment_variant AS variant,
    -- Пользователи
    COUNT(DISTINCT user_id) AS users,
    COUNT(DISTINCT user_id) FILTER (
      WHERE event_name = 'order_completed'
    ) AS converted_users,
    -- События
    COUNT(*) AS total_events,
    COUNT(*) FILTER (WHERE event_name = 'page_view') AS page_views,
    COUNT(*) FILTER (WHERE event_name = 'product_view') AS product_views,
    COUNT(*) FILTER (WHERE event_name = 'add_to_cart') AS add_to_cart,
    COUNT(*) FILTER (WHERE event_name = 'checkout_started') AS checkout_started,
    COUNT(*) FILTER (WHERE event_name = 'order_completed') AS orders,
    -- Выручка
    COALESCE(SUM(order_total), 0) AS total_revenue,
    -- Сессии
    COUNT(DISTINCT session_id) AS sessions,
    AVG((
      SELECT session_length_sec 
      FROM sessions s 
      WHERE s.session_id = events_clean.session_id
    )) AS avg_session_length
  FROM events_clean
  WHERE experiment_key = 'your-experiment-key'  -- ЗАМЕНИТЕ НА ВАШЕ ЗНАЧЕНИЕ
    AND event_time >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY experiment_variant
)
SELECT 
  variant AS "Вариант",
  users AS "Пользователей",
  sessions AS "Сессий",
  ROUND(sessions::NUMERIC / NULLIF(users, 0), 2) AS "Сессий на пользователя",
  ROUND(avg_session_length / 60.0, 2) AS "Средняя длительность (мин)",
  -- Конверсия в просмотр товара
  product_views AS "Просмотров товара",
  ROUND(product_views::NUMERIC / NULLIF(users, 0) * 100, 2) AS "% просмотрели товар",
  -- Конверсия в корзину
  add_to_cart AS "Добавлений в корзину",
  ROUND(add_to_cart::NUMERIC / NULLIF(users, 0) * 100, 2) AS "% добавили в корзину",
  -- Конверсия в оформление
  checkout_started AS "Начали оформление",
  ROUND(checkout_started::NUMERIC / NULLIF(users, 0) * 100, 2) AS "% начали оформление",
  -- Основная конверсия (в заказ)
  orders AS "Заказов",
  converted_users AS "Пользователей с заказом",
  ROUND(converted_users::NUMERIC / NULLIF(users, 0) * 100, 2) AS "Конверсия (%)",
  -- Метрики выручки
  ROUND(total_revenue, 2) AS "Выручка (₽)",
  ROUND(total_revenue / NULLIF(users, 0), 2) AS "ARPU (₽)",
  ROUND(total_revenue / NULLIF(orders, 0), 2) AS "Средний чек (₽)"
FROM experiment_data
ORDER BY variant;


-- ============================================
-- 3. СТАТИСТИЧЕСКАЯ ЗНАЧИМОСТЬ (Z-test для конверсии)
-- ============================================

-- Сравнение двух вариантов с расчётом статистической значимости
-- Используется для бинарной метрики (конверсия да/нет)

WITH variant_stats AS (
  SELECT 
    experiment_variant AS variant,
    COUNT(DISTINCT user_id) AS total_users,
    COUNT(DISTINCT user_id) FILTER (WHERE event_name = 'order_completed') AS converted_users,
    COUNT(DISTINCT user_id) FILTER (WHERE event_name = 'order_completed')::NUMERIC / 
      NULLIF(COUNT(DISTINCT user_id), 0) AS conversion_rate
  FROM events_clean
  WHERE experiment_key = 'your-experiment-key'  -- ЗАМЕНИТЕ
    AND event_time >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY experiment_variant
),
control AS (
  SELECT * FROM variant_stats WHERE variant = 'control' OR variant = 'A'  -- ЗАМЕНИТЕ на ваш контроль
),
treatment AS (
  SELECT * FROM variant_stats WHERE variant != 'control' AND variant != 'A'
),
test_results AS (
  SELECT 
    c.variant AS control_variant,
    t.variant AS treatment_variant,
    c.total_users AS control_users,
    c.converted_users AS control_conversions,
    c.conversion_rate AS control_rate,
    t.total_users AS treatment_users,
    t.converted_users AS treatment_conversions,
    t.conversion_rate AS treatment_rate,
    -- Расчёт относительного изменения
    (t.conversion_rate - c.conversion_rate) / NULLIF(c.conversion_rate, 0) * 100 AS relative_change_pct,
    -- Расчёт абсолютного изменения
    (t.conversion_rate - c.conversion_rate) * 100 AS absolute_change_pct,
    -- Объединённая конверсия (pooled)
    (c.converted_users + t.converted_users)::NUMERIC / 
      NULLIF(c.total_users + t.total_users, 0) AS pooled_rate,
    -- Standard Error
    SQRT(
      ((c.converted_users + t.converted_users)::NUMERIC / 
       NULLIF(c.total_users + t.total_users, 0)) *
      (1 - (c.converted_users + t.converted_users)::NUMERIC / 
       NULLIF(c.total_users + t.total_users, 0)) *
      (1.0 / NULLIF(c.total_users, 0) + 1.0 / NULLIF(t.total_users, 0))
    ) AS standard_error,
    -- Z-score
    (t.conversion_rate - c.conversion_rate) / NULLIF(
      SQRT(
        ((c.converted_users + t.converted_users)::NUMERIC / 
         NULLIF(c.total_users + t.total_users, 0)) *
        (1 - (c.converted_users + t.converted_users)::NUMERIC / 
         NULLIF(c.total_users + t.total_users, 0)) *
        (1.0 / NULLIF(c.total_users, 0) + 1.0 / NULLIF(t.total_users, 0))
      ), 0
    ) AS z_score
  FROM control c
  CROSS JOIN treatment t
)
SELECT 
  control_variant AS "Контроль",
  treatment_variant AS "Тест",
  control_users AS "Пользователей (контроль)",
  ROUND(control_rate * 100, 2) AS "Конверсия контроль (%)",
  treatment_users AS "Пользователей (тест)",
  ROUND(treatment_rate * 100, 2) AS "Конверсия тест (%)",
  ROUND(absolute_change_pct, 2) AS "Изменение абс. (п.п.)",
  ROUND(relative_change_pct, 1) AS "Изменение отн. (%)",
  ROUND(z_score, 3) AS "Z-score",
  CASE 
    WHEN ABS(z_score) >= 2.576 THEN '✓ Значимо (99%)'
    WHEN ABS(z_score) >= 1.96 THEN '✓ Значимо (95%)'
    WHEN ABS(z_score) >= 1.645 THEN '~ Почти значимо (90%)'
    ELSE '✗ Не значимо'
  END AS "Статистическая значимость"
FROM test_results;


-- ============================================
-- 4. ДИНАМИКА ЭКСПЕРИМЕНТА ПО ДНЯМ
-- ============================================

-- Как изменяется конверсия вариантов по дням
WITH daily_metrics AS (
  SELECT 
    DATE(event_time) AS date,
    experiment_variant AS variant,
    COUNT(DISTINCT user_id) AS users,
    COUNT(DISTINCT user_id) FILTER (WHERE event_name = 'order_completed') AS conversions,
    ROUND(
      COUNT(DISTINCT user_id) FILTER (WHERE event_name = 'order_completed')::NUMERIC / 
      NULLIF(COUNT(DISTINCT user_id), 0) * 100,
      2
    ) AS conversion_rate
  FROM events_clean
  WHERE experiment_key = 'your-experiment-key'  -- ЗАМЕНИТЕ
    AND event_time >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY DATE(event_time), experiment_variant
)
SELECT 
  date AS "Дата",
  variant AS "Вариант",
  users AS "Пользователей",
  conversions AS "Конверсий",
  conversion_rate AS "Конверсия (%)",
  -- Накопительная конверсия
  ROUND(
    SUM(conversions) OVER (PARTITION BY variant ORDER BY date)::NUMERIC /
    NULLIF(SUM(users) OVER (PARTITION BY variant ORDER BY date), 0) * 100,
    2
  ) AS "Накопительная конверсия (%)"
FROM daily_metrics
ORDER BY date DESC, variant;


-- ============================================
-- 5. SAMPLE SIZE CALCULATOR (Достаточность выборки)
-- ============================================

-- Проверка, достаточно ли данных для статистически значимых выводов
-- MDE = Minimum Detectable Effect (минимальный детектируемый эффект)

WITH current_sample AS (
  SELECT 
    experiment_variant AS variant,
    COUNT(DISTINCT user_id) AS sample_size,
    COUNT(DISTINCT user_id) FILTER (WHERE event_name = 'order_completed')::NUMERIC / 
      NULLIF(COUNT(DISTINCT user_id), 0) AS conversion_rate
  FROM events_clean
  WHERE experiment_key = 'your-experiment-key'  -- ЗАМЕНИТЕ
  GROUP BY experiment_variant
),
control_stats AS (
  SELECT * FROM current_sample WHERE variant = 'control' OR variant = 'A'  -- ЗАМЕНИТЕ
),
required_sample AS (
  SELECT 
    c.variant,
    c.sample_size AS current_sample,
    c.conversion_rate,
    -- Требуемый размер выборки для обнаружения 10% относительного изменения
    -- с alpha=0.05 и power=0.80
    CEILING(
      2 * POWER(1.96 + 0.84, 2) * c.conversion_rate * (1 - c.conversion_rate) /
      POWER(0.10 * c.conversion_rate, 2)
    ) AS required_sample_10pct,
    -- Для 20% изменения
    CEILING(
      2 * POWER(1.96 + 0.84, 2) * c.conversion_rate * (1 - c.conversion_rate) /
      POWER(0.20 * c.conversion_rate, 2)
    ) AS required_sample_20pct
  FROM control_stats c
)
SELECT 
  variant AS "Вариант",
  current_sample AS "Текущий размер",
  ROUND(conversion_rate * 100, 2) AS "Текущая конверсия (%)",
  required_sample_10pct AS "Требуется для 10% изменения",
  required_sample_20pct AS "Требуется для 20% изменения",
  CASE 
    WHEN current_sample >= required_sample_10pct THEN '✓ Достаточно (10%)'
    WHEN current_sample >= required_sample_20pct THEN '✓ Достаточно (20%)'
    ELSE '✗ Недостаточно'
  END AS "Статус",
  ROUND((current_sample::NUMERIC / required_sample_10pct) * 100, 0) AS "% от требуемого (10%)"
FROM required_sample;


-- ============================================
-- 6. СЕГМЕНТАЦИЯ ПОЛЬЗОВАТЕЛЕЙ В ЭКСПЕРИМЕНТЕ
-- ============================================

-- Как разные сегменты пользователей реагируют на эксперимент

-- По типу устройства
SELECT 
  experiment_variant AS "Вариант",
  s.device_type AS "Устройство",
  COUNT(DISTINCT ec.user_id) AS "Пользователей",
  COUNT(DISTINCT ec.user_id) FILTER (WHERE ec.event_name = 'order_completed') AS "Конверсий",
  ROUND(
    COUNT(DISTINCT ec.user_id) FILTER (WHERE ec.event_name = 'order_completed')::NUMERIC /
    NULLIF(COUNT(DISTINCT ec.user_id), 0) * 100,
    2
  ) AS "Конверсия (%)"
FROM events_clean ec
JOIN sessions s ON ec.session_id = s.session_id
WHERE ec.experiment_key = 'your-experiment-key'  -- ЗАМЕНИТЕ
  AND ec.event_time >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY experiment_variant, s.device_type
ORDER BY experiment_variant, COUNT(DISTINCT ec.user_id) DESC;


-- По уровню лояльности
SELECT 
  ec.experiment_variant AS "Вариант",
  CASE 
    WHEN u.xp >= 15000 THEN 'Мастер'
    WHEN u.xp >= 7000 THEN 'Эксперт'
    WHEN u.xp >= 3000 THEN 'Знаток'
    ELSE 'Новичок'
  END AS "Уровень лояльности",
  COUNT(DISTINCT ec.user_id) AS "Пользователей",
  COUNT(DISTINCT ec.user_id) FILTER (WHERE ec.event_name = 'order_completed') AS "Конверсий",
  ROUND(
    COUNT(DISTINCT ec.user_id) FILTER (WHERE ec.event_name = 'order_completed')::NUMERIC /
    NULLIF(COUNT(DISTINCT ec.user_id), 0) * 100,
    2
  ) AS "Конверсия (%)"
FROM events_clean ec
LEFT JOIN users u ON ec.user_id = u.id
WHERE ec.experiment_key = 'your-experiment-key'  -- ЗАМЕНИТЕ
  AND ec.event_time >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY ec.experiment_variant, 
  CASE 
    WHEN u.xp >= 15000 THEN 'Мастер'
    WHEN u.xp >= 7000 THEN 'Эксперт'
    WHEN u.xp >= 3000 THEN 'Знаток'
    ELSE 'Новичок'
  END
ORDER BY experiment_variant, COUNT(DISTINCT ec.user_id) DESC;


-- ============================================
-- 7. ДЕТАЛЬНАЯ ВОРОНКА ПО ВАРИАНТАМ
-- ============================================

-- Воронка конверсии для каждого варианта эксперимента
WITH funnel_data AS (
  SELECT 
    experiment_variant AS variant,
    COUNT(DISTINCT user_id) AS total_users,
    COUNT(DISTINCT user_id) FILTER (WHERE event_name = 'page_view') AS step_1,
    COUNT(DISTINCT user_id) FILTER (WHERE event_name = 'product_view') AS step_2,
    COUNT(DISTINCT user_id) FILTER (WHERE event_name = 'add_to_cart') AS step_3,
    COUNT(DISTINCT user_id) FILTER (WHERE event_name = 'checkout_started') AS step_4,
    COUNT(DISTINCT user_id) FILTER (WHERE event_name = 'order_completed') AS step_5
  FROM events_clean
  WHERE experiment_key = 'your-experiment-key'  -- ЗАМЕНИТЕ
    AND event_time >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY experiment_variant
)
SELECT 
  variant AS "Вариант",
  total_users AS "Всего пользователей",
  step_1 AS "Просмотр",
  ROUND(step_1::NUMERIC / NULLIF(total_users, 0) * 100, 1) AS "% Просмотр",
  step_2 AS "Товар",
  ROUND(step_2::NUMERIC / NULLIF(step_1, 0) * 100, 1) AS "% Товар",
  step_3 AS "Корзина",
  ROUND(step_3::NUMERIC / NULLIF(step_2, 0) * 100, 1) AS "% Корзина",
  step_4 AS "Оформление",
  ROUND(step_4::NUMERIC / NULLIF(step_3, 0) * 100, 1) AS "% Оформление",
  step_5 AS "Заказ",
  ROUND(step_5::NUMERIC / NULLIF(step_4, 0) * 100, 1) AS "% Заказ",
  ROUND(step_5::NUMERIC / NULLIF(total_users, 0) * 100, 2) AS "Общая конверсия (%)"
FROM funnel_data
ORDER BY variant;


-- ============================================
-- 8. МЕТРИКИ ВОВЛЕЧЁННОСТИ ПО ВАРИАНТАМ
-- ============================================

-- Сравнение метрик вовлечённости (не только конверсия)
SELECT 
  experiment_variant AS "Вариант",
  COUNT(DISTINCT user_id) AS "Пользователей",
  COUNT(DISTINCT session_id) AS "Сессий",
  ROUND(COUNT(DISTINCT session_id)::NUMERIC / NULLIF(COUNT(DISTINCT user_id), 0), 2) AS "Сессий/Пользователь",
  ROUND(AVG((
    SELECT session_length_sec 
    FROM sessions s 
    WHERE s.session_id = events_clean.session_id
  )) / 60.0, 2) AS "Средняя длительность (мин)",
  ROUND(COUNT(*)::NUMERIC / NULLIF(COUNT(DISTINCT session_id), 0), 1) AS "События/Сессию",
  COUNT(*) FILTER (WHERE event_name = 'page_view') AS "Просмотров страниц",
  ROUND(
    COUNT(*) FILTER (WHERE event_name = 'page_view')::NUMERIC /
    NULLIF(COUNT(DISTINCT session_id), 0),
    1
  ) AS "Страниц/Сессию"
FROM events_clean
WHERE experiment_key = 'your-experiment-key'  -- ЗАМЕНИТЕ
  AND event_time >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY experiment_variant
ORDER BY variant;


-- ============================================
-- 9. ВЫРУЧКА ПО ВАРИАНТАМ (Revenue Analysis)
-- ============================================

-- Детальный анализ выручки по вариантам
WITH revenue_data AS (
  SELECT 
    experiment_variant AS variant,
    COUNT(DISTINCT user_id) AS total_users,
    COUNT(DISTINCT order_id) AS orders,
    COALESCE(SUM(order_total), 0) AS total_revenue,
    COALESCE(AVG(order_total), 0) AS avg_order_value,
    COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY order_total), 0) AS median_order_value
  FROM events_clean
  WHERE experiment_key = 'your-experiment-key'  -- ЗАМЕНИТЕ
    AND event_time >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY experiment_variant
)
SELECT 
  variant AS "Вариант",
  total_users AS "Пользователей",
  orders AS "Заказов",
  ROUND(total_revenue, 2) AS "Выручка (₽)",
  ROUND(total_revenue / NULLIF(total_users, 0), 2) AS "ARPU (₽)",
  ROUND(avg_order_value, 2) AS "Средний чек (₽)",
  ROUND(median_order_value, 2) AS "Медианный чек (₽)",
  ROUND(orders::NUMERIC / NULLIF(total_users, 0), 3) AS "Заказов на пользователя"
FROM revenue_data
ORDER BY variant;


-- ============================================
-- 10. ВРЕМЯ ДО КОНВЕРСИИ (Time to Conversion)
-- ============================================

-- Сколько времени пользователям нужно для конверсии в разных вариантах
WITH first_event AS (
  SELECT 
    user_id,
    experiment_variant,
    MIN(event_time) AS first_event_time
  FROM events_clean
  WHERE experiment_key = 'your-experiment-key'  -- ЗАМЕНИТЕ
  GROUP BY user_id, experiment_variant
),
conversion_event AS (
  SELECT 
    user_id,
    experiment_variant,
    MIN(event_time) AS conversion_time
  FROM events_clean
  WHERE experiment_key = 'your-experiment-key'  -- ЗАМЕНИТЕ
    AND event_name = 'order_completed'
  GROUP BY user_id, experiment_variant
),
time_to_convert AS (
  SELECT 
    fe.experiment_variant,
    EXTRACT(EPOCH FROM (ce.conversion_time - fe.first_event_time)) / 60.0 AS minutes_to_convert
  FROM first_event fe
  INNER JOIN conversion_event ce ON fe.user_id = ce.user_id
    AND fe.experiment_variant = ce.experiment_variant
)
SELECT 
  experiment_variant AS "Вариант",
  COUNT(*) AS "Конверсий",
  ROUND(AVG(minutes_to_convert), 1) AS "Среднее время (мин)",
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY minutes_to_convert), 1) AS "Медиана (мин)",
  ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY minutes_to_convert), 1) AS "25 перцентиль (мин)",
  ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY minutes_to_convert), 1) AS "75 перцентиль (мин)"
FROM time_to_convert
GROUP BY experiment_variant
ORDER BY experiment_variant;


-- ============================================
-- ШПАРГАЛКА: Как запускать анализ
-- ============================================

/*
1. Найдите ключ вашего эксперимента:
   SELECT DISTINCT experiment_key FROM events_clean WHERE experiment_key IS NOT NULL;

2. Замените 'your-experiment-key' в запросах выше на ваш ключ

3. Убедитесь, что указали правильный контрольный вариант (обычно 'control' или 'A')

4. Рекомендуемый порядок анализа:
   - Обзор экспериментов (запрос 1)
   - Базовое сравнение вариантов (запрос 2)
   - Проверка достаточности выборки (запрос 5)
   - Статистическая значимость (запрос 3)
   - Детальная воронка (запрос 7)
   - Сегментация (запрос 6)

5. Интерпретация Z-score:
   - |Z| >= 1.96: статистически значимо (95% уверенность)
   - |Z| >= 2.576: высоко значимо (99% уверенность)
   - |Z| < 1.96: недостаточно данных или нет эффекта
*/
