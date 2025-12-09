import { db } from "../db";
import { telegramProfiles, users, siteSettings, type TelegramProfile } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getLoyaltyProgress } from "@shared/loyalty";
import { validateAndConsumeMagicLink } from "./magicLink";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  chat_instance: string;
  data?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

async function sendMessage(
  chatId: string | number,
  text: string,
  replyMarkup?: InlineKeyboardMarkup
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("[TelegramBot] Bot token not configured");
    return false;
  }

  try {
    const body: any = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    };

    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }

    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();
    if (!data.ok) {
      console.error("[TelegramBot] API error:", data);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[TelegramBot] Send error:", error);
    return false;
  }
}

async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) return false;

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text,
        }),
      }
    );

    const data = await response.json();
    return data.ok;
  } catch (error) {
    console.error("[TelegramBot] Callback answer error:", error);
    return false;
  }
}

async function getOrCreateProfile(
  chatId: string,
  username?: string,
  firstName?: string
): Promise<TelegramProfile | null> {
  try {
    const [existing] = await db
      .select()
      .from(telegramProfiles)
      .where(eq(telegramProfiles.chatId, chatId));

    if (existing) {
      await db
        .update(telegramProfiles)
        .set({
          lastSeen: new Date().toISOString(),
          username: username || existing.username,
          firstName: firstName || existing.firstName,
        })
        .where(eq(telegramProfiles.id, existing.id));

      return existing;
    }

    const [newProfile] = await db
      .insert(telegramProfiles)
      .values({
        chatId,
        username,
        firstName,
      })
      .returning();

    return newProfile;
  } catch (error) {
    console.error("[TelegramBot] Profile error:", error);
    return null;
  }
}

async function getLinkedUser(profile: TelegramProfile) {
  if (!profile.userId) return null;

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, profile.userId));
    return user || null;
  } catch (error) {
    console.error("[TelegramBot] Get user error:", error);
    return null;
  }
}

async function getSiteContactInfo() {
  try {
    const [settings] = await db.select().from(siteSettings);
    return settings || null;
  } catch (error) {
    console.error("[TelegramBot] Get settings error:", error);
    return null;
  }
}

function getMainMenuKeyboard(isLinked: boolean): InlineKeyboardMarkup {
  const keyboard: InlineKeyboardButton[][] = [
    [{ text: "📞 Контакты", callback_data: "contacts" }],
    [{ text: "🍵 Меню чая", callback_data: "menu" }],
  ];

  if (isLinked) {
    keyboard.push([{ text: "⭐ Мой профиль", callback_data: "profile" }]);
  } else {
    keyboard.push([{ text: "🔗 Привязать аккаунт", callback_data: "link_account" }]);
  }

  return { inline_keyboard: keyboard };
}

async function handleStartCommand(chatId: string, username?: string, firstName?: string, payload?: string) {
  if (payload && payload.startsWith("link_")) {
    const token = payload.substring(5);
    await handleMagicLinkConfirmation(chatId, token, username, firstName);
    return;
  }

  const profile = await getOrCreateProfile(chatId, username, firstName);
  if (!profile) {
    await sendMessage(chatId, "Произошла ошибка. Попробуйте позже.");
    return;
  }

  const user = await getLinkedUser(profile);
  const isLinked = !!user;

  let greeting = firstName ? `Привет, ${firstName}!` : "Привет!";
  
  if (isLinked) {
    const progress = getLoyaltyProgress(user.xp);
    greeting += `\n\n✅ Ваш аккаунт привязан\n⭐ Уровень: ${progress.currentLevel.name}\n💎 XP: ${user.xp}`;
  } else {
    greeting += "\n\nДобро пожаловать в Puer Pub!\n🍵 Премиальный китайский Пуэр";
  }

  greeting += "\n\nВыберите действие:";

  await sendMessage(chatId, greeting, getMainMenuKeyboard(isLinked));
}

async function handleMagicLinkConfirmation(
  chatId: string,
  token: string,
  username?: string,
  firstName?: string
) {
  const result = await validateAndConsumeMagicLink(token, chatId);

  if (!result.success) {
    await sendMessage(
      chatId,
      `❌ <b>Ошибка привязки</b>\n\n${result.error}\n\nПопробуйте получить новую ссылку на сайте.`
    );
    return;
  }

  await getOrCreateProfile(chatId, username, firstName);

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, result.userId!));

  let successMessage = `✅ <b>Аккаунт успешно привязан!</b>\n\n`;
  
  if (user) {
    const progress = getLoyaltyProgress(user.xp);
    successMessage += `👤 ${user.name || "Пользователь"}\n`;
    successMessage += `📱 ${user.phone}\n\n`;
    successMessage += `<b>Программа лояльности:</b>\n`;
    successMessage += `🏆 Уровень: ${progress.currentLevel.name}\n`;
    successMessage += `💎 XP: ${user.xp}\n`;
    successMessage += `🎁 Скидка: ${progress.currentLevel.discount}%`;
  }

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [[{ text: "🏠 Главное меню", callback_data: "main_menu" }]],
  };

  await sendMessage(chatId, successMessage, keyboard);
}

async function handleHelpCommand(chatId: string) {
  const helpText = `<b>Команды бота:</b>

/start - Главное меню
/help - Справка
/contacts - Контактная информация
/menu - Каталог чая

<b>Возможности:</b>
• Просмотр каталога чая
• Контактная информация
• Программа лояльности (после привязки аккаунта)
• Просмотр баланса и уровня

Для использования программы лояльности привяжите аккаунт с сайта.`;

  await sendMessage(chatId, helpText);
}

async function handleContactsCommand(chatId: string) {
  const settings = await getSiteContactInfo();

  let contactsText = "<b>📞 Контактная информация</b>\n\n";

  if (settings) {
    if (settings.contactPhone) {
      contactsText += `📱 Телефон: ${settings.contactPhone}\n`;
    }
    if (settings.contactEmail) {
      contactsText += `✉️ Email: ${settings.contactEmail}\n`;
    }
    if (settings.contactTelegram) {
      contactsText += `💬 Telegram: ${settings.contactTelegram}\n`;
    }
  } else {
    contactsText += "Контактная информация временно недоступна.";
  }

  contactsText += "\n🌐 Сайт: puerpub.replit.app";

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [[{ text: "↩️ Главное меню", callback_data: "main_menu" }]],
  };

  await sendMessage(chatId, contactsText, keyboard);
}

async function handleMenuCommand(chatId: string) {
  const menuText = `<b>🍵 Наш ассортимент</b>

Мы специализируемся на премиальном китайском Пуэре.

<b>Виды чая:</b>
• Шу Пуэр - выдержанный, мягкий вкус
• Шен Пуэр - свежий, цветочный аромат  
• Белый Пуэр - нежный и легкий
• И многое другое...

Посетите наш сайт для просмотра полного каталога и оформления заказа.`;

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [{ text: "🌐 Перейти на сайт", url: "https://puerpub.replit.app" }],
      [{ text: "↩️ Главное меню", callback_data: "main_menu" }],
    ],
  };

  await sendMessage(chatId, menuText, keyboard);
}

async function handleProfileCommand(chatId: string, username?: string, firstName?: string) {
  const profile = await getOrCreateProfile(chatId, username, firstName);
  if (!profile) {
    await sendMessage(chatId, "Произошла ошибка. Попробуйте позже.");
    return;
  }

  const user = await getLinkedUser(profile);

  if (!user) {
    const linkText = `<b>Аккаунт не привязан</b>

Для использования программы лояльности и просмотра заказов привяжите ваш аккаунт с сайта.

Зарегистрируйтесь или войдите на сайте, затем перейдите в настройки профиля для привязки Telegram.`;

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [{ text: "🌐 Перейти на сайт", url: "https://puerpub.replit.app" }],
        [{ text: "↩️ Главное меню", callback_data: "main_menu" }],
      ],
    };

    await sendMessage(chatId, linkText, keyboard);
    return;
  }

  const progress = getLoyaltyProgress(user.xp);

  let profileText = `<b>⭐ Ваш профиль</b>\n\n`;
  profileText += `👤 ${user.name || "Пользователь"}\n`;
  profileText += `📱 ${user.phone}\n\n`;
  profileText += `<b>Программа лояльности:</b>\n`;
  profileText += `🏆 Уровень: ${progress.currentLevel.name}\n`;
  profileText += `💎 XP: ${user.xp}\n`;
  profileText += `🎁 Скидка: ${progress.currentLevel.discount}%\n`;

  if (progress.nextLevel) {
    profileText += `\n📈 До уровня "${progress.nextLevel.name}": ${progress.xpToNextLevel} XP`;
  }

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [[{ text: "↩️ Главное меню", callback_data: "main_menu" }]],
  };

  await sendMessage(chatId, profileText, keyboard);
}

async function handleLinkAccountCallback(chatId: string) {
  const linkText = `<b>🔗 Привязка аккаунта</b>

Для привязки Telegram к вашему аккаунту:

1. Войдите на сайт puerpub.replit.app
2. Перейдите в "Мой профиль"
3. Нажмите "Привязать Telegram"
4. Следуйте инструкциям

После привязки вы сможете:
• Отслеживать баланс лояльности
• Получать уведомления о заказах
• Управлять аккаунтом через бота`;

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [{ text: "🌐 Перейти на сайт", url: "https://puerpub.replit.app" }],
      [{ text: "↩️ Главное меню", callback_data: "main_menu" }],
    ],
  };

  await sendMessage(chatId, linkText, keyboard);
}

async function handleCallbackQuery(callbackQuery: TelegramCallbackQuery) {
  const chatId = callbackQuery.message?.chat.id.toString();
  const data = callbackQuery.data;
  const username = callbackQuery.from.username;
  const firstName = callbackQuery.from.first_name;

  if (!chatId || !data) {
    await answerCallbackQuery(callbackQuery.id);
    return;
  }

  await answerCallbackQuery(callbackQuery.id);

  switch (data) {
    case "main_menu":
      await handleStartCommand(chatId, username, firstName);
      break;
    case "contacts":
      await handleContactsCommand(chatId);
      break;
    case "menu":
      await handleMenuCommand(chatId);
      break;
    case "profile":
      await handleProfileCommand(chatId, username, firstName);
      break;
    case "link_account":
      await handleLinkAccountCallback(chatId);
      break;
    default:
      console.log("[TelegramBot] Unknown callback:", data);
  }
}

export async function handleWebhookUpdate(update: TelegramUpdate): Promise<void> {
  console.log("[TelegramBot] Received update:", update.update_id);

  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
    return;
  }

  if (!update.message?.text) return;

  const chatId = update.message.chat.id.toString();
  const text = update.message.text.trim();
  const username = update.message.from?.username;
  const firstName = update.message.from?.first_name;

  const command = text.split(" ")[0].toLowerCase();

  const payload = command === "/start" ? text.substring(7).trim() : undefined;

  switch (command) {
    case "/start":
      await handleStartCommand(chatId, username, firstName, payload || undefined);
      break;
    case "/help":
      await handleHelpCommand(chatId);
      break;
    case "/contacts":
      await handleContactsCommand(chatId);
      break;
    case "/menu":
      await handleMenuCommand(chatId);
      break;
    case "/profile":
      await handleProfileCommand(chatId, username, firstName);
      break;
    default:
      if (text.startsWith("/")) {
        await sendMessage(
          chatId,
          "Неизвестная команда. Используйте /help для списка команд."
        );
      }
  }
}

export async function setWebhook(webhookUrl: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("[TelegramBot] Bot token not configured");
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl }),
      }
    );

    const data = await response.json();
    console.log("[TelegramBot] Webhook set result:", data);
    return data.ok;
  } catch (error) {
    console.error("[TelegramBot] Webhook set error:", error);
    return false;
  }
}

export async function getWebhookInfo(): Promise<any> {
  if (!TELEGRAM_BOT_TOKEN) return null;

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`
    );
    return await response.json();
  } catch (error) {
    console.error("[TelegramBot] Get webhook info error:", error);
    return null;
  }
}
