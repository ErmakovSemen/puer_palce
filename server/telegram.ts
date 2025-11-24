import type { DbOrder } from "@shared/schema";

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

export function formatOrderNotification(order: DbOrder): string {
  const items = JSON.parse(order.items);
  
  let message = `<b>НОВЫЙ ЗАКАЗ #${order.id}</b>\n\n`;
  
  message += `<b>Клиент:</b> ${order.name}\n`;
  message += `<b>Email:</b> ${order.email}\n`;
  if (order.phone) {
    message += `<b>Телефон:</b> ${order.phone}\n`;
  }
  
  message += `\n<b>Состав заказа:</b>\n`;
  items.forEach((item: any) => {
    const itemTotal = (item.pricePerGram * item.quantity).toFixed(2);
    message += `  - ${item.name} × ${item.quantity}г - ${itemTotal}₽\n`;
  });
  
  message += `\n<b>Итого:</b> ${order.total.toFixed(2)}₽\n`;
  message += `<b>Адрес доставки:</b>\n${order.address}`;
  
  if (order.comment) {
    message += `\n\n<b>Комментарий:</b>\n${order.comment}`;
  }
  
  return message;
}

export async function sendOrderNotification(order: DbOrder): Promise<void> {
  const message = formatOrderNotification(order);
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
