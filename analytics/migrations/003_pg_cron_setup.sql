-- ============================================
-- Analytics System - pg_cron Setup
-- ============================================
--
-- Автоматизация ETL процессов через pg_cron (встроен в Neon)
-- Документация: https://neon.com/docs/extensions/pg_cron
--

-- ============================================
-- 1. Включение расширения pg_cron
-- ============================================

-- В Neon pg_cron уже предустановлен, нужно только активировать
CREATE EXTENSION IF NOT EXISTS pg_cron;

COMMENT ON EXTENSION pg_cron IS 'Планировщик задач внутри PostgreSQL';


-- ============================================
-- 2. Инкрементальные ETL задачи (каждые 5 минут)
-- ============================================

-- Задача 1: Обработка сессий (каждые 5 минут)
SELECT cron.schedule(
  'process-sessions-incremental',  -- Уникальное имя задачи
  '*/5 * * * *',  -- Каждые 5 минут
  $$SELECT process_sessions()$$
);

COMMENT ON EXTENSION pg_cron IS 'Инкрементальная обработка сессий каждые 5 минут';


-- Задача 2: Очистка и обогащение событий (каждые 5 минут)
SELECT cron.schedule(
  'process-events-clean-incremental',
  '*/5 * * * *',  -- Каждые 5 минут
  $$SELECT process_events_clean()$$
);


-- ============================================
-- 3. Ежедневные агрегации (каждый день в 03:00 UTC)
-- ============================================

-- Задача 3: Агрегация метрик экспериментов за вчерашний день
SELECT cron.schedule(
  'aggregate-experiment-metrics-daily',
  '0 3 * * *',  -- Каждый день в 03:00 UTC
  $$SELECT aggregate_experiment_metrics_daily(CURRENT_DATE - INTERVAL '1 day')$$
);

COMMENT ON EXTENSION pg_cron IS 'Ежедневная агрегация метрик экспериментов в 03:00 UTC';


-- Задача 4: Агрегация общей статистики за вчерашний день
SELECT cron.schedule(
  'aggregate-daily-stats',
  '0 3 * * *',  -- Каждый день в 03:00 UTC
  $$SELECT aggregate_daily_stats(CURRENT_DATE - INTERVAL '1 day')$$
);


-- Задача 5: Обновление retention метрик
SELECT cron.schedule(
  'update-user-retention',
  '30 3 * * *',  -- Каждый день в 03:30 UTC (после агрегаций)
  $$SELECT update_user_retention()$$
);


-- ============================================
-- 4. Еженедельная очистка старых логов (воскресенье в 04:00 UTC)
-- ============================================

-- Задача 6: Удаление сырых событий старше 90 дней
SELECT cron.schedule(
  'cleanup-old-raw-events',
  '0 4 * * 0',  -- Каждое воскресенье в 04:00 UTC
  $$SELECT cleanup_old_raw_events(90)$$
);

COMMENT ON EXTENSION pg_cron IS 'Еженедельная очистка сырых логов старше 90 дней';


-- ============================================
-- 5. Полезные запросы для управления задачами
-- ============================================

-- Просмотр всех запланированных задач:
-- SELECT * FROM cron.job;

-- Просмотр истории выполнения задач:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

-- Удаление задачи (если нужно):
-- SELECT cron.unschedule('process-sessions-incremental');

-- Отключение задачи без удаления:
-- UPDATE cron.job SET active = FALSE WHERE jobname = 'process-sessions-incremental';

-- Включение задачи:
-- UPDATE cron.job SET active = TRUE WHERE jobname = 'process-sessions-incremental';

-- Ручной запуск задачи для тестирования:
-- SELECT process_sessions();
-- SELECT process_events_clean();
-- SELECT aggregate_experiment_metrics_daily(CURRENT_DATE - INTERVAL '1 day');
-- SELECT aggregate_daily_stats(CURRENT_DATE - INTERVAL '1 day');
-- SELECT update_user_retention();


-- ============================================
-- 6. VIEW для мониторинга pg_cron задач
-- ============================================

CREATE OR REPLACE VIEW v_cron_job_monitoring AS
SELECT 
  j.jobid,
  j.jobname,
  j.schedule,
  j.active,
  j.database,
  -- Последний запуск
  (
    SELECT jrd.start_time
    FROM cron.job_run_details jrd
    WHERE jrd.jobid = j.jobid
    ORDER BY jrd.start_time DESC
    LIMIT 1
  ) AS last_run_time,
  -- Статус последнего запуска
  (
    SELECT jrd.status
    FROM cron.job_run_details jrd
    WHERE jrd.jobid = j.jobid
    ORDER BY jrd.start_time DESC
    LIMIT 1
  ) AS last_run_status,
  -- Длительность последнего запуска
  (
    SELECT jrd.end_time - jrd.start_time
    FROM cron.job_run_details jrd
    WHERE jrd.jobid = j.jobid
    ORDER BY jrd.start_time DESC
    LIMIT 1
  ) AS last_run_duration,
  -- Сообщение об ошибке (если есть)
  (
    SELECT jrd.return_message
    FROM cron.job_run_details jrd
    WHERE jrd.jobid = j.jobid
      AND jrd.status != 'succeeded'
    ORDER BY jrd.start_time DESC
    LIMIT 1
  ) AS last_error_message
FROM cron.job j
ORDER BY j.jobname;

COMMENT ON VIEW v_cron_job_monitoring IS 'Мониторинг pg_cron задач с информацией о последних запусках';


-- ============================================
-- 7. Настройка уведомлений при ошибках (опционально)
-- ============================================

-- Функция для отправки уведомлений при ошибках ETL
-- (требует настройки email или webhook для уведомлений)

CREATE OR REPLACE FUNCTION notify_etl_failures()
RETURNS void AS $$
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
$$ LANGUAGE plpgsql;

-- Планируем проверку ошибок каждый час
SELECT cron.schedule(
  'check-etl-failures',
  '0 * * * *',  -- Каждый час
  $$SELECT notify_etl_failures()$$
);


-- ============================================
-- 8. Первичная инициализация данных
-- ============================================

-- После первого запуска миграций рекомендуется
-- запустить ETL вручную для обработки исторических данных:

/*
-- Запустить последовательно:
SELECT process_sessions();
SELECT process_events_clean();
SELECT aggregate_daily_stats(CURRENT_DATE - INTERVAL '1 day');
SELECT aggregate_experiment_metrics_daily(CURRENT_DATE - INTERVAL '1 day');
SELECT update_user_retention();

-- Если нужно обработать несколько дней назад:
SELECT aggregate_daily_stats(CURRENT_DATE - INTERVAL '7 days');
SELECT aggregate_daily_stats(CURRENT_DATE - INTERVAL '6 days');
-- и т.д.
*/
