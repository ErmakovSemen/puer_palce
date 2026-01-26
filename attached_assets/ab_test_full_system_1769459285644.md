# A/B Тестирование: Полная система для эксперимента по цене

## 📌 Цель и контекст

**Задача**: Провести A/B тесты на сайте, чтобы оптимизировать цену и другие параметры.

**Ключевые требования:**
- Админ создаёт тесты в специальной вкладке админки (JSON конфиги)
- Фронт получает параметры теста и применяет их (например, умножает цену на `price_multy`)
- **Один пользователь = один вариант** (детерминировано, всегда один и тот же)
- После регистрации пользователь **остаётся в той же группе**
- Все события логируются для аналитики

**Основной поток:**
```
Пользователь заходит на сайт
  ↓
Получаем/создаём identifier (userId или deviceId)
  ↓
Запрашиваем конфиги тестов из админки
  ↓
Вычисляем какой вариант видит этот пользователь
  ↓
Применяем параметры (умножаем цену на price_multy)
  ↓
Логируем все события (просмотр, клик, заказ) с info о варианте
  ↓
Данные идут в DWH для аналитики
```

---

## 🎯 Шаг 1: Вкладка "Эксперименты" в админке

### Что нужно реализовать:
1. Новая вкладка в админке: **"Эксперименты"**
2. Список всех активных и неактивных тестов
3. Поиск по `test_id` и `name`
4. Кнопки: "Создать тест", "Редактировать", "Активировать/Деактивировать"
5. JSON редактор для конфига каждого теста

### Структура конфига теста:

```json
{
  "test_id": "price_jan_2026_v1",
  "name": "Тест цены Январь 2026 V1",
  "description": "Проверяем упадёт ли конверсия при цене -50%",
  "status": "active",
  "created_at": "2026-01-26T11:00:00Z",
  "updated_at": "2026-01-26T11:00:00Z",
  "variants": [
    {
      "id": "control",
      "name": "Контрольная группа (нормальная цена)",
      "weight": 50,
      "config": {
        "price_multy": 1.0
      }
    },
    {
      "id": "experiment",
      "name": "Экспериментальная группа (цена -50%)",
      "weight": 50,
      "config": {
        "price_multy": 0.5
      }
    }
  ]
}
```

### Поля:
- `test_id` — уникальный ID теста (kebab-case, без пробелов)
- `name` — понятное название для админки
- `description` — зачем этот тест, что мы проверяем
- `status` — "active" или "inactive"
- `created_at`, `updated_at` — для истории
- `variants` — массив вариантов (2, 3, 4+ вариантов)

### Примеры для админки:

**1. Простой 50/50 тест цены:**
```json
{
  "test_id": "price_50_50",
  "name": "50/50 тест цены",
  "description": "Базовый тест",
  "status": "active",
  "variants": [
    { "id": "control", "name": "Цена ×1", "weight": 50, "config": { "price_multy": 1.0 } },
    { "id": "cheap", "name": "Цена ×0.5", "weight": 50, "config": { "price_multy": 0.5 } }
  ]
}
```

**2. Постепенный выкат (80/20):**
```json
{
  "test_id": "price_rollout_week1",
  "name": "Постепенный выкат цены (неделя 1)",
  "description": "20% пользователей видят новую цену",
  "status": "active",
  "variants": [
    { "id": "control", "name": "Старая цена", "weight": 80, "config": { "price_multy": 1.0 } },
    { "id": "new_price", "name": "Новая цена -50%", "weight": 20, "config": { "price_multy": 0.5 } }
  ]
}
```

**3. Три варианта (33/33/34):**
```json
{
  "test_id": "price_three_variants",
  "name": "Три варианта цены",
  "description": "Проверяем какая цена лучше: -30%, -50% или нормальная",
  "status": "active",
  "variants": [
    { "id": "control", "name": "Базовая цена", "weight": 33, "config": { "price_multy": 1.0 } },
    { "id": "discount_30", "name": "Скидка 30%", "weight": 33, "config": { "price_multy": 0.7 } },
    { "id": "discount_50", "name": "Скидка 50%", "weight": 34, "config": { "price_multy": 0.5 } }
  ]
}
```

---

## 🎯 Шаг 2: Логика определения identifier (userId или deviceId)

### Где это реализуется:
Фронтенд, при загрузке страницы (в самом начале, до других запросов)

### Алгоритм:

```javascript
/**
 * Получить уникальный идентификатор пользователя
 * Приоритет: userId > deviceId
 */
function getOrCreateIdentifier() {
  // 1️⃣ Если пользователь залогинен → используем userId
  const userId = getCurrentUserId(); // из вашей системы авторизации
  if (userId) {
    return userId;
  }
  
  // 2️⃣ Если не залогинен → проверяем localStorage
  const DEVICE_ID_KEY = 'ab_test_device_id';
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  
  if (!deviceId) {
    // 3️⃣ Если deviceId не существует → создаём новый
    deviceId = 'dev_' + crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  
  return deviceId;
}
```

### Важно!
- `deviceId` сохраняется в `localStorage` и не меняется при перезагрузке
- Когда пользователь регистрируется, на бэке нужно связать `deviceId` с `userId`
- После регистрации фронт начнёт использовать `userId`, но **пользователь останется в той же группе** (потому что вычисление по хешу детерминировано)

### Пример при регистрации:

```javascript
async function registerUser(email, password) {
  const deviceId = getOrCreateIdentifier();
  
  const response = await api.register({
    email,
    password,
    device_id: deviceId  // ← Передаём deviceId на бэк
  });
  
  const userId = response.user_id;
  
  // Сохраняем userId в sessionStorage или локально
  setCurrentUserId(userId);
  
  // Логируем событие регистрации
  logEvent('user_registered', {
    user_id: userId,
    device_id: deviceId,
    timestamp: new Date().toISOString()
  });
  
  return userId;
}
```

---

## 🎯 Шаг 3: Получение конфигов и определение варианта

### Где это реализуется:
Фронтенд, после определения identifier

### Алгоритм:

```javascript
/**
 * Получить конфиг теста и определить вариант для пользователя
 */
async function getTestVariant(testId) {
  const identifier = getOrCreateIdentifier();
  
  // Запрашиваем конфиг из бэка (или уже загруженный в памяти)
  const testConfig = await getTestConfig(testId);
  
  if (!testConfig || testConfig.status === 'inactive') {
    // Если тест неактивен → возвращаем первый вариант (обычно control)
    return {
      test_id: testId,
      variant_id: testConfig?.variants[0]?.id || 'control',
      config: testConfig?.variants[0]?.config || {},
      status: 'inactive'
    };
  }
  
  // Детерминированный расчёт варианта на основе хеша
  const variant = determineVariant(identifier, testId, testConfig.variants);
  
  return {
    test_id: testId,
    variant_id: variant.id,
    config: variant.config
  };
}

/**
 * Детерминированное распределение по вариантам
 */
function determineVariant(identifier, testId, variants) {
  const combined = identifier + '-' + testId;
  
  // DJBX33X хеш функция
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash) + combined.charCodeAt(i);
    hash = hash & 0xFFFFFFFF;
  }
  
  const userNumber = Math.abs(hash) % 100;
  
  // Выбираем вариант по весам
  let accumulated = 0;
  for (const variant of variants) {
    accumulated += variant.weight;
    if (userNumber < accumulated) {
      return variant;
    }
  }
  
  // На случай ошибки округления → возвращаем последний
  return variants[variants.length - 1];
}
```

### Ключевое свойство:
- Один `identifier` + `test_id` **всегда** дают один результат
- Если пользователь с `device_id: "dev_123"` был в группе "experiment", то и после регистрации (когда мы используем `userId: "user_456"`) вычисление будет учитывать историю

**Важно**: На бэке нужно хранить маппинг `device_id → user_id`, чтобы при анализе данных связывать события до и после регистрации

---

## 🎯 Шаг 4: Применение параметров (на примере цены)

### Где это реализуется:
Фронтенд, при рендере страницы с ценой

### Алгоритм:

```javascript
/**
 * Вычислить финальную цену с учётом A/B теста
 */
async function getFinalPrice(basePrice) {
  // 1️⃣ Получаем конфиг теста
  const testResult = await getTestVariant('price_jan_2026_v1');
  
  // 2️⃣ Извлекаем коэффициент из конфига
  const priceMultiplier = testResult.config.price_multy || 1.0;
  
  // 3️⃣ Вычисляем финальную цену
  const finalPrice = Math.round(basePrice * priceMultiplier);
  
  // 4️⃣ Логируем просмотр цены (см. Шаг 5)
  logEvent('price_displayed', {
    test_id: testResult.test_id,
    variant_id: testResult.variant_id,
    base_price: basePrice,
    price_multiplier: priceMultiplier,
    final_price: finalPrice
  });
  
  return finalPrice;
}

// Использование в HTML:
const basePrice = 299; // базовая цена
const finalPrice = await getFinalPrice(basePrice);
document.querySelector('.price').textContent = finalPrice + ' ₽';
```

### Примеры применения:
```javascript
// На странице товара
const productPrice = await getFinalPrice(productData.base_price);

// При добавлении в корзину
const cartItemPrice = await getFinalPrice(item.base_price);

// При оформлении заказа
const orderTotal = items.reduce((sum, item) => {
  return sum + getFinalPrice(item.base_price);
}, 0);
```

---

## 🎯 Шаг 5: Логирование событий для аналитики

### Где это реализуется:
Фронтенд, при каждом событии, которое нас интересует

### Структура события:

```json
{
  "event_type": "price_displayed",
  "timestamp": "2026-01-26T11:22:00Z",
  "user_identifier": "dev_8f4a9b2c-1234",
  "user_id": null,
  "device_id": "dev_8f4a9b2c-1234",
  "test_assignments": {
    "price_jan_2026_v1": {
      "variant_id": "experiment",
      "price_multy": 0.5
    }
  },
  "event_data": {
    "base_price": 299,
    "final_price": 150,
    "product_id": "prod_123"
  }
}
```

### Какие события логировать:

| Событие | Когда | Значение |
|---------|-------|----------|
| `page_view` | Пользователь открыл страницу | URL, referrer |
| `price_displayed` | Цена показана на странице | base_price, final_price, multiplier |
| `add_to_cart` | Клик "добавить в корзину" | product_id, final_price |
| `view_cart` | Открыта страница корзины | cart_total, item_count |
| `checkout_start` | Начало оформления заказа | cart_total |
| `order_placed` | Заказ создан | order_id, order_total, items_count |
| `purchase_confirmed` | Оплата получена | order_id, order_total |

### Реализация логирования:

```javascript
/**
 * Логировать событие в аналитику
 */
async function logEvent(eventType, eventData = {}) {
  const identifier = getOrCreateIdentifier();
  const userId = getCurrentUserId();
  
  // Собираем информацию о всех активных тестах
  const testAssignments = {};
  const activeTests = ['price_jan_2026_v1', 'shipping_test', 'ui_test'];
  
  for (const testId of activeTests) {
    const testResult = await getTestVariant(testId);
    testAssignments[testId] = {
      variant_id: testResult.variant_id,
      ...testResult.config
    };
  }
  
  // Формируем событие
  const event = {
    event_type: eventType,
    timestamp: new Date().toISOString(),
    user_identifier: identifier,
    user_id: userId || null,
    device_id: identifier.startsWith('dev_') ? identifier : null,
    test_assignments: testAssignments,
    event_data: eventData
  };
  
  // Отправляем на бэк
  await fetch('/api/events/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event)
  });
}

// Примеры использования:
logEvent('page_view', { url: window.location.pathname });
logEvent('add_to_cart', { product_id: 'prod_123', price: 150 });
logEvent('order_placed', { order_id: 'ord_456', total: 500 });
```

### Бэк обрабатывает события:
1. Сохраняет в базе (events таблица)
2. Отправляет в DWH для аналитики
3. Строит dashboards по метрикам: конверсия, AOV, CR по вариантам, etc

---

## 📊 Шаг 6: Аналитика на основе логов (Reference)

### Метрики, которые мы можем считать:

```sql
-- Конверсия по вариантам
SELECT 
  test_assignments->>'price_jan_2026_v1' as variant,
  COUNT(DISTINCT user_identifier) as users,
  COUNTIF(event_type = 'order_placed') / COUNT(*) as conversion_rate
FROM events
WHERE test_assignments IS NOT NULL
GROUP BY variant;

-- AOV (Average Order Value) по вариантам
SELECT
  test_assignments->>'price_jan_2026_v1' as variant,
  AVG(event_data->>'order_total'::float) as aov
FROM events
WHERE event_type = 'order_placed'
GROUP BY variant;

-- Метрика просмотров цены
SELECT
  test_assignments->>'price_jan_2026_v1' as variant,
  COUNT(*) as price_views
FROM events
WHERE event_type = 'price_displayed'
GROUP BY variant;
```

---

## ✅ Чек-лист реализации

### Админка:
- [ ] Вкладка "Эксперименты" с поиском
- [ ] Создание/редактирование конфигов (JSON редактор)
- [ ] Активация/деактивация тестов
- [ ] История изменений конфигов

### Фронтенд:
- [ ] `getOrCreateIdentifier()` — получение userId или deviceId
- [ ] `getTestVariant(testId)` — определение варианта пользователя
- [ ] `determineVariant()` — детерминированное распределение по хешу
- [ ] `getFinalPrice()` — применение price_multy к цене
- [ ] `logEvent()` — логирование всех событий
- [ ] Интеграция логирования на ключевых страницах (продукт, корзина, чекаут)

### Бэк:
- [ ] API `/api/experiments` — получение конфигов тестов
- [ ] API `/api/events/log` — приём событий от фронта
- [ ] Таблица `experiments` в БД (конфиги)
- [ ] Таблица `events` в БД (логи)
- [ ] Маппинг `device_id → user_id` при регистрации
- [ ] Синхронизация с DWH для аналитики

### DWH/Аналитика:
- [ ] Таблица с событиями (events)
- [ ] Таблица с информацией о тестах (experiments)
- [ ] Dashboard с метриками по вариантам
- [ ] Статистическая значимость результатов

---

**Версия**: 3.0 (Полная система)
**Дата**: 26 января 2026
**Автор**: Product Manager (Яндекс Доставка)