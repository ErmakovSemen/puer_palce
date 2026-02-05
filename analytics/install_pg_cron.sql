-- Установка pg_cron расширения
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Проверка установки
SELECT 
  CASE 
    WHEN EXISTS (SELECT FROM pg_extension WHERE extname = 'pg_cron') 
    THEN '✓ pg_cron успешно установлен!'
    ELSE '✗ Ошибка установки'
  END AS status;
