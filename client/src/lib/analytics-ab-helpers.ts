/**
 * Analytics + A/B Testing Integration Helpers
 * 
 * Вспомогательные функции для интеграции новой аналитики
 * с существующей A/B системой
 */

import { trackEvent } from "./analytics";

/**
 * Интерфейс для A/B назначения из существующей системы
 */
interface TestAssignment {
  testId: string;
  variantId: string;
  config: Record<string, any>;
}

/**
 * Отслеживает событие с автоматическим добавлением всех активных A/B тестов
 * 
 * @param eventName - Название события
 * @param testAssignments - Объект с назначениями из useAbTesting().getAllTestAssignments()
 * @param options - Дополнительные параметры
 * 
 * @example
 * ```typescript
 * const { getAllTestAssignments } = useAbTesting();
 * 
 * trackEventWithExperiments("add_to_cart", getAllTestAssignments(), {
 *   properties: { product_id: 123 }
 * });
 * ```
 */
export async function trackEventWithExperiments(
  eventName: string,
  testAssignments: Record<string, TestAssignment>,
  options: {
    properties?: Record<string, any>;
    immediate?: boolean;
  } = {}
): Promise<void> {
  // Берём первый активный эксперимент как основной
  // (обычно у пользователя только один активный эксперимент)
  const assignments = Object.values(testAssignments);
  const primaryExperiment = assignments[0];

  // Добавляем все эксперименты в properties
  const enhancedProperties = {
    ...options.properties,
    // Все активные эксперименты
    active_experiments: assignments.map(a => ({
      test_id: a.testId,
      variant_id: a.variantId,
      config: a.config,
    })),
    // Количество активных экспериментов
    experiments_count: assignments.length,
  };

  await trackEvent(eventName, {
    properties: enhancedProperties,
    immediate: options.immediate,
    experimentKey: primaryExperiment?.testId,
    experimentVariant: primaryExperiment?.variantId,
  });
}

/**
 * Отслеживает событие конкретного A/B теста
 * 
 * @param eventName - Название события
 * @param testId - ID теста из experiments таблицы
 * @param variant - Вариант из useAbTesting().getTestVariant()
 * @param options - Дополнительные параметры
 * 
 * @example
 * ```typescript
 * const { getTestVariant } = useAbTesting();
 * const variant = getTestVariant("checkout-button-color");
 * 
 * trackExperimentEvent("button_clicked", "checkout-button-color", variant, {
 *   properties: { button_position: "top" }
 * });
 * ```
 */
export async function trackExperimentEvent(
  eventName: string,
  testId: string,
  variant: TestAssignment | null,
  options: {
    properties?: Record<string, any>;
    immediate?: boolean;
  } = {}
): Promise<void> {
  if (!variant) {
    // Если вариант не найден, логируем без A/B данных
    await trackEvent(eventName, options);
    return;
  }

  const enhancedProperties = {
    ...options.properties,
    // Конфигурация варианта
    variant_config: variant.config,
  };

  await trackEvent(eventName, {
    properties: enhancedProperties,
    immediate: options.immediate,
    experimentKey: testId,
    experimentVariant: variant.variantId,
  });
}

/**
 * Отслеживает показ варианта эксперимента (impression)
 * Важно для расчёта метрик вовлечённости
 * 
 * @param testId - ID теста
 * @param variant - Вариант теста
 * @param context - Контекст показа (страница, компонент и т.п.)
 * 
 * @example
 * ```typescript
 * const { getTestVariant } = useAbTesting();
 * const variant = getTestVariant("hero-banner-design");
 * 
 * useEffect(() => {
 *   if (variant) {
 *     trackExperimentImpression("hero-banner-design", variant, {
 *       page: "/",
 *       component: "Hero"
 *     });
 *   }
 * }, [variant]);
 * ```
 */
export async function trackExperimentImpression(
  testId: string,
  variant: TestAssignment | null,
  context?: Record<string, any>
): Promise<void> {
  if (!variant) return;

  await trackEvent("experiment_impression", {
    experimentKey: testId,
    experimentVariant: variant.variantId,
    properties: {
      ...context,
      variant_config: variant.config,
    },
  });
}

/**
 * Отслеживает конверсию в эксперименте
 * Обёртка над trackEvent для основных конверсионных событий
 * 
 * @param testId - ID теста
 * @param variant - Вариант теста
 * @param conversionData - Данные о конверсии
 * 
 * @example
 * ```typescript
 * const { getTestVariant } = useAbTesting();
 * const variant = getTestVariant("pricing-test");
 * 
 * // При завершении заказа
 * trackExperimentConversion("pricing-test", variant, {
 *   order_id: 123,
 *   order_total: 1500,
 *   multiplier: variant?.config.price_multy
 * });
 * ```
 */
export async function trackExperimentConversion(
  testId: string,
  variant: TestAssignment | null,
  conversionData?: Record<string, any>
): Promise<void> {
  if (!variant) return;

  await trackEvent("experiment_conversion", {
    experimentKey: testId,
    experimentVariant: variant.variantId,
    immediate: true, // Конверсии отправляем немедленно
    properties: {
      ...conversionData,
      variant_config: variant.config,
    },
  });
}

/**
 * Создаёт обёртку для React компонента с автоматическим отслеживанием A/B
 * 
 * @param Component - React компонент
 * @param testId - ID эксперимента
 * @param eventPrefix - Префикс для событий
 * 
 * @example
 * ```typescript
 * const TrackedButton = withExperimentTracking(
 *   Button,
 *   "checkout-button-test",
 *   "checkout_button"
 * );
 * 
 * // Автоматически отслеживает impression при монтировании
 * <TrackedButton onClick={handleClick}>Оформить</TrackedButton>
 * ```
 */
export function createExperimentTracker(
  testId: string,
  variantGetter: () => TestAssignment | null
) {
  return {
    /**
     * Отслеживает impression
     */
    trackImpression: (context?: Record<string, any>) => {
      const variant = variantGetter();
      return trackExperimentImpression(testId, variant, context);
    },

    /**
     * Отслеживает произвольное событие
     */
    trackEvent: (
      eventName: string,
      properties?: Record<string, any>,
      immediate?: boolean
    ) => {
      const variant = variantGetter();
      return trackExperimentEvent(eventName, testId, variant, {
        properties,
        immediate,
      });
    },

    /**
     * Отслеживает конверсию
     */
    trackConversion: (conversionData?: Record<string, any>) => {
      const variant = variantGetter();
      return trackExperimentConversion(testId, variant, conversionData);
    },

    /**
     * Получает текущий вариант
     */
    getVariant: () => variantGetter(),
  };
}

/**
 * Хелпер для миграции со старой системы логирования
 * 
 * @deprecated Используйте trackEvent() напрямую
 * 
 * Маппинг старых событий на новые:
 * - page_view → page_view
 * - add_to_cart → add_to_cart
 * - order_placed → order_completed
 * - checkout_initiated → checkout_started
 */
export async function logAbEvent(
  eventType: string,
  testAssignments: Record<string, TestAssignment>,
  eventData?: Record<string, any>
): Promise<void> {
  // Маппинг старых названий на новые
  const eventMapping: Record<string, string> = {
    order_placed: "order_completed",
    checkout_initiated: "checkout_started",
    product_clicked: "product_view",
  };

  const newEventName = eventMapping[eventType] || eventType;

  await trackEventWithExperiments(newEventName, testAssignments, {
    properties: eventData,
  });
}
