/**
 * Analytics Tracking - Frontend Module
 * 
 * Клиентский модуль для отправки событий аналитики на сервер
 * Поддерживает session_id, request_id для дедупликации, batch отправку
 */

import { getApiUrl } from "./api-config";
import { nanoid } from "nanoid";

// ============================================
// Типы
// ============================================

export interface AnalyticsEvent {
  event_name: string;
  event_time?: string; // ISO 8601
  user_id?: string;
  session_id?: string;
  request_id?: string;
  source?: "frontend" | "backend";
  page?: string;
  experiment_key?: string;
  experiment_variant?: string;
  properties?: Record<string, any>;
}

export interface TrackEventOptions {
  /** Произвольные свойства события */
  properties?: Record<string, any>;
  /** Отправить немедленно (по умолчанию false - батчевая отправка) */
  immediate?: boolean;
  /** Ключ эксперимента */
  experimentKey?: string;
  /** Вариант эксперимента */
  experimentVariant?: string;
}

// ============================================
// Константы
// ============================================

const SESSION_STORAGE_KEY = "analytics_session_id";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 минут
const BATCH_SIZE = 10; // Отправлять батч после накопления 10 событий
const BATCH_TIMEOUT_MS = 5000; // Или каждые 5 секунд

// ============================================
// Управление сессиями
// ============================================

interface SessionData {
  session_id: string;
  last_activity: number;
}

/**
 * Получает или создаёт session_id
 */
function getSessionId(): string {
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    
    if (stored) {
      const data: SessionData = JSON.parse(stored);
      const now = Date.now();
      
      // Проверяем, не истекла ли сессия
      if (now - data.last_activity < SESSION_TIMEOUT_MS) {
        // Обновляем время активности
        data.last_activity = now;
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
        return data.session_id;
      }
    }
  } catch (e) {
    console.error("Failed to get session_id from localStorage:", e);
  }
  
  // Создаём новую сессию
  const newSessionId = `sess_${nanoid()}`;
  const sessionData: SessionData = {
    session_id: newSessionId,
    last_activity: Date.now(),
  };
  
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
  } catch (e) {
    console.error("Failed to save session_id to localStorage:", e);
  }
  
  return newSessionId;
}

/**
 * Обновляет время последней активности сессии
 */
function updateSessionActivity(): void {
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      const data: SessionData = JSON.parse(stored);
      data.last_activity = Date.now();
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
    }
  } catch (e) {
    // Игнорируем ошибки
  }
}

// ============================================
// Батчевая отправка событий
// ============================================

class AnalyticsBatcher {
  private queue: AnalyticsEvent[] = [];
  private timer: NodeJS.Timeout | null = null;

  /**
   * Добавляет событие в очередь
   */
  add(event: AnalyticsEvent): void {
    this.queue.push(event);
    
    // Отправляем батч, если достигли лимита
    if (this.queue.length >= BATCH_SIZE) {
      this.flush();
    } else if (!this.timer) {
      // Запускаем таймер, если его ещё нет
      this.timer = setTimeout(() => this.flush(), BATCH_TIMEOUT_MS);
    }
  }

  /**
   * Отправляет все накопленные события
   */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.queue.length === 0) {
      return;
    }

    const eventsToSend = [...this.queue];
    this.queue = [];

    try {
      const response = await fetch(getApiUrl("/api/analytics/log/batch"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ events: eventsToSend }),
      });

      if (!response.ok) {
        console.error("Failed to send analytics batch:", response.status);
        // В случае ошибки можно попробовать отправить события по одному
        // или сохранить в localStorage для повторной отправки
      }
    } catch (error) {
      console.error("Error sending analytics batch:", error);
    }
  }
}

const batcher = new AnalyticsBatcher();

// Отправляем батч при закрытии страницы
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    batcher.flush();
  });
  
  // Также отправляем при потере фокуса (для мобильных)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      batcher.flush();
    }
  });
}

// ============================================
// Основная функция отправки событий
// ============================================

/**
 * Отправляет событие аналитики
 * 
 * @param eventName - Название события (например, "page_view", "add_to_cart")
 * @param options - Дополнительные параметры события
 * 
 * @example
 * ```typescript
 * // Простое событие
 * trackEvent("page_view");
 * 
 * // Событие с properties
 * trackEvent("add_to_cart", {
 *   properties: { product_id: 123, product_name: "Зелёный чай" }
 * });
 * 
 * // Событие с немедленной отправкой
 * trackEvent("order_completed", {
 *   properties: { order_id: 456, total: 1500 },
 *   immediate: true
 * });
 * ```
 */
export async function trackEvent(
  eventName: string,
  options: TrackEventOptions = {}
): Promise<void> {
  const { properties, immediate = false, experimentKey, experimentVariant } = options;

  // Получаем текущий URL
  const page = typeof window !== "undefined" ? window.location.pathname : undefined;

  // Получаем user_id из localStorage (если есть авторизация)
  let userId: string | undefined;
  try {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      userId = user.id;
    }
  } catch (e) {
    // Игнорируем ошибки
  }

  // ИНТЕГРАЦИЯ: Автоматически добавляем данные из существующей A/B системы
  let finalExperimentKey = experimentKey;
  let finalExperimentVariant = experimentVariant;
  
  // Пытаемся получить текущие A/B тесты из хука (если доступен)
  if (!experimentKey && typeof window !== "undefined") {
    try {
      // Пытаемся взять данные из глобального состояния A/B тестов
      const abState = (window as any).__AB_STATE__;
      if (abState && abState.activeExperiment) {
        finalExperimentKey = abState.activeExperiment.testId;
        finalExperimentVariant = abState.activeExperiment.variantId;
      }
    } catch (e) {
      // Игнорируем, если A/B state недоступен
    }
  }

  const event: AnalyticsEvent = {
    event_name: eventName,
    event_time: new Date().toISOString(),
    user_id: userId,
    session_id: getSessionId(),
    request_id: `req_${nanoid()}`, // Уникальный ID для дедупликации
    source: "frontend",
    page,
    experiment_key: finalExperimentKey,
    experiment_variant: finalExperimentVariant,
    properties,
  };

  // Обновляем время активности сессии
  updateSessionActivity();

  if (immediate) {
    // Немедленная отправка
    try {
      const response = await fetch(getApiUrl("/api/analytics/log"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        console.error("Failed to send analytics event:", response.status);
      }
    } catch (error) {
      console.error("Error sending analytics event:", error);
    }
  } else {
    // Добавляем в батч
    batcher.add(event);
  }
}

// ============================================
// Предопределённые события
// ============================================

/**
 * Отслеживание просмотра страницы
 */
export function trackPageView(page?: string): void {
  trackEvent("page_view", {
    properties: { page: page || window.location.pathname },
  });
}

/**
 * Отслеживание просмотра товара
 */
export function trackProductView(productId: number, productName: string): void {
  trackEvent("product_view", {
    properties: { product_id: productId, product_name: productName },
  });
}

/**
 * Отслеживание добавления в корзину
 */
export function trackAddToCart(productId: number, productName: string, quantity: number): void {
  trackEvent("add_to_cart", {
    properties: { product_id: productId, product_name: productName, quantity },
  });
}

/**
 * Отслеживание удаления из корзины
 */
export function trackRemoveFromCart(productId: number, productName: string): void {
  trackEvent("remove_from_cart", {
    properties: { product_id: productId, product_name: productName },
  });
}

/**
 * Отслеживание начала оформления заказа
 */
export function trackCheckoutStarted(cartTotal: number, itemsCount: number): void {
  trackEvent("checkout_started", {
    properties: { cart_total: cartTotal, items_count: itemsCount },
    immediate: true,
  });
}

/**
 * Отслеживание завершения заказа
 */
export function trackOrderCompleted(orderId: number, total: number): void {
  trackEvent("order_completed", {
    properties: { order_id: orderId, order_total: total },
    immediate: true,
  });
}

/**
 * Отслеживание регистрации
 */
export function trackUserRegistered(userId: string): void {
  trackEvent("user_registered", {
    properties: { user_id: userId },
    immediate: true,
  });
}

/**
 * Отслеживание входа
 */
export function trackUserLoggedIn(userId: string): void {
  trackEvent("user_logged_in", {
    properties: { user_id: userId },
  });
}

/**
 * Отслеживание выхода
 */
export function trackUserLoggedOut(): void {
  trackEvent("user_logged_out", {
    immediate: true,
  });
}

/**
 * Отслеживание поиска
 */
export function trackSearch(query: string, resultsCount: number): void {
  trackEvent("search_performed", {
    properties: { query, results_count: resultsCount },
  });
}

/**
 * Отслеживание квиза
 */
export function trackQuizStarted(): void {
  trackEvent("quiz_started");
}

export function trackQuizCompleted(recommendedTeaType: string): void {
  trackEvent("quiz_completed", {
    properties: { recommended_tea_type: recommendedTeaType },
  });
}

/**
 * Отслеживание ошибок
 */
export function trackError(errorType: string, errorMessage: string): void {
  trackEvent("error_occurred", {
    properties: { error_type: errorType, error_message: errorMessage },
    immediate: true,
  });
}

// ============================================
// Автоматическое отслеживание
// ============================================

/**
 * Инициализирует автоматическое отслеживание событий
 * Вызывается один раз при загрузке приложения
 */
export function initAnalytics(): void {
  if (typeof window === "undefined") {
    return;
  }

  // Автоматически отслеживаем первый просмотр страницы
  trackPageView();

  // Отслеживаем переходы (для SPA)
  // Если используется react-router или wouter, можно слушать изменения URL
  let lastPath = window.location.pathname;
  setInterval(() => {
    const currentPath = window.location.pathname;
    if (currentPath !== lastPath) {
      lastPath = currentPath;
      trackPageView(currentPath);
    }
  }, 1000);
}
