import type { DbOrder } from "@shared/schema";
import type { CartBreakdown } from "@shared/pricing";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: {
      id: number;
      type: string;
      title?: string;
    };
    from?: {
      id: number;
      first_name: string;
      username?: string;
    };
    text?: string;
  };
}

interface TelegramResponse {
  ok: boolean;
  result: TelegramUpdate[];
}

export interface OrderDiscountPercents {
  firstOrder?: number;
  loyalty?: number;
  custom?: number;
}

export async function sendTelegramMessage(text: string, chatId?: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN not configured');
    return false;
  }

  const targetChatId = chatId || TELEGRAM_CHAT_ID;
  if (!targetChatId) {
    console.error('TELEGRAM_CHAT_ID not configured');
    return false;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: targetChatId,
        text,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();
    
    if (!data.ok) {
      console.error('Telegram API error:', data);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return false;
  }
}

export async function getTelegramUpdates(): Promise<TelegramUpdate[]> {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN not configured');
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`);
    const data: TelegramResponse = await response.json();
    
    if (!data.ok) {
      throw new Error('Failed to get Telegram updates');
    }

    return data.result;
  } catch (error) {
    console.error('Error getting Telegram updates:', error);
    throw error;
  }
}

function formatMoney(amount: number): string {
  return amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽';
}

function formatPaymentStatus(paymentStatus: string | null | undefined): string {
  if (!paymentStatus) return 'Оплата при получении';
  switch (paymentStatus) {
    case 'NEW':              return 'Ожидает оплаты';
    case 'CONFIRMED':        return 'Оплачено ✓';
    case 'AUTHORIZED':       return 'Авторизовано';
    case 'REJECTED':         return 'Отклонено';
    case 'CANCELLED':        return 'Отменено';
    case 'REVERSED':         return 'Возврат';
    case 'REFUNDED':         return 'Возвращено';
    case 'PARTIAL_REFUNDED': return 'Частичный возврат';
    case 'RECEIPT':          return 'Чек выдан';
    default:                 return paymentStatus;
  }
}

export function formatOrderNotification(
  order: DbOrder,
  breakdown?: CartBreakdown | null,
  percents?: OrderDiscountPercents | null,
): string {
  const items = JSON.parse(order.items);

  let message = `<b>НОВЫЙ ЗАКАЗ #${order.id}</b>\n\n`;

  // --- Клиент ---
  message += `<b>Клиент:</b> ${order.name}\n`;
  message += `<b>Email:</b> ${order.email}\n`;
  if (order.phone) {
    message += `<b>Телефон:</b> ${order.phone}\n`;
  }

  // --- Статус оплаты ---
  message += `<b>Оплата:</b> ${formatPaymentStatus(order.paymentStatus)}\n`;

  // --- Состав ---
  message += `\n<b>Состав заказа:</b>\n`;
  items.forEach((item: any) => {
    const itemTotal = item.pricePerGram * item.quantity;
    message += `  • ${item.name} × ${item.quantity} г — ${formatMoney(itemTotal)}\n`;
  });

  // --- Стоимость ---
  message += `\n<b>Стоимость:</b>\n`;

  if (breakdown) {
    const hasDiscount =
      breakdown.bulkDiscountAmount > 0.005 ||
      breakdown.firstOrderDiscountAmount > 0.005 ||
      breakdown.loyaltyDiscountAmount > 0.005 ||
      breakdown.customDiscountAmount > 0.005;

    if (hasDiscount) {
      // Show pre-discount subtotal (A/B prices, before bulk)
      message += `  Подытог: ${formatMoney(breakdown.abAdjustedTotal)}\n`;

      if (breakdown.bulkDiscountAmount > 0.005) {
        message += `  − Оптовая скидка (≥100 г): −${formatMoney(breakdown.bulkDiscountAmount)}\n`;
      }
      if (breakdown.firstOrderDiscountAmount > 0.005) {
        const pctLabel = percents?.firstOrder ? ` (${percents.firstOrder}%)` : '';
        message += `  − Скидка на первый заказ${pctLabel}: −${formatMoney(breakdown.firstOrderDiscountAmount)}\n`;
      }
      if (breakdown.loyaltyDiscountAmount > 0.005) {
        const pctLabel = percents?.loyalty ? ` (${percents.loyalty}%)` : '';
        message += `  − Скидка по программе лояльности${pctLabel}: −${formatMoney(breakdown.loyaltyDiscountAmount)}\n`;
      }
      if (breakdown.customDiscountAmount > 0.005) {
        const pctLabel = percents?.custom ? ` (${percents.custom}%)` : '';
        message += `  − Индивидуальная скидка${pctLabel}: −${formatMoney(breakdown.customDiscountAmount)}\n`;
      }
      message += `  ─────────────────────\n`;
    }
    message += `  <b>Итого: ${formatMoney(breakdown.finalTotal)}</b>\n`;
  } else {
    // Fallback: compute subtotal from stored items
    const subtotal = items.reduce(
      (sum: number, item: any) => sum + item.pricePerGram * item.quantity,
      0,
    );
    const discountAmount = subtotal - order.total;

    if (discountAmount > 0.01) {
      message += `  Подытог: ${formatMoney(subtotal)}\n`;
      if (order.usedFirstOrderDiscount) {
        message += `  − Скидка на первый заказ: −${formatMoney(discountAmount)}\n`;
      } else {
        message += `  − Скидка: −${formatMoney(discountAmount)}\n`;
      }
      message += `  ─────────────────────\n`;
    }
    message += `  <b>Итого: ${formatMoney(order.total)}</b>\n`;
  }

  // --- Доставка ---
  message += `\n<b>Адрес доставки:</b>\n${order.address}`;

  if (order.comment) {
    message += `\n\n<b>Комментарий:</b>\n${order.comment}`;
  }

  return message;
}

export async function sendOrderNotification(
  order: DbOrder,
  breakdown?: CartBreakdown | null,
  percents?: OrderDiscountPercents | null,
): Promise<void> {
  const message = formatOrderNotification(order, breakdown, percents);
  const success = await sendTelegramMessage(message);
  
  if (!success) {
    throw new Error('Failed to send Telegram notification');
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendFailedReceiptSmsNotification(
  orderNumber: number,
  phone: string,
  smsText: string
): Promise<void> {
  // Escape HTML entities in user data to prevent Telegram API rejection
  const escapedSmsText = escapeHtml(smsText);
  const escapedPhone = escapeHtml(phone);
  
  let message = `<b>⚠️ НЕ УДАЛОСЬ ОТПРАВИТЬ SMS С ЧЕКОМ</b>\n\n`;
  message += `<b>Заказ:</b> #${orderNumber}\n`;
  message += `<b>Телефон:</b> ${escapedPhone}\n\n`;
  message += `<b>Текст сообщения:</b>\n<code>${escapedSmsText}</code>\n\n`;
  message += `<i>Пожалуйста, отправьте сообщение клиенту вручную</i>`;
  
  const success = await sendTelegramMessage(message);
  
  if (success) {
    console.log(`[Telegram] ✅ Sent failed SMS notification for order #${orderNumber}`);
  } else {
    console.error(`[Telegram] ⚠️ Failed to send notification for order #${orderNumber}`);
  }
}
