-- ============================================
-- ТЕСТОВЫЙ СКРИПТ СИСТЕМЫ АНАЛИТИКИ
-- ============================================
--
-- Этот скрипт позволяет проверить работу системы
-- без необходимости полной установки
--

-- ============================================
-- ПРОВЕРКА 1: Существуют ли таблицы?
-- ============================================

\echo '=== ПРОВЕРКА ТАБЛИЦ ==='
SELECT 
  'raw_events' AS table_name,
  EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'raw_events'
  ) AS exists
UNION ALL
SELECT 'sessions', EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sessions')
UNION ALL
SELECT 'events_clean', EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'events_clean')
UNION ALL
SELECT 'experiment_metrics_daily', EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'experiment_metrics_daily')
UNION ALL
SELECT 'daily_stats', EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'daily_stats')
UNION ALL
SELECT 'user_retention', EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_retention')
UNION ALL
SELECT 'etl_runs', EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'etl_runs');

-- ============================================
-- ПРОВЕРКА 2: Существуют ли ETL функции?
-- ============================================

\echo ''
\echo '=== ПРОВЕРКА ETL ФУНКЦИЙ ==='
SELECT 
  routine_name AS function_name,
  'EXISTS' AS status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
  AND routine_name IN (
    'process_sessions',
    'process_events_clean',
    'aggregate_experiment_metrics_daily',
    'aggregate_daily_stats',
    'update_user_retention',
    'cleanup_old_raw_events'
  )
ORDER BY routine_name;

-- ============================================
-- ПРОВЕРКА 3: Существуют ли VIEW для BI?
-- ============================================

\echo ''
\echo '=== ПРОВЕРКА BI VIEWS ==='
SELECT 
  table_name AS view_name,
  'EXISTS' AS status
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name LIKE 'v_analytics_%'
ORDER BY table_name;

-- ============================================
-- ПРОВЕРКА 4: Установлен ли pg_cron?
-- ============================================

\echo ''
\echo '=== ПРОВЕРКА PG_CRON ==='
SELECT 
  CASE 
    WHEN EXISTS (SELECT FROM pg_extension WHERE extname = 'pg_cron') 
    THEN 'pg_cron установлен ✓'
    ELSE 'pg_cron НЕ установлен ✗ - выполните CREATE EXTENSION pg_cron;'
  END AS status;

-- Если pg_cron установлен, показываем задачи
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'Задачи pg_cron:';
  END IF;
END $$;

SELECT 
  jobid,
  jobname,
  schedule,
  active,
  database
FROM cron.job
WHERE database = current_database()
ORDER BY jobid;

-- ============================================
-- ПРОВЕРКА 5: Количество данных в таблицах
-- ============================================

\echo ''
\echo '=== ДАННЫЕ В ТАБЛИЦАХ ==='
SELECT 
  'raw_events' AS table_name,
  COUNT(*) AS row_count,
  MAX(event_time) AS last_event
FROM raw_events
UNION ALL
SELECT 
  'sessions',
  COUNT(*),
  MAX(first_event_time)::TEXT
FROM sessions
UNION ALL
SELECT 
  'events_clean',
  COUNT(*),
  MAX(event_time)::TEXT
FROM events_clean
UNION ALL
SELECT 
  'daily_stats',
  COUNT(*),
  MAX(date)::TEXT
FROM daily_stats
UNION ALL
SELECT 
  'etl_runs',
  COUNT(*),
  MAX(start_time)::TEXT
FROM etl_runs;

-- ============================================
-- ИТОГОВЫЙ СТАТУС
-- ============================================

\echo ''
\echo '=== ИТОГОВЫЙ СТАТУС ==='

DO $$
DECLARE
  tables_exist BOOLEAN;
  functions_exist BOOLEAN;
  views_exist BOOLEAN;
  pg_cron_exists BOOLEAN;
BEGIN
  -- Проверяем таблицы
  SELECT COUNT(*) = 7 INTO tables_exist
  FROM information_schema.tables
  WHERE table_name IN (
    'raw_events', 'sessions', 'events_clean', 
    'experiment_metrics_daily', 'daily_stats', 
    'user_retention', 'etl_runs'
  );

  -- Проверяем функции
  SELECT COUNT(*) >= 6 INTO functions_exist
  FROM information_schema.routines
  WHERE routine_name IN (
    'process_sessions', 'process_events_clean',
    'aggregate_experiment_metrics_daily', 'aggregate_daily_stats',
    'update_user_retention', 'cleanup_old_raw_events'
  );

  -- Проверяем VIEW
  SELECT COUNT(*) = 8 INTO views_exist
  FROM information_schema.views
  WHERE table_name LIKE 'v_analytics_%';

  -- Проверяем pg_cron
  SELECT EXISTS (
    SELECT FROM pg_extension WHERE extname = 'pg_cron'
  ) INTO pg_cron_exists;

  RAISE NOTICE '';
  RAISE NOTICE '┌─────────────────────────────────────────┐';
  RAISE NOTICE '│  СТАТУС КОМПОНЕНТОВ СИСТЕМЫ АНАЛИТИКИ  │';
  RAISE NOTICE '├─────────────────────────────────────────┤';
  RAISE NOTICE '│ Таблицы (7 шт):          %', 
    CASE WHEN tables_exist THEN '✓ ОК      │' ELSE '✗ ОШИБКА  │' END;
  RAISE NOTICE '│ ETL функции (6 шт):      %', 
    CASE WHEN functions_exist THEN '✓ ОК      │' ELSE '✗ ОШИБКА  │' END;
  RAISE NOTICE '│ BI Views (8 шт):         %', 
    CASE WHEN views_exist THEN '✓ ОК      │' ELSE '✗ ОШИБКА  │' END;
  RAISE NOTICE '│ pg_cron:                 %', 
    CASE WHEN pg_cron_exists THEN '✓ ОК      │' ELSE '✗ НЕ УСТАНОВЛЕН │' END;
  RAISE NOTICE '└─────────────────────────────────────────┘';
  RAISE NOTICE '';

  IF tables_exist AND functions_exist AND views_exist AND pg_cron_exists THEN
    RAISE NOTICE '🎉 Все компоненты установлены! Система готова к работе.';
    RAISE NOTICE '';
    RAISE NOTICE 'Следующие шаги:';
    RAISE NOTICE '1. Добавьте initAnalytics() в client/src/main.tsx';
    RAISE NOTICE '2. Запустите приложение и откройте любую страницу';
    RAISE NOTICE '3. Проверьте события: SELECT * FROM raw_events LIMIT 10;';
  ELSIF NOT pg_cron_exists THEN
    RAISE NOTICE '⚠️  pg_cron не установлен. Выполните:';
    RAISE NOTICE '   CREATE EXTENSION pg_cron;';
    RAISE NOTICE '   Затем запустите: psql $DATABASE_URL -f analytics/migrations/003_pg_cron_setup.sql';
  ELSE
    RAISE NOTICE '❌ Не все компоненты установлены.';
    RAISE NOTICE '   Выполните миграции по порядку из analytics/migrations/';
  END IF;
END $$;
