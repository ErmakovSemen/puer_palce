# 🚀 Быстрый Старт - Система Аналитики

## За 5 минут до запуска

### 1. Запустите SQL миграции (по порядку!)

```bash
# В Neon SQL Editor или через psql
psql $DATABASE_URL -f analytics/migrations/001_analytics_tables.sql
psql $DATABASE_URL -f analytics/migrations/002_etl_functions.sql
psql $DATABASE_URL -f analytics/migrations/003_pg_cron_setup.sql
psql $DATABASE_URL -f analytics/migrations/004_bi_views.sql
```

### 2. Проверьте, что pg_cron работает

```sql
-- Должны быть 6+ задач
SELECT * FROM cron.job;

-- Проверьте выполнение
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
```

### 3. Запустите первичный ETL

```sql
SELECT process_sessions();
SELECT process_events_clean();
SELECT aggregate_daily_stats(CURRENT_DATE - INTERVAL '1 day');
```

### 4. Добавьте в `main.tsx`

```typescript
import { initAnalytics } from "@/lib/analytics";

// После ReactDOM.render
initAnalytics();
```

### 5. Начните отслеживать события

```typescript
import { trackEvent, trackAddToCart, trackOrderCompleted } from "@/lib/analytics";

// Простое событие
trackEvent("button_clicked");

// С данными
trackAddToCart(product.id, product.name, quantity);

// С A/B тестом
import { trackEventWithExperiments } from "@/lib/analytics-ab-helpers";
import { useAbTesting } from "@/hooks/use-ab-testing";

const { getAllTestAssignments } = useAbTesting();
trackEventWithExperiments("checkout_started", getAllTestAssignments(), {
  properties: { cart_total: 1500 }
});
```

## Первый A/B эксперимент

### 1. Создайте эксперимент в админке

```
/admin → Experiments → Create
- test_id: "button-color-test"
- variants: [
    { id: "control", name: "Синий", weight: 50, config: { color: "blue" } },
    { id: "red", name: "Красный", weight: 50, config: { color: "red" } }
  ]
```

### 2. Используйте в компоненте

```typescript
import { useAbTesting } from "@/hooks/use-ab-testing";
import { trackExperimentEvent } from "@/lib/analytics-ab-helpers";

function CheckoutButton() {
  const { getTestVariant } = useAbTesting();
  const variant = getTestVariant("button-color-test");
  
  const handleClick = () => {
    trackExperimentEvent("button_clicked", "button-color-test", variant);
  };

  return (
    <button 
      style={{ background: variant?.config.color || "blue" }}
      onClick={handleClick}
    >
      Оформить заказ
    </button>
  );
}
```

### 3. Анализируйте результаты

```sql
-- Замените 'button-color-test' на ваш test_id
SELECT 
  experiment_variant AS "Вариант",
  COUNT(DISTINCT user_id) AS "Пользователей",
  COUNT(*) FILTER (WHERE event_name = 'order_completed') AS "Конверсий",
  ROUND(
    COUNT(*) FILTER (WHERE event_name = 'order_completed')::NUMERIC /
    NULLIF(COUNT(DISTINCT user_id), 0) * 100,
    2
  ) AS "Конверсия (%)"
FROM raw_events
WHERE experiment_key = 'button-color-test'
  AND event_time >= NOW() - INTERVAL '7 days'
GROUP BY experiment_variant;
```

## Подключение DataLens

### 1. Создайте подключение

- Откройте [DataLens](https://datalens.yandex.ru/)
- New Connection → PostgreSQL
- Укажите данные из Neon Connection String
- ✅ Включите SSL

### 2. Создайте датасеты

Добавьте датасеты на основе VIEW:
- `v_analytics_events` - все события
- `v_analytics_experiments` - A/B эксперименты
- `v_analytics_daily_stats` - общая статистика

### 3. Создайте первый график

**Активные пользователи по дням:**
- Источник: `v_analytics_daily_stats`
- X-axis: `Дата`
- Y-axis: `Активных пользователей`
- Тип: Линейный график

## Топ-5 SQL запросов

### 1. Конверсия за последние 7 дней

```sql
SELECT 
  date,
  active_users,
  total_orders,
  ROUND(total_orders::NUMERIC / NULLIF(active_users, 0) * 100, 2) AS "Конверсия (%)"
FROM daily_stats
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;
```

### 2. Retention по когортам

```sql
SELECT 
  cohort_date,
  COUNT(DISTINCT user_id) AS cohort_size,
  ROUND(COUNT(DISTINCT user_id) FILTER (WHERE day_1)::NUMERIC / 
    COUNT(DISTINCT user_id) * 100, 1) AS "D1 (%)",
  ROUND(COUNT(DISTINCT user_id) FILTER (WHERE day_7)::NUMERIC / 
    COUNT(DISTINCT user_id) * 100, 1) AS "D7 (%)"
FROM user_retention
WHERE cohort_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY cohort_date
ORDER BY cohort_date DESC;
```

### 3. Воронка конверсии

```sql
SELECT * FROM v_analytics_funnel
WHERE "Дата" >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY "Дата" DESC;
```

### 4. Топ товаров

```sql
SELECT 
  "Название",
  "Просмотров",
  "Добавлений в корзину",
  "Заказов",
  "Конверсия просмотр→корзина (%)"
FROM v_analytics_products
ORDER BY "Просмотров" DESC
LIMIT 10;
```

### 5. A/B эксперимент - сравнение вариантов

```sql
-- Замените 'your-test-id'
SELECT 
  experiment_variant,
  COUNT(DISTINCT user_id) AS users,
  COUNT(*) FILTER (WHERE event_name = 'order_completed') AS conversions,
  ROUND(
    COUNT(*) FILTER (WHERE event_name = 'order_completed')::NUMERIC /
    NULLIF(COUNT(DISTINCT user_id), 0) * 100,
    2
  ) AS "Conversion %"
FROM raw_events
WHERE experiment_key = 'your-test-id'
GROUP BY experiment_variant;
```

## Проверка работоспособности

### 1. События логируются?

```sql
SELECT COUNT(*), MAX(event_time) FROM raw_events;
-- Должно расти каждые несколько секунд
```

### 2. ETL работает?

```sql
SELECT job_name, status, rows_processed, end_time
FROM etl_runs
ORDER BY start_time DESC
LIMIT 5;
-- Статус должен быть 'success'
```

### 3. pg_cron активен?

```sql
SELECT jobname, active, 
  (SELECT start_time FROM cron.job_run_details jrd 
   WHERE jrd.jobid = j.jobid ORDER BY start_time DESC LIMIT 1) AS last_run
FROM cron.job j
WHERE active = true;
-- last_run не должен быть старше 10 минут
```

### 4. Данные в аналитических таблицах?

```sql
SELECT 
  (SELECT COUNT(*) FROM raw_events) AS raw_events,
  (SELECT COUNT(*) FROM sessions) AS sessions,
  (SELECT COUNT(*) FROM events_clean) AS events_clean,
  (SELECT COUNT(*) FROM daily_stats) AS daily_stats;
-- Все значения > 0
```

## Полезные команды

### Ручной запуск ETL

```sql
-- Обработка сессий
SELECT process_sessions();

-- Очистка событий
SELECT process_events_clean();

-- Агрегация за вчера
SELECT aggregate_daily_stats(CURRENT_DATE - INTERVAL '1 day');
SELECT aggregate_experiment_metrics_daily(CURRENT_DATE - INTERVAL '1 day');

-- Retention
SELECT update_user_retention();
```

### Очистка старых данных

```sql
-- Удалить события старше 90 дней
SELECT cleanup_old_raw_events(90);

-- Удалить логи ETL старше 30 дней
DELETE FROM etl_runs WHERE start_time < NOW() - INTERVAL '30 days';
```

### Мониторинг pg_cron

```sql
-- Список задач
SELECT * FROM cron.job;

-- История выполнения
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC LIMIT 20;

-- Задачи с ошибками
SELECT * FROM cron.job_run_details 
WHERE status != 'succeeded' 
ORDER BY start_time DESC;
```

## Что дальше?

1. **Настройте дашборды** в DataLens с ключевыми метриками
2. **Запустите A/B тесты** для критических элементов
3. **Изучите SQL скрипты** в `analytics/queries/` для глубокого анализа
4. **Настройте уведомления** при ошибках ETL (опционально)
5. **Читайте** полную документацию в `analytics/README.md`

## Поддержка

- Полная документация: `analytics/README.md`
- SQL запросы: `analytics/queries/`
- Интеграция с A/B: `analytics/integration/ab_testing_integration.md`
- Neon документация: https://neon.com/docs/extensions/pg_cron
- DataLens документация: https://yandex.cloud/en/docs/datalens/

---

**Готово! 🎉** Теперь у вас работает полноценная аналитика с A/B тестированием.
