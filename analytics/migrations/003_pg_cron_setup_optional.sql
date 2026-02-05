-- ============================================
-- Analytics System - pg_cron Setup (OPTIONAL)
-- ============================================
--
-- ВНИМАНИЕ: Этот файл требует pg_cron расширение
-- Если pg_cron недоступен (Free/Hobby план Neon):
-- - ETL можно запускать вручную
-- - Или настроить через cron на сервере приложения
-- - Или использовать GitHub Actions для периодического запуска
--
-- Проверка доступности pg_cron:

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE '';
    RAISE NOTICE '==================================================================';
    RAISE NOTICE 'ВНИМАНИЕ: pg_cron расширение недоступно в вашем плане Neon';
    RAISE NOTICE '==================================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Система аналитики установлена БЕЗ автоматического ETL.';
    RAISE NOTICE '';
    RAISE NOTICE 'Способы запуска ETL:';
    RAISE NOTICE '1. ВРУЧНУЮ через SQL:';
    RAISE NOTICE '   SELECT process_sessions();';
    RAISE NOTICE '   SELECT process_events_clean();';
    RAISE NOTICE '   SELECT aggregate_daily_stats(CURRENT_DATE);';
    RAISE NOTICE '';
    RAISE NOTICE '2. Через API endpoint (админ):';
    RAISE NOTICE '   POST /api/admin/analytics/etl/trigger/sessions';
    RAISE NOTICE '';
    RAISE NOTICE '3. Через GitHub Actions (рекомендуется):';
    RAISE NOTICE '   - Создайте .github/workflows/analytics-etl.yml';
    RAISE NOTICE '   - Запускайте ETL каждые 5-10 минут';
    RAISE NOTICE '';
    RAISE NOTICE 'Для включения pg_cron: обновите план Neon до Launch или выше';
    RAISE NOTICE '==================================================================';
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE 'pg_cron доступен! Настраиваем автоматический ETL...';
  END IF;
END $$;

-- Если pg_cron доступен, создаём задачи
-- (если нет - просто пропустится с ошибками, это ок)

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Задача 1: Обработка сессий (каждые 5 минут)
    PERFORM cron.schedule(
      'process-sessions-incremental',
      '*/5 * * * *',
      $$SELECT process_sessions()$$
    );

    -- Задача 2: Очистка и обогащение событий (каждые 5 минут)
    PERFORM cron.schedule(
      'process-events-clean-incremental',
      '*/5 * * * *',
      $$SELECT process_events_clean()$$
    );

    -- Задача 3: Агрегация метрик экспериментов за вчерашний день
    PERFORM cron.schedule(
      'aggregate-experiment-metrics-daily',
      '0 3 * * *',
      $$SELECT aggregate_experiment_metrics_daily(CURRENT_DATE - INTERVAL '1 day')$$
    );

    -- Задача 4: Агрегация общей статистики за вчерашний день
    PERFORM cron.schedule(
      'aggregate-daily-stats',
      '0 3 * * *',
      $$SELECT aggregate_daily_stats(CURRENT_DATE - INTERVAL '1 day')$$
    );

    -- Задача 5: Обновление retention метрик
    PERFORM cron.schedule(
      'update-user-retention',
      '30 3 * * *',
      $$SELECT update_user_retention()$$
    );

    -- Задача 6: Удаление сырых событий старше 90 дней
    PERFORM cron.schedule(
      'cleanup-old-raw-events',
      '0 4 * * 0',
      $$SELECT cleanup_old_raw_events(90)$$
    );

    RAISE NOTICE 'pg_cron задачи успешно созданы!';
  END IF;
END $$;
