/**
 * Analytics Event Logging
 * 
 * Backend модуль для приёма и логирования событий аналитики
 * в таблицу raw_events PostgreSQL
 */

import { pool } from "./db";
import { z } from "zod";

// ============================================
// Схемы валидации для событий
// ============================================

/**
 * Схема для одного события аналитики
 */
export const analyticsEventSchema = z.object({
  event_name: z.string().min(1, "Название события обязательно"),
  event_time: z.string().datetime().optional(), // ISO 8601 формат
  user_id: z.string().optional().nullable(),
  session_id: z.string().optional().nullable(),
  request_id: z.string().optional().nullable(), // Для дедупликации
  source: z.enum(["frontend", "backend"]).default("frontend"),
  page: z.string().optional().nullable(),
  experiment_key: z.string().optional().nullable(),
  experiment_variant: z.string().optional().nullable(),
  properties: z.record(z.any()).optional(), // Произвольные свойства
});

/**
 * Схема для батчевой отправки событий
 */
export const analyticsEventsBatchSchema = z.object({
  events: z.array(analyticsEventSchema).min(1).max(100), // Максимум 100 событий за раз
});

export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;
export type AnalyticsEventsBatch = z.infer<typeof analyticsEventsBatchSchema>;

// ============================================
// Функции логирования событий
// ============================================

/**
 * Логирует одно событие в базу данных
 */
export async function logEvent(event: AnalyticsEvent): Promise<{ success: boolean; id?: number }> {
  try {
    const result = await pool.query(
      `
      INSERT INTO raw_events (
        event_time,
        user_id,
        session_id,
        request_id,
        event_name,
        source,
        page,
        experiment_key,
        experiment_variant,
        properties
      ) VALUES (
        COALESCE($1::timestamptz, NOW()),
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10::jsonb
      )
      RETURNING id
      `,
      [
        event.event_time || null,
        event.user_id || null,
        event.session_id || null,
        event.request_id || null,
        event.event_name,
        event.source,
        event.page || null,
        event.experiment_key || null,
        event.experiment_variant || null,
        event.properties ? JSON.stringify(event.properties) : null,
      ]
    );

    return {
      success: true,
      id: result.rows[0].id,
    };
  } catch (error) {
    console.error("Error logging analytics event:", error);
    throw error;
  }
}

/**
 * Логирует батч событий (массовая вставка)
 */
export async function logEventsBatch(
  events: AnalyticsEvent[]
): Promise<{ success: boolean; count: number }> {
  if (events.length === 0) {
    return { success: true, count: 0 };
  }

  try {
    // Подготовка значений для batch insert
    const values: any[] = [];
    const placeholders: string[] = [];

    events.forEach((event, index) => {
      const offset = index * 10;
      placeholders.push(
        `(
          COALESCE($${offset + 1}::timestamptz, NOW()),
          $${offset + 2},
          $${offset + 3},
          $${offset + 4},
          $${offset + 5},
          $${offset + 6},
          $${offset + 7},
          $${offset + 8},
          $${offset + 9},
          $${offset + 10}::jsonb
        )`
      );

      values.push(
        event.event_time || null,
        event.user_id || null,
        event.session_id || null,
        event.request_id || null,
        event.event_name,
        event.source,
        event.page || null,
        event.experiment_key || null,
        event.experiment_variant || null,
        event.properties ? JSON.stringify(event.properties) : null
      );
    });

    const query = `
      INSERT INTO raw_events (
        event_time,
        user_id,
        session_id,
        request_id,
        event_name,
        source,
        page,
        experiment_key,
        experiment_variant,
        properties
      ) VALUES ${placeholders.join(", ")}
    `;

    const result = await pool.query(query, values);

    return {
      success: true,
      count: result.rowCount || 0,
    };
  } catch (error) {
    console.error("Error logging analytics events batch:", error);
    throw error;
  }
}

/**
 * Вспомогательная функция: логирование события из бэкенда
 * (упрощённый интерфейс для использования в других модулях сервера)
 */
export async function trackBackendEvent(
  eventName: string,
  properties?: Record<string, any>,
  userId?: string
): Promise<void> {
  try {
    await logEvent({
      event_name: eventName,
      source: "backend",
      user_id: userId,
      properties,
    });
  } catch (error) {
    // Не бросаем ошибку наружу, чтобы не ломать основной flow
    console.error(`Failed to track backend event '${eventName}':`, error);
  }
}

// ============================================
// Типовые события для удобства
// ============================================

export const AnalyticsEvents = {
  // Просмотры страниц
  PAGE_VIEW: "page_view",
  
  // События товаров
  PRODUCT_VIEW: "product_view",
  ADD_TO_CART: "add_to_cart",
  REMOVE_FROM_CART: "remove_from_cart",
  
  // События оформления заказа
  CHECKOUT_STARTED: "checkout_started",
  CHECKOUT_COMPLETED: "checkout_completed",
  ORDER_COMPLETED: "order_completed",
  
  // События пользователя
  USER_REGISTERED: "user_registered",
  USER_LOGGED_IN: "user_logged_in",
  USER_LOGGED_OUT: "user_logged_out",
  
  // События поиска
  SEARCH_PERFORMED: "search_performed",
  
  // События квиза
  QUIZ_STARTED: "quiz_started",
  QUIZ_COMPLETED: "quiz_completed",
  
  // События лояльности
  LOYALTY_LEVEL_UP: "loyalty_level_up",
  
  // Ошибки
  ERROR_OCCURRED: "error_occurred",
} as const;

export type AnalyticsEventName = typeof AnalyticsEvents[keyof typeof AnalyticsEvents];
