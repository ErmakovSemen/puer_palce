# Интеграция Аналитики с Существующей A/B Системой

## Обзор существующей A/B системы

В проекте уже настроена полноценная A/B система:

### Компоненты
1. **Таблицы БД:**
   - `experiments` - эксперименты
   - `ab_events` - события (старая таблица)
   - `device_user_mappings` - связь устройств и пользователей

2. **Frontend хук:** `use-ab-testing.ts`
   - `getTestVariant()` - получить вариант теста
   - `getAllTestAssignments()` - все активные назначения
   - `getAssignmentSnapshot()` - снимок текущих назначений
   - `getPriceMultiplier()` - для ценовых экспериментов

3. **Backend эндпоинты:**
   - `GET /api/experiments/active` - активные эксперименты
   - `POST /api/device-user-mapping` - привязка устройства к пользователю
   - `POST /api/events/log` - логирование событий (старая система)

## Стратегия интеграции

### 1. Унификация логирования событий

**Старая система:** `/api/events/log` → `ab_events`
**Новая система:** `/api/analytics/log` → `raw_events`

**Решение:** Использовать новую систему, но мигрировать старые данные.

### 2. Автоматическое добавление A/B данных к событиям

Модифицируем `trackEvent()` для автоматического включения данных A/B тестов.

### 3. Использование единого источника истины

- `experiments` таблица остаётся источником истины для экспериментов
- `raw_events` становится единым источником для всех событий
- Старая таблица `ab_events` можно использовать для исторических данных

## Практическое применение

### Пример 1: Отслеживание с автоматическим A/B

```typescript
import { trackEvent } from "@/lib/analytics";
import { useAbTesting } from "@/hooks/use-ab-testing";

function CheckoutButton() {
  const { getTestVariant } = useAbTesting();
  const variant = getTestVariant("checkout-button-color");

  const handleClick = () => {
    // Вариант 1: Явно указать эксперимент
    trackEvent("checkout_button_clicked", {
      experimentKey: "checkout-button-color",
      experimentVariant: variant?.variantId,
      properties: { button_text: "Оформить заказ" }
    });
  };

  return <button onClick={handleClick}>Оформить</button>;
}
```

### Пример 2: Использование хелпера для всех активных экспериментов

```typescript
import { trackEventWithExperiments } from "@/lib/analytics";
import { useAbTesting } from "@/hooks/use-ab-testing";

function ProductCard({ product }) {
  const { getAllTestAssignments } = useAbTesting();

  const handleAddToCart = () => {
    // Автоматически добавит ВСЕ активные эксперименты
    trackEventWithExperiments("add_to_cart", getAllTestAssignments(), {
      properties: { 
        product_id: product.id,
        product_name: product.name 
      }
    });
  };

  return <button onClick={handleAddToCart}>В корзину</button>;
}
```

### Пример 3: Ценовой эксперимент

```typescript
import { trackEvent } from "@/lib/analytics";
import { useAbTesting } from "@/hooks/use-ab-testing";

function ProductPrice({ product }) {
  const { applyPriceMultiplier, getTestVariant } = useAbTesting();
  const priceExperiment = getTestVariant("pricing-test");
  
  const finalPrice = applyPriceMultiplier(product.pricePerGram);

  useEffect(() => {
    // Логируем показ цены с данными эксперимента
    trackEvent("price_shown", {
      experimentKey: "pricing-test",
      experimentVariant: priceExperiment?.variantId,
      properties: {
        product_id: product.id,
        original_price: product.pricePerGram,
        shown_price: finalPrice,
        multiplier: priceExperiment?.config.price_multy || 1
      }
    });
  }, [product.id]);

  return <span>{finalPrice}₽</span>;
}
```

## SQL запросы для анализа A/B тестов

### Быстрый анализ активного эксперимента

```sql
-- Замените 'your-test-id' на реальный test_id из таблицы experiments
SELECT 
  experiment_variant AS "Вариант",
  COUNT(DISTINCT user_id) AS "Пользователей",
  COUNT(DISTINCT user_id) FILTER (WHERE event_name = 'order_completed') AS "Конверсий",
  ROUND(
    COUNT(DISTINCT user_id) FILTER (WHERE event_name = 'order_completed')::NUMERIC /
    NULLIF(COUNT(DISTINCT user_id), 0) * 100,
    2
  ) AS "Конверсия (%)"
FROM raw_events
WHERE experiment_key = 'your-test-id'
  AND event_time >= NOW() - INTERVAL '7 days'
GROUP BY experiment_variant;
```

### Получить все активные эксперименты

```sql
SELECT 
  test_id,
  name,
  status,
  variants,
  created_at
FROM experiments
WHERE status = 'active'
ORDER BY created_at DESC;
```

### Количество участников по экспериментам

```sql
SELECT 
  e.test_id,
  e.name,
  COUNT(DISTINCT re.user_id) AS participants,
  COUNT(DISTINCT re.session_id) AS sessions
FROM experiments e
LEFT JOIN raw_events re ON e.test_id = re.experiment_key
WHERE e.status = 'active'
  AND re.event_time >= e.created_at::TIMESTAMPTZ
GROUP BY e.test_id, e.name;
```

## Миграция старых данных

### Перенос событий из ab_events в raw_events

```sql
-- Мигрируем исторические события
INSERT INTO raw_events (
  event_time,
  user_id,
  session_id,
  event_name,
  source,
  experiment_key,
  experiment_variant,
  properties
)
SELECT 
  timestamp::TIMESTAMPTZ AS event_time,
  user_id,
  NULL AS session_id, -- в старой системе не было session_id
  event_type AS event_name,
  'frontend' AS source, -- предполагаем frontend
  (test_assignments::jsonb -> 0 ->> 'testId') AS experiment_key, -- берём первый эксперимент
  (test_assignments::jsonb -> 0 ->> 'variantId') AS experiment_variant,
  event_data::jsonb AS properties
FROM ab_events
WHERE timestamp IS NOT NULL
ON CONFLICT DO NOTHING;
```

## Чеклист интеграции

- [x] Создана новая таблица `raw_events` для всех событий
- [x] Добавлены поля `experiment_key` и `experiment_variant`
- [x] Создан новый эндпоинт `/api/analytics/log`
- [x] Frontend модуль `analytics.ts` поддерживает A/B данные
- [ ] Заменить вызовы старого `/api/events/log` на новый `/api/analytics/log`
- [ ] Мигрировать данные из `ab_events` в `raw_events`
- [ ] Обновить компоненты для использования нового `trackEvent()`
- [ ] Создать дашборды в DataLens для A/B экспериментов

## Важные отличия от старой системы

| Аспект | Старая система | Новая система |
|--------|---------------|---------------|
| Таблица событий | `ab_events` | `raw_events` |
| Эндпоинт | `/api/events/log` | `/api/analytics/log` |
| Формат данных | Специфичный для A/B | Универсальный |
| ETL | Отсутствует | Автоматический (pg_cron) |
| BI интеграция | Нет | DataLens/Metabase |
| Сессии | Нет | Автоматическое отслеживание |
| Дедупликация | Нет | Через `request_id` |
| Батчевая отправка | Нет | Есть |

## Рекомендации

1. **Постепенная миграция:** Не удаляйте старую систему сразу, работайте параллельно
2. **Двойное логирование:** Временно логируйте в обе системы для проверки
3. **Мониторинг:** Используйте `etl_runs` для отслеживания обработки событий
4. **Тестирование:** Запустите тестовый эксперимент перед миграцией реальных
