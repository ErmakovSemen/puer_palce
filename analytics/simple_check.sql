-- ============================================
-- ПРОСТАЯ ПРОВЕРКА СИСТЕМЫ АНАЛИТИКИ
-- Скопируйте и вставьте в Neon SQL Editor
-- ============================================

-- 1. ПРОВЕРКА ТАБЛИЦ
SELECT 'ТАБЛИЦЫ:' AS check_type, '' AS name, '' AS status
UNION ALL
SELECT '', 'raw_events', 
  CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'raw_events') 
    THEN '✓ OK' ELSE '✗ НЕТ' END
UNION ALL
SELECT '', 'sessions', 
  CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sessions') 
    THEN '✓ OK' ELSE '✗ НЕТ' END
UNION ALL
SELECT '', 'events_clean', 
  CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'events_clean') 
    THEN '✓ OK' ELSE '✗ НЕТ' END
UNION ALL
SELECT '', 'experiment_metrics_daily', 
  CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'experiment_metrics_daily') 
    THEN '✓ OK' ELSE '✗ НЕТ' END
UNION ALL
SELECT '', 'daily_stats', 
  CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'daily_stats') 
    THEN '✓ OK' ELSE '✗ НЕТ' END;

-- 2. ПРОВЕРКА ФУНКЦИЙ
SELECT '' AS check_type, '' AS name, '' AS status
UNION ALL
SELECT 'ETL ФУНКЦИИ:', '', ''
UNION ALL
SELECT '', 'process_sessions', 
  CASE WHEN EXISTS (
    SELECT FROM information_schema.routines 
    WHERE routine_name = 'process_sessions'
  ) THEN '✓ OK' ELSE '✗ НЕТ' END
UNION ALL
SELECT '', 'process_events_clean', 
  CASE WHEN EXISTS (
    SELECT FROM information_schema.routines 
    WHERE routine_name = 'process_events_clean'
  ) THEN '✓ OK' ELSE '✗ НЕТ' END
UNION ALL
SELECT '', 'aggregate_daily_stats', 
  CASE WHEN EXISTS (
    SELECT FROM information_schema.routines 
    WHERE routine_name = 'aggregate_daily_stats'
  ) THEN '✓ OK' ELSE '✗ НЕТ' END;

-- 3. ПРОВЕРКА BI VIEWS
SELECT '' AS check_type, '' AS name, '' AS status
UNION ALL
SELECT 'BI VIEWS:', '', ''
UNION ALL
SELECT '', 'v_analytics_events', 
  CASE WHEN EXISTS (SELECT FROM information_schema.views WHERE table_name = 'v_analytics_events') 
    THEN '✓ OK' ELSE '✗ НЕТ' END
UNION ALL
SELECT '', 'v_analytics_sessions', 
  CASE WHEN EXISTS (SELECT FROM information_schema.views WHERE table_name = 'v_analytics_sessions') 
    THEN '✓ OK' ELSE '✗ НЕТ' END;

-- 4. ПРОВЕРКА PG_CRON
SELECT '' AS check_type, '' AS name, '' AS status
UNION ALL
SELECT 'PG_CRON:', '', ''
UNION ALL
SELECT '', 'extension', 
  CASE WHEN EXISTS (SELECT FROM pg_extension WHERE extname = 'pg_cron') 
    THEN '✓ OK' ELSE '✗ НЕ УСТАНОВЛЕН' END;

-- 5. КОЛИЧЕСТВО ДАННЫХ
SELECT '' AS check_type, '' AS name, '' AS status
UNION ALL
SELECT 'ДАННЫЕ:', '', ''
UNION ALL
SELECT '', 'raw_events', 
  'строк: ' || COALESCE((SELECT COUNT(*)::TEXT FROM raw_events), '0')
UNION ALL
SELECT '', 'sessions', 
  'строк: ' || COALESCE((SELECT COUNT(*)::TEXT FROM sessions), '0');
