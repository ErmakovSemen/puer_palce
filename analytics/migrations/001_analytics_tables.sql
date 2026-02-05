-- ============================================
-- Analytics System - Table Migrations
-- ============================================
-- 
-- Минималистичная система аналитики для веб-проекта
-- База данных: PostgreSQL (Neon)
-- BI: Yandex DataLens / Metabase
--

-- ============================================
-- 1. RAW EVENTS TABLE (Сырые логи событий)
-- ============================================

CREATE TABLE IF NOT EXISTS raw_events (
  id BIGSERIAL PRIMARY KEY,
  event_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id VARCHAR,  -- Может быть NULL для анонимных пользователей
  session_id VARCHAR,
  request_id VARCHAR,  -- Для дедупликации событий
  event_name VARCHAR NOT NULL,
  source VARCHAR NOT NULL,  -- 'frontend' или 'backend'
  page VARCHAR,  -- URL или название страницы
  experiment_key VARCHAR,  -- Ключ эксперимента (если участвует)
  experiment_variant VARCHAR,  -- Вариант эксперимента
  properties JSONB,  -- Дополнительные свойства события
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE raw_events IS 'Сырые события с фронтенда и бэкенда';
COMMENT ON COLUMN raw_events.event_time IS 'Время события (от клиента или сервера)';
COMMENT ON COLUMN raw_events.user_id IS 'ID пользователя (NULL для анонимных)';
COMMENT ON COLUMN raw_events.session_id IS 'ID сессии для группировки событий';
COMMENT ON COLUMN raw_events.request_id IS 'Уникальный ID запроса для дедупликации';
COMMENT ON COLUMN raw_events.properties IS 'Произвольные данные события в JSON';

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_raw_events_event_time ON raw_events (event_time DESC);
CREATE INDEX IF NOT EXISTS idx_raw_events_user_time ON raw_events (user_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_raw_events_session_time ON raw_events (session_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_raw_events_experiment ON raw_events (experiment_key, experiment_variant) WHERE experiment_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_raw_events_event_name ON raw_events (event_name, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_raw_events_request_id ON raw_events (request_id) WHERE request_id IS NOT NULL;

-- Индекс для JSONB свойств (GIN индекс)
CREATE INDEX IF NOT EXISTS idx_raw_events_properties ON raw_events USING GIN (properties);


-- ============================================
-- 2. USERS DIMENSION TABLE (Справочник пользователей)
-- ============================================
-- Уже есть таблица users в основной схеме
-- Можно создать VIEW для аналитики, который берёт нужные поля

CREATE OR REPLACE VIEW users_dim AS
SELECT 
  id AS user_id,
  name,
  phone,
  email,
  phone_verified,
  xp,
  first_order_discount_used,
  custom_discount,
  wallet_balance,
  -- Добавим вычисляемый уровень лояльности
  CASE 
    WHEN xp >= 15000 THEN 4
    WHEN xp >= 7000 THEN 3
    WHEN xp >= 3000 THEN 2
    ELSE 1
  END AS loyalty_level
FROM users;

COMMENT ON VIEW users_dim IS 'Справочник пользователей для аналитики';


-- ============================================
-- 3. SESSIONS TABLE (Обработанные сессии)
-- ============================================

CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR PRIMARY KEY,
  user_id VARCHAR,
  first_event_time TIMESTAMPTZ NOT NULL,
  last_event_time TIMESTAMPTZ NOT NULL,
  session_length_sec INTEGER,  -- Длительность сессии в секундах
  events_count INTEGER NOT NULL DEFAULT 0,
  landing_page VARCHAR,
  exit_page VARCHAR,
  experiment_key VARCHAR,
  experiment_variant VARCHAR,
  -- Дополнительные метрики
  page_views_count INTEGER DEFAULT 0,
  add_to_cart_count INTEGER DEFAULT 0,
  checkout_started BOOLEAN DEFAULT FALSE,
  order_completed BOOLEAN DEFAULT FALSE,
  device_type VARCHAR,  -- mobile, desktop, tablet
  referrer VARCHAR,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE sessions IS 'Агрегированные данные по сессиям пользователей';
COMMENT ON COLUMN sessions.session_length_sec IS 'Длительность сессии в секундах (last_event - first_event)';

-- Индексы для аналитики сессий
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id, first_event_time DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_first_event ON sessions (first_event_time DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_experiment ON sessions (experiment_key, experiment_variant) WHERE experiment_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_order_completed ON sessions (order_completed, first_event_time DESC);


-- ============================================
-- 4. EVENTS CLEAN TABLE (Очищенные события)
-- ============================================

CREATE TABLE IF NOT EXISTS events_clean (
  id BIGSERIAL PRIMARY KEY,
  event_time TIMESTAMPTZ NOT NULL,
  user_id VARCHAR,
  session_id VARCHAR,
  event_name VARCHAR NOT NULL,
  source VARCHAR NOT NULL,
  page VARCHAR,
  experiment_key VARCHAR,
  experiment_variant VARCHAR,
  -- Обогащённые данные
  user_name VARCHAR,
  user_loyalty_level INTEGER,
  -- Распакованные из properties популярные поля
  product_id INTEGER,
  product_name VARCHAR,
  order_id INTEGER,
  order_total NUMERIC,
  properties JSONB,  -- Остальные свойства
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE events_clean IS 'Очищенные и обогащённые события для аналитики';
COMMENT ON COLUMN events_clean.processed_at IS 'Время обработки события ETL процессом';

-- Индексы
CREATE INDEX IF NOT EXISTS idx_events_clean_event_time ON events_clean (event_time DESC);
CREATE INDEX IF NOT EXISTS idx_events_clean_user_time ON events_clean (user_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_events_clean_session ON events_clean (session_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_events_clean_event_name ON events_clean (event_name, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_events_clean_experiment ON events_clean (experiment_key, experiment_variant) WHERE experiment_key IS NOT NULL;


-- ============================================
-- 5. EXPERIMENT METRICS DAILY (Ежедневная агрегация по экспериментам)
-- ============================================

CREATE TABLE IF NOT EXISTS experiment_metrics_daily (
  date DATE NOT NULL,
  experiment_key VARCHAR NOT NULL,
  experiment_variant VARCHAR NOT NULL,
  -- Метрики пользователей
  users_count INTEGER NOT NULL DEFAULT 0,
  new_users_count INTEGER DEFAULT 0,
  returning_users_count INTEGER DEFAULT 0,
  -- Метрики сессий
  sessions_count INTEGER NOT NULL DEFAULT 0,
  avg_session_length_sec NUMERIC,
  -- Метрики событий
  events_count INTEGER NOT NULL DEFAULT 0,
  page_views_count INTEGER DEFAULT 0,
  add_to_cart_count INTEGER DEFAULT 0,
  checkout_started_count INTEGER DEFAULT 0,
  -- Конверсионные метрики
  orders_count INTEGER DEFAULT 0,
  orders_total_amount NUMERIC DEFAULT 0,
  conversion_rate NUMERIC,  -- orders_count / users_count
  avg_order_value NUMERIC,  -- orders_total_amount / orders_count
  -- Метаданные
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (date, experiment_key, experiment_variant)
);

COMMENT ON TABLE experiment_metrics_daily IS 'Ежедневные метрики по A/B экспериментам';
COMMENT ON COLUMN experiment_metrics_daily.conversion_rate IS 'Процент пользователей, совершивших заказ';

-- Индексы
CREATE INDEX IF NOT EXISTS idx_experiment_metrics_date ON experiment_metrics_daily (date DESC);
CREATE INDEX IF NOT EXISTS idx_experiment_metrics_experiment ON experiment_metrics_daily (experiment_key, date DESC);


-- ============================================
-- 6. ETL TRACKING TABLE (Отслеживание ETL процессов)
-- ============================================

CREATE TABLE IF NOT EXISTS etl_runs (
  id SERIAL PRIMARY KEY,
  job_name VARCHAR NOT NULL,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  status VARCHAR NOT NULL DEFAULT 'running',  -- running, success, failed
  rows_processed INTEGER,
  error_message TEXT,
  metadata JSONB
);

COMMENT ON TABLE etl_runs IS 'История запусков ETL процессов';

CREATE INDEX IF NOT EXISTS idx_etl_runs_job_name ON etl_runs (job_name, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_etl_runs_status ON etl_runs (status, start_time DESC);


-- ============================================
-- 7. RETENTION TABLE (Retention-анализ)
-- ============================================

CREATE TABLE IF NOT EXISTS user_retention (
  cohort_date DATE NOT NULL,  -- Дата первого посещения
  user_id VARCHAR NOT NULL,
  day_0 BOOLEAN DEFAULT FALSE,  -- День регистрации
  day_1 BOOLEAN DEFAULT FALSE,  -- Вернулся на 1 день
  day_7 BOOLEAN DEFAULT FALSE,  -- Вернулся на 7 день
  day_30 BOOLEAN DEFAULT FALSE, -- Вернулся на 30 день
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cohort_date, user_id)
);

COMMENT ON TABLE user_retention IS 'Retention-метрики пользователей по когортам';

CREATE INDEX IF NOT EXISTS idx_retention_cohort ON user_retention (cohort_date DESC);


-- ============================================
-- 8. DAILY STATS TABLE (Общая статистика по дням)
-- ============================================

CREATE TABLE IF NOT EXISTS daily_stats (
  date DATE PRIMARY KEY,
  total_users INTEGER DEFAULT 0,
  new_users INTEGER DEFAULT 0,
  active_users INTEGER DEFAULT 0,  -- Пользователи с хотя бы 1 событием
  total_sessions INTEGER DEFAULT 0,
  total_events INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  avg_session_length_sec NUMERIC,
  avg_order_value NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE daily_stats IS 'Общая статистика по дням (для дашбордов)';
