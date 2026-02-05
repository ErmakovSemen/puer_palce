# 📊 Система Аналитики и Логирования

Минималистичная система аналитики для веб-проекта с PostgreSQL (Neon), внутренним ETL и подключением к BI инструментам.

## 🎯 Архитектура

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│  Frontend   │─────▶│   Backend    │─────▶│ PostgreSQL  │
│  (React)    │      │  (Express)   │      │   (Neon)    │
└─────────────┘      └──────────────┘      └─────────────┘
                                                   │
                                                   │ pg_cron
                                                   ▼
                                            ┌─────────────┐
                                            │ ETL Process │
                                            │ (SQL funcs) │
                                            └─────────────┘
                                                   │
                                                   ▼
                                            ┌─────────────┐
                                            │  BI Views   │
                                            └─────────────┘
                                                   │
                                                   ▼
                                            ┌─────────────┐
                                            │  DataLens   │
                                            │  Metabase   │
                                            └─────────────┘
```

## 📦 Компоненты

### 1. **Сырые данные**
- `raw_events` - все события с фронтенда и бэкенда
- `users_dim` - справочник пользователей (VIEW)

### 2. **Обработанные данные (ETL)**
- `sessions` - агрегированные сессии
- `events_clean` - очищенные и обогащённые события
- `experiment_metrics_daily` - метрики A/B экспериментов по дням
- `daily_stats` - общая статистика по дням
- `user_retention` - retention-анализ

### 3. **BI Views**
8 представлений с человекочитаемыми названиями для DataLens/Metabase:
- `v_analytics_events`
- `v_analytics_sessions`
- `v_analytics_experiments`
- `v_analytics_daily_stats`
- `v_analytics_retention`
- `v_analytics_users`
- `v_analytics_funnel`
- `v_analytics_products`

## 🚀 Установка и настройка

### Шаг 1: Подготовка базы данных

1. **Создайте базу данных в Neon**
   - Перейдите на https://neon.com
   - Создайте новый проект
   - Скопируйте Connection String

2. **Настройте переменную окружения**
   ```bash
   export DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
   ```

### Шаг 2: Запуск миграций

Выполните SQL-скрипты **по порядку**:

```bash
# 1. Создание таблиц
psql $DATABASE_URL -f analytics/migrations/001_analytics_tables.sql

# 2. Создание ETL функций
psql $DATABASE_URL -f analytics/migrations/002_etl_functions.sql

# 3. Настройка pg_cron (автоматический ETL)
psql $DATABASE_URL -f analytics/migrations/003_pg_cron_setup.sql

# 4. Создание VIEW для BI
psql $DATABASE_URL -f analytics/migrations/004_bi_views.sql
```

**Альтернативно** можно выполнить через SQL-клиент Neon в веб-интерфейсе.

### Шаг 3: Включение pg_cron в Neon

В Neon `pg_cron` уже предустановлен, но нужно его активировать:

```sql
-- Выполните в SQL Editor на neon.com
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

Проверьте, что задачи созданы:

```sql
SELECT * FROM cron.job;
```

### Шаг 4: Первичная инициализация данных

После установки миграций запустите ETL вручную для обработки исторических данных:

```sql
-- Обработка сессий
SELECT process_sessions();

-- Очистка событий
SELECT process_events_clean();

-- Агрегация статистики за вчера
SELECT aggregate_daily_stats(CURRENT_DATE - INTERVAL '1 day');

-- Агрегация экспериментов за вчера
SELECT aggregate_experiment_metrics_daily(CURRENT_DATE - INTERVAL '1 day');

-- Обновление retention
SELECT update_user_retention();
```

Если нужно обработать несколько дней назад:

```sql
-- Обработка за последние 7 дней
DO $$
DECLARE
  d DATE;
BEGIN
  FOR d IN 
    SELECT generate_series(
      CURRENT_DATE - INTERVAL '7 days',
      CURRENT_DATE - INTERVAL '1 day',
      INTERVAL '1 day'
    )::DATE
  LOOP
    PERFORM aggregate_daily_stats(d);
    PERFORM aggregate_experiment_metrics_daily(d);
  END LOOP;
END $$;
```

### Шаг 5: Интеграция в код приложения

#### Backend (уже готово)

Эндпоинты автоматически добавлены в `server/routes.ts`:

- `POST /api/analytics/log` - одиночное событие
- `POST /api/analytics/log/batch` - батч событий
- `GET /api/admin/analytics/summary` - статистика (админ)
- `GET /api/admin/analytics/etl-status` - статус ETL (админ)
- `POST /api/admin/analytics/etl/trigger/:job` - ручной запуск ETL (админ)

#### Frontend

Добавьте в `client/src/main.tsx` инициализацию аналитики:

```typescript
import { initAnalytics } from "./lib/analytics";

// После рендера приложения
initAnalytics();
```

Используйте функции трекинга в компонентах:

```typescript
import { trackPageView, trackAddToCart, trackOrderCompleted } from "@/lib/analytics";

// Просмотр страницы
trackPageView();

// Добавление в корзину
trackAddToCart(product.id, product.name, quantity);

// Завершение заказа
trackOrderCompleted(order.id, order.total);
```

**Все доступные функции:**

```typescript
// Базовая функция
trackEvent(eventName, { properties, immediate, experimentKey, experimentVariant })

// Предопределённые события
trackPageView(page?)
trackProductView(productId, productName)
trackAddToCart(productId, productName, quantity)
trackRemoveFromCart(productId, productName)
trackCheckoutStarted(cartTotal, itemsCount)
trackOrderCompleted(orderId, total)
trackUserRegistered(userId)
trackUserLoggedIn(userId)
trackUserLoggedOut()
trackSearch(query, resultsCount)
trackQuizStarted()
trackQuizCompleted(recommendedTeaType)
trackError(errorType, errorMessage)
```

## 📊 Подключение BI (Yandex DataLens)

### 1. Создание подключения к PostgreSQL

1. Откройте [DataLens](https://datalens.yandex.ru/)
2. Создайте новое подключение → **PostgreSQL**
3. Заполните параметры:
   - **Host**: `<ваш-проект>.neon.com`
   - **Port**: `5432`
   - **Database**: `<имя-базы>`
   - **Username**: `<username>`
   - **Password**: `<password>`
   - **SSL**: включен (обязательно для Neon)

4. Нажмите **Проверить подключение**
5. Сохраните подключение

### 2. Создание датасетов

Создайте датасеты на основе VIEW:

1. **Датасет "События"**: `v_analytics_events`
2. **Датасет "Сессии"**: `v_analytics_sessions`
3. **Датасет "Эксперименты"**: `v_analytics_experiments`
4. **Датасет "Общая статистика"**: `v_analytics_daily_stats`
5. **Датасет "Retention"**: `v_analytics_retention`
6. **Датасет "Пользователи"**: `v_analytics_users`
7. **Датасет "Воронка"**: `v_analytics_funnel`
8. **Датасет "Товары"**: `v_analytics_products`

### 3. Создание дашбордов

Примеры графиков для дашборда "Общая статистика":

- **Активные пользователи по дням** (линейный график)
  - X: `Дата`
  - Y: `Активных пользователей`

- **Конверсия по дням** (линейный график)
  - X: `Дата`
  - Y: `Конверсия (%)`

- **Выручка по дням** (столбчатая диаграмма)
  - X: `Дата`
  - Y: `Выручка`

- **Средний чек** (KPI)
  - Значение: `Средний чек`

Примеры для дашборда "A/B эксперименты":

- **Конверсия по вариантам** (столбчатая диаграмма)
  - X: `Вариант`
  - Y: `Конверсия (%)`
  - Группировка: `Название эксперимента`

- **Средний чек по вариантам** (столбчатая диаграмма)
  - X: `Вариант`
  - Y: `Средний чек`

### 4. Фильтры

Добавьте фильтры для удобства:
- Диапазон дат
- Название эксперимента
- Тип устройства
- Уровень лояльности

## 🔧 Управление и мониторинг

### Просмотр pg_cron задач

```sql
-- Список всех задач
SELECT * FROM cron.job;

-- История выполнения (последние 20)
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;

-- Мониторинг с ошибками
SELECT * FROM v_cron_job_monitoring;
```

### Управление задачами

```sql
-- Отключить задачу
UPDATE cron.job SET active = FALSE WHERE jobname = 'process-sessions-incremental';

-- Включить задачу
UPDATE cron.job SET active = TRUE WHERE jobname = 'process-sessions-incremental';

-- Удалить задачу
SELECT cron.unschedule('process-sessions-incremental');

-- Изменить расписание
SELECT cron.schedule('process-sessions-incremental', '*/10 * * * *', $$SELECT process_sessions()$$);
```

### Ручной запуск ETL

```sql
-- Через SQL
SELECT process_sessions();
SELECT process_events_clean();
SELECT aggregate_experiment_metrics_daily(CURRENT_DATE - INTERVAL '1 day');

-- Или через API (требуется админ-доступ)
POST /api/admin/analytics/etl/trigger/sessions
POST /api/admin/analytics/etl/trigger/events_clean
POST /api/admin/analytics/etl/trigger/experiment_metrics
```

### Просмотр логов ETL

```sql
-- Последние запуски
SELECT 
  job_name,
  start_time,
  end_time - start_time AS duration,
  status,
  rows_processed,
  error_message
FROM etl_runs
ORDER BY start_time DESC
LIMIT 20;

-- Только ошибки
SELECT * FROM etl_runs
WHERE status = 'failed'
ORDER BY start_time DESC;
```

### Очистка старых данных

```sql
-- Удалить сырые события старше 90 дней
SELECT cleanup_old_raw_events(90);

-- Удалить логи ETL старше 30 дней
DELETE FROM etl_runs
WHERE start_time < NOW() - INTERVAL '30 days';
```

## 📈 Типовые аналитические запросы

### Конверсия по экспериментам

```sql
SELECT 
  "Название эксперимента",
  "Вариант",
  "Пользователей",
  "Заказов",
  "Конверсия (%)",
  "Средний чек"
FROM v_analytics_experiments
WHERE "Дата" >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY "Дата" DESC, "Название эксперимента", "Вариант";
```

### Retention по когортам

```sql
SELECT 
  "Дата когорты",
  "Размер когорты",
  "Retention День 1 (%)",
  "Retention День 7 (%)",
  "Retention День 30 (%)"
FROM v_analytics_retention
WHERE "Дата когорты" >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY "Дата когорты" DESC;
```

### Воронка конверсии

```sql
SELECT 
  "Дата",
  "1. Просмотр страницы",
  "2. Просмотр товара",
  "3. Добавление в корзину",
  "4. Начало оформления",
  "5. Завершение заказа",
  "Общая конверсия (%)"
FROM v_analytics_funnel
WHERE "Дата" >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY "Дата" DESC;
```

### Топ товаров по конверсии

```sql
SELECT 
  "Название",
  "Просмотров",
  "Добавлений в корзину",
  "Заказов",
  "Конверсия просмотр→корзина (%)"
FROM v_analytics_products
WHERE "Просмотров" > 0
ORDER BY "Конверсия просмотр→корзина (%)" DESC
LIMIT 10;
```

## 🛠️ Настройка расписания

По умолчанию:

| Задача | Частота | Описание |
|--------|---------|----------|
| `process-sessions-incremental` | Каждые 5 минут | Обновление сессий |
| `process-events-clean-incremental` | Каждые 5 минут | Очистка событий |
| `aggregate-experiment-metrics-daily` | 03:00 UTC | Агрегация экспериментов |
| `aggregate-daily-stats` | 03:00 UTC | Агрегация общей статистики |
| `update-user-retention` | 03:30 UTC | Обновление retention |
| `cleanup-old-raw-events` | Воскресенье 04:00 UTC | Очистка старых логов (90 дней) |

Для изменения частоты редактируйте `003_pg_cron_setup.sql` и выполните:

```sql
-- Удалить старую задачу
SELECT cron.unschedule('process-sessions-incremental');

-- Создать новую с другим расписанием (например, каждые 10 минут)
SELECT cron.schedule(
  'process-sessions-incremental',
  '*/10 * * * *',
  $$SELECT process_sessions()$$
);
```

Формат cron: `минута час день_месяца месяц день_недели`

## 🐛 Устранение неполадок

### События не логируются

1. Проверьте, что таблица `raw_events` создана:
   ```sql
   SELECT COUNT(*) FROM raw_events;
   ```

2. Проверьте права доступа:
   ```sql
   GRANT ALL ON TABLE raw_events TO <your_user>;
   ```

3. Проверьте логи сервера: должны быть POST запросы к `/api/analytics/log`

### ETL не запускается

1. Проверьте, что pg_cron установлен:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

2. Проверьте задачи:
   ```sql
   SELECT * FROM cron.job WHERE active = true;
   ```

3. Проверьте логи выполнения:
   ```sql
   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
   ```

### DataLens не подключается

1. Проверьте, что используете SSL (обязательно для Neon)
2. Проверьте IP whitelist в Neon (если настроен)
3. Проверьте права пользователя:
   ```sql
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO <your_user>;
   ```

### VIEW возвращает пустые данные

1. Проверьте, что ETL запущен:
   ```sql
   SELECT process_sessions();
   SELECT process_events_clean();
   ```

2. Проверьте наличие данных:
   ```sql
   SELECT COUNT(*) FROM raw_events;
   SELECT COUNT(*) FROM sessions;
   SELECT COUNT(*) FROM events_clean;
   ```

## 📝 Примеры интеграции

### Отслеживание событий в React компонентах

```typescript
// ProductCard.tsx
import { trackProductView, trackAddToCart } from "@/lib/analytics";

function ProductCard({ product }) {
  useEffect(() => {
    // Отслеживаем просмотр при монтировании
    trackProductView(product.id, product.name);
  }, [product.id]);

  const handleAddToCart = () => {
    trackAddToCart(product.id, product.name, quantity);
    // ... остальная логика
  };

  return <button onClick={handleAddToCart}>В корзину</button>;
}
```

### Отслеживание с A/B экспериментом

```typescript
import { trackEvent } from "@/lib/analytics";
import { useAbTesting } from "@/hooks/use-ab-testing";

function CheckoutButton() {
  const { getVariant } = useAbTesting();
  const variant = getVariant("checkout-button-color");

  const handleClick = () => {
    trackEvent("checkout_button_clicked", {
      experimentKey: "checkout-button-color",
      experimentVariant: variant,
      properties: { button_color: variant },
    });
  };

  return <button onClick={handleClick}>Оформить</button>;
}
```

### Backend события

```typescript
// server/routes.ts
import { trackBackendEvent } from "./analytics";

app.post("/api/orders", async (req, res) => {
  const order = await createOrder(req.body);
  
  // Логируем событие на бэкенде
  await trackBackendEvent("order_created", {
    order_id: order.id,
    order_total: order.total,
    user_id: req.user.id,
  }, req.user.id);
  
  res.json(order);
});
```

## 🔐 Безопасность

1. **Эндпоинты `/api/analytics/log` - публичные**, так как принимают события от неавторизованных пользователей
2. **Админские эндпоинты** требуют заголовок `x-admin-password`
3. **Не логируйте** чувствительные данные (пароли, токены, номера карт)
4. **Используйте** request_id для дедупликации и защиты от повторной отправки

## 📚 Дополнительные ресурсы

- [Neon Documentation](https://neon.com/docs)
- [pg_cron Extension](https://neon.com/docs/extensions/pg_cron)
- [Yandex DataLens](https://yandex.cloud/en/docs/datalens/)
- [PostgreSQL Подключение к DataLens](https://yandex.cloud/en/docs/datalens/operations/connection/create-postgresql)

## ✅ Чеклист развёртывания

- [ ] База данных PostgreSQL/Neon создана
- [ ] DATABASE_URL настроен
- [ ] Миграция 001: таблицы созданы
- [ ] Миграция 002: ETL функции созданы
- [ ] Миграция 003: pg_cron настроен
- [ ] Миграция 004: BI views созданы
- [ ] pg_cron задачи активны (проверить `SELECT * FROM cron.job`)
- [ ] Первичный ETL запущен вручную
- [ ] Frontend `initAnalytics()` добавлен в main.tsx
- [ ] DataLens подключён к БД
- [ ] Датасеты созданы на основе views
- [ ] Дашборды настроены
- [ ] Тестовые события отправлены и видны в DataLens

---

**Готово! 🎉** Теперь у вас полноценная система аналитики с автоматическим ETL и BI-визуализацией.
