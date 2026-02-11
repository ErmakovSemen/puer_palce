# 📊 Система Аналитики - Быстрая настройка

> **Все файлы находятся в папке `analytics/`**

## 🚀 Проверка установки (30 секунд)

```bash
# Автоматическая проверка (запускается Cursor/GitHub Actions)
npm run verify:analytics:files
# ✓ Проверяет наличие всех файлов и initAnalytics в main.tsx

# Полная проверка (требует запущенный сервер и опционально DATABASE_URL)
BASE_URL=http://localhost:5000 npm run verify:analytics
# ✓ API + Database (если DATABASE_URL задан)
```

```bash
# Вручную: проверьте, что всё закоммичено
git log --oneline -4
# Должно быть 4 коммита с аналитикой

# Проверьте структуру
ls analytics/
# migrations/  queries/  integration/  examples/
# README.md  QUICKSTART.md  TEST.md
```

## 🧪 Быстрое тестирование (БЕЗ установки в БД)

```bash
# 1. Проверьте файлы
ls -la analytics/migrations/  # Должно быть 4 SQL файла
ls -la analytics/queries/     # Должно быть 2 SQL файла
ls -la server/analytics.ts    # Backend модуль
ls -la client/src/lib/analytics.ts  # Frontend модуль

# 2. Проверьте backend endpoints
grep -n "api/analytics/log" server/routes.ts
# Должно показать строки с эндпоинтами

# 3. Проверьте существующую A/B систему
grep -n "use-ab-testing" client/src/hooks/use-ab-testing.ts
```

**Результат:** Если все файлы на месте - система готова к установке! ✅

## 💾 Установка в базу данных

### Вариант A: Если у вас есть DATABASE_URL

```bash
# 1. Запустите тестовый скрипт (проверка БЕЗ изменений)
psql $DATABASE_URL -f analytics/test_analytics.sql

# Должно показать статус всех компонентов
```

**Если показывает "НЕ УСТАНОВЛЕН":**

```bash
# 2. Запустите миграции по порядку
psql $DATABASE_URL -f analytics/migrations/001_analytics_tables.sql
psql $DATABASE_URL -f analytics/migrations/002_etl_functions.sql
psql $DATABASE_URL -f analytics/migrations/003_pg_cron_setup.sql
psql $DATABASE_URL -f analytics/migrations/004_bi_views.sql

# 3. Проверьте снова
psql $DATABASE_URL -f analytics/test_analytics.sql
# Теперь всё должно быть ✓ ОК
```

### Вариант B: Если у вас Neon веб-интерфейс

1. Откройте https://console.neon.tech/
2. Выберите свой проект
3. Перейдите в SQL Editor
4. Скопируйте и выполните содержимое файлов **по порядку**:
   - `analytics/migrations/001_analytics_tables.sql`
   - `analytics/migrations/002_etl_functions.sql`
   - `analytics/migrations/003_pg_cron_setup.sql`
   - `analytics/migrations/004_bi_views.sql`

## 🎮 Создание демо данных (опционально)

Хотите посмотреть, как работает система?

```bash
# Создаёт тестовые события, обрабатывает их, показывает результаты
psql $DATABASE_URL -f analytics/demo_data.sql
```

**Что увидите:**
- ✅ 5 тестовых сессий с событиями
- ✅ Воронку конверсии
- ✅ Результаты A/B теста
- ✅ Статистику за день

**Удаление демо данных:**
```sql
DELETE FROM raw_events WHERE session_id LIKE 'sess_test_%';
```

## 🔗 Интеграция с приложением

### 1. Добавьте в `client/src/main.tsx`:

```typescript
import { initAnalytics } from "./lib/analytics";

// После ReactDOM.render или в самом конце файла
initAnalytics();
console.log("✅ Analytics готов");
```

### 2. Используйте в любом компоненте:

```typescript
import { trackEvent } from "@/lib/analytics";

// Простое событие
trackEvent("button_clicked");

// С данными
trackEvent("product_viewed", {
  properties: { product_id: 123 }
});
```

### 3. Для A/B тестов:

```typescript
import { useAbTesting } from "@/hooks/use-ab-testing";
import { trackExperimentEvent } from "@/lib/analytics-ab-helpers";

const { getTestVariant } = useAbTesting();
const variant = getTestVariant("my-test");

trackExperimentEvent("button_clicked", "my-test", variant);
```

## 📊 Проверка работы

### В браузере:

1. Откройте приложение
2. DevTools (F12) → Network
3. Должны появляться запросы `POST /api/analytics/log`

### В базе данных:

```sql
-- Последние события
SELECT event_name, source, event_time 
FROM raw_events 
ORDER BY event_time DESC 
LIMIT 10;

-- Сессии
SELECT * FROM sessions 
ORDER BY first_event_time DESC 
LIMIT 5;

-- Статистика
SELECT * FROM daily_stats 
ORDER BY date DESC 
LIMIT 7;
```

### Проверка pg_cron:

```sql
-- Активные задачи
SELECT jobname, schedule, active 
FROM cron.job 
WHERE active = true;

-- Последние выполнения
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;
```

## 📈 Подключение DataLens

1. Откройте https://datalens.yandex.ru/
2. New Connection → PostgreSQL
3. Укажите данные из `DATABASE_URL`:
   - Host: `xxx.neon.tech`
   - Port: `5432`
   - Database: `ваша база`
   - Username/Password из connection string
   - ✅ **SSL обязательно включить!**
4. Test Connection → Save

### Создайте датасеты из VIEW:

- `v_analytics_events` - все события
- `v_analytics_sessions` - сессии
- `v_analytics_experiments` - A/B эксперименты
- `v_analytics_daily_stats` - дневная статистика
- `v_analytics_funnel` - воронка конверсии

## 📚 Полная документация

| Файл | Описание |
|------|----------|
| **`analytics/TEST.md`** | 👈 **НАЧНИТЕ ОТСЮДА** - детальное тестирование |
| `analytics/QUICKSTART.md` | Запуск за 5 минут |
| `analytics/README.md` | Полная документация (4200+ строк) |
| `analytics/queries/` | Готовые SQL запросы |
| `analytics/examples/` | 12 примеров React компонентов |

## 🆘 Частые проблемы

### pg_cron не установлен

```sql
CREATE EXTENSION pg_cron;
```

### События не отправляются

- Проверьте консоль браузера
- Проверьте Network tab
- Убедитесь, что `initAnalytics()` вызван

### ETL не работает

```sql
-- Запустите вручную
SELECT process_sessions();
SELECT process_events_clean();

-- Проверьте логи
SELECT * FROM etl_runs ORDER BY start_time DESC LIMIT 5;
```

## ✅ Быстрый чеклист

```bash
# Проверьте установку компонентов
psql $DATABASE_URL -f analytics/test_analytics.sql

# Если всё ✓ ОК:
# 1. Добавьте initAnalytics() в main.tsx
# 2. Запустите приложение
# 3. Откройте любую страницу
# 4. Проверьте: SELECT * FROM raw_events LIMIT 5;
```

---

**🎉 Готово!** Теперь у вас работает аналитика с A/B тестированием.

**Следующий шаг:** Откройте `analytics/TEST.md` для детального тестирования.
