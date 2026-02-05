/**
 * Integration between Analytics and existing A/B Testing system
 * 
 * Этот модуль связывает новую систему аналитики с существующей
 * системой A/B тестирования (use-ab-testing hook)
 */

import { trackEvent } from "./analytics";

/**
 * Интерфейс для A/B состояния
 */
interface AbTestAssignment {
  testId: string;
  variantId: string;
  config: Record<string, any>;
}

/**
 * Хранит текущие активные A/B тесты в глобальном состоянии
 * для доступа из analytics модуля
 */
export function setGlobalAbState(assignments: Record<string, AbTestAssignment>): void {
  if (typeof window === "undefined") return;
  
  (window as any).__AB_STATE__ = {
    assignments,
    // Берём первый активный эксперимент как "основной"
    activeExperiment: Object.values(assignments)[0] || null,
  };
}

/**
 * Отслеживает событие с автоматическим добавлением данных A/B теста
 * 
 * @param eventName - Название события
 * @param testId - ID теста (опционально, если не передан - возьмёт первый активный)
 * @param properties - Дополнительные свойства
 * 
 * @example
 * ```typescript
 * const { getTestVariant } = useAbTesting();
 * const variant = getTestVariant("checkout-button-color");
 * 
 * trackEventWithAbTest("button_clicked", "checkout-button-color", {
 *   button_color: variant?.config.color
 * });
 * ```
 */
export async function trackEventWithAbTest(
  eventName: string,
  testId: string,
  properties?: Record<string, any>
): Promise<void> {
  // Получаем вариант из глобального состояния
  const abState = (window as any).__AB_STATE__;
  const assignment = abState?.assignments?.[testId];
  
  if (!assignment) {
    // Если A/B тест не найден, просто логируем событие без него
    return trackEvent(eventName, { properties });
  }
  
  return trackEvent(eventName, {
    experimentKey: assignment.testId,
    experimentVariant: assignment.variantId,
    properties: {
      ...properties,
      // Добавляем конфиг варианта в properties для детального анализа
      ab_config: assignment.config,
    },
  });
}

/**
 * HOC для автоматического трекинга A/B событий
 * Оборачивает компонент и автоматически логирует показ варианта
 */
export function withAbTracking<P extends object>(
  Component: React.ComponentType<P>,
  testId: string,
  eventName: string = "ab_variant_shown"
) {
  return function AbTrackedComponent(props: P) {
    const React = require("react");
    
    React.useEffect(() => {
      // Логируем показ варианта
      trackEventWithAbTest(eventName, testId);
    }, []);
    
    return React.createElement(Component, props);
  };
}
