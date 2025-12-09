import { db } from "../db";
import { telegramProfiles, users, siteSettings, products, magicLinks, walletTransactions, telegramCart, pendingTelegramOrders, orders, savedAddresses, type TelegramProfile, type Product } from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { getLoyaltyProgress, LOYALTY_LEVELS } from "@shared/loyalty";
import { validateAndConsumeMagicLink } from "./magicLink";
import { createHash } from "crypto";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// User state tracking for multi-step interactions
type UserState = {
  action: "awaiting_topup_amount" | "awaiting_address" | "awaiting_cart_quantity";
  expiresAt: number;
  productId?: number; // For cart quantity input
};
const userStates = new Map<string, UserState>();

function setUserState(chatId: string, state: UserState) {
  userStates.set(chatId, state);
}

function getUserState(chatId: string): UserState | undefined {
  const state = userStates.get(chatId);
  if (state && Date.now() > state.expiresAt) {
    userStates.delete(chatId);
    return undefined;
  }
  return state;
}

function clearUserState(chatId: string) {
  userStates.delete(chatId);
}

function getTeaTypeHash(teaType: string): string {
  return createHash('sha256').update(teaType).digest('base64url').slice(0, 8);
}

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

export async function sendMessage(
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
    keyboard.push([{ text: "💳 Кошелёк", callback_data: "wallet" }]);
    keyboard.push([{ text: "🛒 Корзина", callback_data: "cart" }]);
  } else {
    keyboard.push([{ text: "🔗 Привязать аккаунт", callback_data: "link_account" }]);
  }

  return { inline_keyboard: keyboard };
}

async function handleStartCommand(chatId: string, username?: string, firstName?: string, payload?: string) {
  console.log(`[TelegramBot] handleStartCommand chatId=${chatId} payload=${payload}`);
  
  if (payload && payload.startsWith("link_")) {
    const token = payload.substring(5);
    console.log(`[TelegramBot] Magic link detected, token length: ${token.length}`);
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
/profile - Ваш профиль и лояльность
/wallet - Кошелёк и пополнение

<b>Возможности:</b>
• Просмотр каталога чая
• Контактная информация
• Программа лояльности
• Кошелёк с пополнением через СБП

Для использования кошелька и программы лояльности привяжите аккаунт с сайта.`;

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

Мы специализируемся на премиальном китайском Пуэре и чайной посуде.

Выберите категорию:`;

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [{ text: "🍵 Чай", callback_data: "menu_tea" }],
      [{ text: "🫖 Посуда", callback_data: "menu_teaware" }],
      [{ text: "↩️ Главное меню", callback_data: "main_menu" }],
    ],
  };

  await sendMessage(chatId, menuText, keyboard);
}

async function handleMenuCategory(chatId: string, category: "tea" | "teaware") {
  try {
    const productList = await db
      .select()
      .from(products)
      .where(eq(products.category, category));

    if (productList.length === 0) {
      const emptyText = category === "tea" 
        ? "🍵 В данный момент чай отсутствует в наличии."
        : "🫖 В данный момент посуда отсутствует в наличии.";
      
      const keyboard: InlineKeyboardMarkup = {
        inline_keyboard: [
          [{ text: "↩️ Назад к категориям", callback_data: "menu" }],
        ],
      };
      
      await sendMessage(chatId, emptyText, keyboard);
      return;
    }

    if (category === "tea") {
      const teaTypes = Array.from(new Set(productList.map(p => p.teaType || "Другое")));
      
      const teaTypeLabels: Record<string, string> = {
        "Шу Пуэр": "🟤 Шу Пуэр",
        "Шэн Пуэр": "🟢 Шэн Пуэр", 
        "Улун": "🔵 Улун",
        "Габа": "🟡 Габа",
        "Красный чай": "🔴 Красный чай",
        "красный": "🔴 Красный чай",
        "Белый чай": "⚪ Белый чай",
        "Зеленый чай": "🟢 Зелёный чай",
        "Другое": "🍃 Другие сорта"
      };

      const buttons: InlineKeyboardButton[][] = teaTypes.map(teaType => [{
        text: teaTypeLabels[teaType] || `🍃 ${teaType}`,
        callback_data: `tth_${getTeaTypeHash(teaType)}`
      }]);

      buttons.push([{ text: "↩️ Назад к категориям", callback_data: "menu" }]);

      const keyboard: InlineKeyboardMarkup = { inline_keyboard: buttons };
      
      await sendMessage(chatId, "<b>🍵 Чай</b>\n\nВыберите тип чая:", keyboard);
    } else {
      const categoryTitle = "🫖 Посуда";
      let text = `<b>${categoryTitle}</b>\n\n`;

      const buttons: InlineKeyboardButton[][] = [];

      for (const product of productList) {
        const priceText = `${product.pricePerGram} ₽`;
        const stockStatus = product.outOfStock ? " (нет в наличии)" : "";
        
        buttons.push([{
          text: `${product.name} - ${priceText}${stockStatus}`,
          callback_data: `product_${product.id}`
        }]);
      }

      buttons.push([{ text: "↩️ Назад к категориям", callback_data: "menu" }]);

      const keyboard: InlineKeyboardMarkup = { inline_keyboard: buttons };
      
      await sendMessage(chatId, text + "Выберите товар для подробной информации:", keyboard);
    }
  } catch (error) {
    console.error("[TelegramBot] Menu category error:", error);
    await sendMessage(chatId, "Произошла ошибка. Попробуйте позже.");
  }
}

async function handleTeaTypeProductsByHash(chatId: string, hash: string) {
  try {
    const productList = await db
      .select()
      .from(products)
      .where(eq(products.category, "tea"));

    const teaTypesWithHashes = Array.from(new Set(productList.map(p => p.teaType || "Другое")))
      .map(teaType => ({ teaType, hash: getTeaTypeHash(teaType) }));
    
    const match = teaTypesWithHashes.find(t => t.hash === hash);
    
    if (!match) {
      await sendMessage(chatId, "Категория не найдена.");
      return;
    }
    
    const teaType = match.teaType;
    const filteredProducts = productList.filter(p => (p.teaType || "Другое") === teaType);

    if (filteredProducts.length === 0) {
      const keyboard: InlineKeyboardMarkup = {
        inline_keyboard: [
          [{ text: "↩️ Назад к типам чая", callback_data: "menu_tea" }],
        ],
      };
      
      await sendMessage(chatId, "В этой категории пока нет товаров.", keyboard);
      return;
    }

    const buttons: InlineKeyboardButton[][] = [];

    for (const product of filteredProducts) {
      const priceText = `${product.pricePerGram} ₽/г`;
      const stockStatus = product.outOfStock ? " (нет)" : "";
      
      buttons.push([{
        text: `${product.name} - ${priceText}${stockStatus}`,
        callback_data: `product_${product.id}`
      }]);
    }

    buttons.push([{ text: "↩️ Назад к типам чая", callback_data: "menu_tea" }]);

    const keyboard: InlineKeyboardMarkup = { inline_keyboard: buttons };
    
    await sendMessage(chatId, `<b>🍵 ${teaType}</b>\n\nВыберите чай:`, keyboard);
  } catch (error) {
    console.error("[TelegramBot] Tea type products error:", error);
    await sendMessage(chatId, "Произошла ошибка. Попробуйте позже.");
  }
}

// ============ CART FUNCTIONS ============

async function getCartItems(userId: string) {
  const items = await db
    .select({
      cartId: telegramCart.id,
      productId: telegramCart.productId,
      quantity: telegramCart.quantity,
      product: products,
    })
    .from(telegramCart)
    .innerJoin(products, eq(telegramCart.productId, products.id))
    .where(eq(telegramCart.userId, userId))
    .orderBy(desc(telegramCart.createdAt));
  
  return items;
}

async function addToCart(userId: string, productId: number, quantity: number) {
  // Check if item already in cart
  const existing = await db
    .select()
    .from(telegramCart)
    .where(and(
      eq(telegramCart.userId, userId),
      eq(telegramCart.productId, productId)
    ));

  if (existing.length > 0) {
    // Update quantity
    await db
      .update(telegramCart)
      .set({ 
        quantity: existing[0].quantity + quantity,
        updatedAt: new Date().toISOString()
      })
      .where(eq(telegramCart.id, existing[0].id));
  } else {
    // Insert new item
    await db.insert(telegramCart).values({
      userId,
      productId,
      quantity,
    });
  }
}

async function removeFromCart(cartId: number) {
  await db.delete(telegramCart).where(eq(telegramCart.id, cartId));
}

async function clearCart(userId: string) {
  await db.delete(telegramCart).where(eq(telegramCart.userId, userId));
}

async function getCartTotal(userId: string): Promise<{ subtotal: number; itemCount: number }> {
  const items = await getCartItems(userId);
  let subtotal = 0;
  let itemCount = 0;
  
  for (const item of items) {
    const price = item.product.pricePerGram * item.quantity;
    subtotal += price;
    itemCount += item.product.category === "tea" ? 1 : item.quantity;
  }
  
  return { subtotal: subtotal * 100, itemCount }; // Return in kopecks
}

async function handleAddToCart(chatId: string, productId: number, quantity: number, username?: string, firstName?: string) {
  const profile = await getOrCreateProfile(chatId, username, firstName);
  if (!profile) {
    await sendMessage(chatId, "Произошла ошибка. Попробуйте позже.");
    return;
  }

  const user = await getLinkedUser(profile);
  if (!user) {
    await sendMessage(chatId, "❌ Для использования корзины привяжите аккаунт с сайта.");
    return;
  }

  // Get product info
  const [product] = await db.select().from(products).where(eq(products.id, productId));
  if (!product) {
    await sendMessage(chatId, "Товар не найден.");
    return;
  }

  if (product.outOfStock) {
    await sendMessage(chatId, "❌ Этот товар сейчас не в наличии.");
    return;
  }

  await addToCart(user.id, productId, quantity);

  const { itemCount } = await getCartTotal(user.id);
  const unitText = product.category === "tea" ? "г" : "шт.";

  await sendMessage(chatId, `✅ <b>${product.name}</b> (${quantity} ${unitText}) добавлен в корзину!\n\nВ корзине товаров: ${itemCount}`, {
    inline_keyboard: [
      [{ text: "🛒 Перейти в корзину", callback_data: "cart" }],
      [{ text: "📦 Продолжить покупки", callback_data: "menu" }],
    ],
  });
}

async function handleRemoveFromCart(chatId: string, cartId: number, username?: string, firstName?: string) {
  const profile = await getOrCreateProfile(chatId, username, firstName);
  if (!profile) {
    await sendMessage(chatId, "Произошла ошибка. Попробуйте позже.");
    return;
  }

  const user = await getLinkedUser(profile);
  if (!user) {
    await sendMessage(chatId, "❌ Для использования корзины привяжите аккаунт с сайта.");
    return;
  }

  await removeFromCart(cartId);
  
  // Show updated cart
  await handleCartCommand(chatId, username, firstName);
}

async function handleCartCommand(chatId: string, username?: string, firstName?: string) {
  const profile = await getOrCreateProfile(chatId, username, firstName);
  if (!profile) {
    await sendMessage(chatId, "Произошла ошибка. Попробуйте позже.");
    return;
  }

  const user = await getLinkedUser(profile);
  if (!user) {
    await sendMessage(chatId, `<b>🛒 Корзина</b>

Для использования корзины привяжите ваш аккаунт с сайта.`, {
      inline_keyboard: [
        [{ text: "🌐 Перейти на сайт", url: "https://puerpub.replit.app" }],
        [{ text: "↩️ Главное меню", callback_data: "main_menu" }],
      ],
    });
    return;
  }

  const items = await getCartItems(user.id);

  if (items.length === 0) {
    await sendMessage(chatId, `<b>🛒 Корзина пуста</b>

Добавьте товары из каталога.`, {
      inline_keyboard: [
        [{ text: "🍵 Меню чая", callback_data: "menu" }],
        [{ text: "↩️ Главное меню", callback_data: "main_menu" }],
      ],
    });
    return;
  }

  let cartText = `<b>🛒 Ваша корзина</b>\n\n`;
  let total = 0;

  const buttons: InlineKeyboardButton[][] = [];

  for (const item of items) {
    const isTea = item.product.category === "tea";
    const unitText = isTea ? "г" : "шт.";
    const price = item.product.pricePerGram * item.quantity;
    total += price;

    cartText += `• <b>${item.product.name}</b>\n`;
    cartText += `  ${item.quantity} ${unitText} × ${item.product.pricePerGram} ₽ = ${price.toLocaleString("ru-RU")} ₽\n\n`;

    // Add remove button for each item
    buttons.push([
      { text: `❌ Удалить ${item.product.name.substring(0, 20)}`, callback_data: `removecart_${item.cartId}` },
    ]);
  }

  cartText += `━━━━━━━━━━━━━━━━━━━━\n`;
  cartText += `💰 <b>Итого: ${total.toLocaleString("ru-RU")} ₽</b>`;

  // Check for discounts
  const hasFirstOrderDiscount = !user.firstOrderDiscountUsed;
  const loyaltyProgress = getLoyaltyProgress(user.xp);
  const loyaltyDiscount = loyaltyProgress.currentLevel.discount;
  
  if (hasFirstOrderDiscount) {
    const discountAmount = Math.round(total * 0.2);
    cartText += `\n🎁 <i>Скидка первого заказа -20%: -${discountAmount.toLocaleString("ru-RU")} ₽</i>`;
    cartText += `\n<b>К оплате: ${(total - discountAmount).toLocaleString("ru-RU")} ₽</b>`;
  } else if (loyaltyDiscount > 0) {
    const discountAmount = Math.round(total * loyaltyDiscount / 100);
    cartText += `\n⭐ <i>Скидка лояльности ${loyaltyDiscount}%: -${discountAmount.toLocaleString("ru-RU")} ₽</i>`;
    cartText += `\n<b>К оплате: ${(total - discountAmount).toLocaleString("ru-RU")} ₽</b>`;
  }

  buttons.push([{ text: "🗑 Очистить корзину", callback_data: "clear_cart" }]);
  buttons.push([{ text: "✅ Оформить заказ", callback_data: "checkout" }]);
  buttons.push([{ text: "📦 Продолжить покупки", callback_data: "menu" }]);
  buttons.push([{ text: "↩️ Главное меню", callback_data: "main_menu" }]);

  await sendMessage(chatId, cartText, { inline_keyboard: buttons });
}

async function handleClearCart(chatId: string, username?: string, firstName?: string) {
  const profile = await getOrCreateProfile(chatId, username, firstName);
  if (!profile) {
    await sendMessage(chatId, "Произошла ошибка. Попробуйте позже.");
    return;
  }

  const user = await getLinkedUser(profile);
  if (!user) {
    await sendMessage(chatId, "❌ Для использования корзины привяжите аккаунт с сайта.");
    return;
  }

  await clearCart(user.id);
  
  await sendMessage(chatId, "🗑 Корзина очищена.", {
    inline_keyboard: [
      [{ text: "🍵 Меню чая", callback_data: "menu" }],
      [{ text: "↩️ Главное меню", callback_data: "main_menu" }],
    ],
  });
}

async function handleCheckoutStart(chatId: string, username?: string, firstName?: string) {
  const profile = await getOrCreateProfile(chatId, username, firstName);
  if (!profile) {
    await sendMessage(chatId, "Произошла ошибка. Попробуйте позже.");
    return;
  }

  const user = await getLinkedUser(profile);
  if (!user) {
    await sendMessage(chatId, "❌ Для оформления заказа привяжите аккаунт с сайта.");
    return;
  }

  const items = await getCartItems(user.id);
  if (items.length === 0) {
    await sendMessage(chatId, "❌ Корзина пуста. Добавьте товары для оформления заказа.", {
      inline_keyboard: [
        [{ text: "🍵 Меню чая", callback_data: "menu" }],
      ],
    });
    return;
  }

  // Check if user has a saved address
  const userAddresses = await db
    .select()
    .from(savedAddresses)
    .where(eq(savedAddresses.userId, user.id))
    .limit(1);

  if (userAddresses.length > 0) {
    // Offer to use saved address
    const addr = userAddresses[0];
    await sendMessage(chatId, `<b>📦 Оформление заказа</b>

Использовать сохранённый адрес?

<i>${addr.address}</i>`, {
      inline_keyboard: [
        [{ text: "✅ Да, использовать этот адрес", callback_data: `use_address_${addr.id}` }],
        [{ text: "✏️ Ввести другой адрес", callback_data: "enter_address" }],
        [{ text: "↩️ Назад к корзине", callback_data: "cart" }],
      ],
    });
  } else {
    // Ask for address
    setUserState(chatId, {
      action: "awaiting_address",
      expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
    });

    await sendMessage(chatId, `<b>📦 Оформление заказа</b>

Введите адрес доставки:

<i>Укажите город, улицу, дом, квартиру</i>`, {
      inline_keyboard: [
        [{ text: "❌ Отмена", callback_data: "cart" }],
      ],
    });
  }
}

async function handleAddressInput(chatId: string, address: string, username?: string, firstName?: string) {
  clearUserState(chatId);

  if (address.length < 10) {
    await sendMessage(chatId, "❌ Адрес слишком короткий. Введите полный адрес доставки:", {
      inline_keyboard: [[{ text: "❌ Отмена", callback_data: "cart" }]],
    });
    setUserState(chatId, {
      action: "awaiting_address",
      expiresAt: Date.now() + 15 * 60 * 1000,
    });
    return;
  }

  await processCheckout(chatId, address, username, firstName);
}

async function handleUseAddress(chatId: string, addressId: number, username?: string, firstName?: string) {
  const profile = await getOrCreateProfile(chatId, username, firstName);
  if (!profile) {
    await sendMessage(chatId, "Произошла ошибка. Попробуйте позже.");
    return;
  }

  const user = await getLinkedUser(profile);
  if (!user) {
    await sendMessage(chatId, "❌ Для оформления заказа привяжите аккаунт с сайта.");
    return;
  }

  const [addr] = await db
    .select()
    .from(savedAddresses)
    .where(and(eq(savedAddresses.id, addressId), eq(savedAddresses.userId, user.id)));

  if (!addr) {
    await sendMessage(chatId, "❌ Адрес не найден. Введите адрес вручную:", {
      inline_keyboard: [[{ text: "❌ Отмена", callback_data: "cart" }]],
    });
    setUserState(chatId, {
      action: "awaiting_address",
      expiresAt: Date.now() + 15 * 60 * 1000,
    });
    return;
  }

  await processCheckout(chatId, addr.address, username, firstName);
}

async function processCheckout(chatId: string, address: string, username?: string, firstName?: string) {
  const profile = await getOrCreateProfile(chatId, username, firstName);
  if (!profile) {
    await sendMessage(chatId, "Произошла ошибка. Попробуйте позже.");
    return;
  }

  const user = await getLinkedUser(profile);
  if (!user) {
    await sendMessage(chatId, "❌ Для оформления заказа привяжите аккаунт с сайта.");
    return;
  }

  const items = await getCartItems(user.id);
  if (items.length === 0) {
    await sendMessage(chatId, "❌ Корзина пуста.");
    return;
  }

  // Calculate totals
  let subtotal = 0;
  const orderItems: Array<{ id: number; name: string; pricePerGram: number; quantity: number }> = [];

  for (const item of items) {
    const price = item.product.pricePerGram * item.quantity;
    subtotal += price;
    orderItems.push({
      id: item.product.id,
      name: item.product.name,
      pricePerGram: item.product.pricePerGram,
      quantity: item.quantity,
    });
  }

  // Calculate discount
  const hasFirstOrderDiscount = !user.firstOrderDiscountUsed;
  const loyaltyProgress = getLoyaltyProgress(user.xp);
  const loyaltyDiscount = loyaltyProgress.currentLevel.discount;

  let discountPercent = 0;
  let discountType: string | null = null;

  if (hasFirstOrderDiscount) {
    discountPercent = 20;
    discountType = "first_order";
  } else if (loyaltyDiscount > 0) {
    discountPercent = loyaltyDiscount;
    discountType = "loyalty";
  }

  const discountAmount = Math.round(subtotal * discountPercent / 100);
  const total = Math.max(subtotal - discountAmount, 0); // Prevent negative total
  const totalKopecks = total * 100;

  // Validate minimum order amount (at least 100 rubles)
  if (total < 100) {
    await sendMessage(chatId, "❌ Минимальная сумма заказа — 100 ₽. Добавьте больше товаров.", {
      inline_keyboard: [
        [{ text: "🍵 Меню чая", callback_data: "menu" }],
        [{ text: "↩️ Корзина", callback_data: "cart" }],
      ],
    });
    return;
  }

  // Create pending order
  const orderId = `T_${user.id.substring(0, 8)}_${Date.now()}`;

  await db.insert(pendingTelegramOrders).values({
    orderId,
    userId: user.id,
    chatId,
    name: user.name || "Покупатель",
    phone: user.phone,
    address,
    items: JSON.stringify(orderItems),
    subtotal: subtotal * 100,
    discount: discountAmount * 100,
    total: totalKopecks,
    discountType,
  });

  // Create Tinkoff payment
  try {
    const { getTinkoffClient } = await import("../tinkoff");
    const tinkoffClient = getTinkoffClient();

    let phoneForReceipt = user.phone.replace(/[^0-9+]/g, '');
    if (phoneForReceipt.startsWith('+')) {
      phoneForReceipt = phoneForReceipt.substring(1);
    }
    if (phoneForReceipt.startsWith('8') && phoneForReceipt.length === 11) {
      phoneForReceipt = '7' + phoneForReceipt.substring(1);
    }

    const baseUrl = 'https://puerpub.replit.app';

    // Build receipt items
    const receiptItems = orderItems.map(item => ({
      Name: item.name.substring(0, 64),
      Price: Math.round(item.pricePerGram * item.quantity * 100 * (100 - discountPercent) / 100),
      Quantity: 1,
      Amount: Math.round(item.pricePerGram * item.quantity * 100 * (100 - discountPercent) / 100),
      Tax: "none",
      PaymentMethod: "full_prepayment",
      PaymentObject: "commodity",
    }));

    const paymentRequest = {
      Amount: totalKopecks,
      OrderId: orderId,
      Description: `Заказ чая через Telegram`,
      DATA: {
        Phone: phoneForReceipt,
      },
      Receipt: {
        Phone: phoneForReceipt,
        Taxation: "usn_income",
        Items: receiptItems,
      },
      NotificationURL: `${baseUrl}/api/payments/notification`,
      SuccessURL: `${baseUrl}/order/success`,
      FailURL: `${baseUrl}/order/error`,
    };

    console.log("[Telegram Checkout] Creating payment:", orderId, "Total:", total);

    const paymentResponse = await tinkoffClient.init(paymentRequest);

    console.log("[Telegram Checkout] Payment created, URL:", paymentResponse.PaymentURL);

    let summaryText = `<b>📦 Подтверждение заказа</b>\n\n`;
    summaryText += `📍 Адрес: ${address}\n\n`;
    
    for (const item of orderItems) {
      const isTea = items.find(i => i.product.id === item.id)?.product.category === "tea";
      const unitText = isTea ? "г" : "шт.";
      const price = item.pricePerGram * item.quantity;
      summaryText += `• ${item.name}: ${item.quantity} ${unitText} — ${price.toLocaleString("ru-RU")} ₽\n`;
    }

    summaryText += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    summaryText += `Сумма: ${subtotal.toLocaleString("ru-RU")} ₽\n`;
    
    if (discountAmount > 0) {
      const discountLabel = discountType === "first_order" ? "Скидка первого заказа" : "Скидка лояльности";
      summaryText += `${discountLabel} (${discountPercent}%): -${discountAmount.toLocaleString("ru-RU")} ₽\n`;
    }
    
    summaryText += `\n<b>💰 Итого к оплате: ${total.toLocaleString("ru-RU")} ₽</b>\n\n`;
    summaryText += `Нажмите кнопку ниже для оплаты через СБП.`;

    await sendMessage(chatId, summaryText, {
      inline_keyboard: [
        [{ text: "💳 Оплатить через СБП", url: paymentResponse.PaymentURL }],
        [{ text: "↩️ Отмена", callback_data: "cart" }],
      ],
    });
  } catch (error) {
    console.error("[Telegram Checkout] Payment error:", error);
    await sendMessage(chatId, "❌ Ошибка при создании платежа. Попробуйте позже.", {
      inline_keyboard: [[{ text: "↩️ Назад к корзине", callback_data: "cart" }]],
    });
  }
}

async function handleProductDetail(chatId: string, productId: number, username?: string, firstName?: string) {
  try {
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId));

    if (!product) {
      await sendMessage(chatId, "Товар не найден.");
      return;
    }

    // Check if user is linked for cart functionality
    const profile = await getOrCreateProfile(chatId, username, firstName);
    const linkedUser = profile ? await getLinkedUser(profile) : null;

    const isTea = product.category === "tea";
    const priceText = isTea 
      ? `${product.pricePerGram} ₽/г`
      : `${product.pricePerGram} ₽`;

    let text = `<b>${product.name}</b>\n\n`;
    
    if (product.description) {
      text += `${product.description}\n\n`;
    }

    text += `💰 Цена: ${priceText}\n`;

    if (isTea && product.teaType) {
      text += `🍃 Тип: ${product.teaType}\n`;
    }

    if (product.effects && product.effects.length > 0) {
      text += `✨ Эффекты: ${product.effects.join(", ")}\n`;
    }

    if (product.outOfStock) {
      text += `\n⚠️ <b>Нет в наличии</b>`;
    }

    const categoryCallback = isTea ? "menu_tea" : "menu_teaware";
    
    const buttons: InlineKeyboardButton[][] = [];

    // Show cart button for linked users if item is in stock
    if (linkedUser && !product.outOfStock) {
      if (isTea) {
        // Tea: show preset gram amounts
        buttons.push([
          { text: "🛒 +50г", callback_data: `addcart_${product.id}_50` },
          { text: "+100г", callback_data: `addcart_${product.id}_100` },
          { text: "+200г", callback_data: `addcart_${product.id}_200` },
        ]);
      } else {
        // Teaware: add 1 piece
        buttons.push([
          { text: "🛒 Добавить в корзину", callback_data: `addcart_${product.id}_1` },
        ]);
      }
    }

    buttons.push([{ text: "🛒 Заказать на сайте", url: `https://puerpub.replit.app/product/${product.id}` }]);
    buttons.push([{ text: "↩️ Назад к списку", callback_data: categoryCallback }]);
    buttons.push([{ text: "🏠 Главное меню", callback_data: "main_menu" }]);

    const keyboard: InlineKeyboardMarkup = { inline_keyboard: buttons };

    await sendMessage(chatId, text, keyboard);
  } catch (error) {
    console.error("[TelegramBot] Product detail error:", error);
    await sendMessage(chatId, "Произошла ошибка. Попробуйте позже.");
  }
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
  
  profileText += `<b>🏆 Программа лояльности</b>\n`;
  profileText += `━━━━━━━━━━━━━━━━━━━━\n`;
  profileText += `Уровень: <b>${progress.currentLevel.name}</b>\n`;
  profileText += `💎 XP: ${user.xp.toLocaleString("ru-RU")}\n`;
  profileText += `🎁 Ваша скидка: <b>${progress.currentLevel.discount}%</b>\n`;

  if (progress.nextLevel) {
    const progressPercent = Math.min(100, Math.round((1 - progress.xpToNextLevel / (progress.nextLevel.minXP - progress.currentLevel.minXP)) * 100));
    const filledBars = Math.round(progressPercent / 10);
    const emptyBars = 10 - filledBars;
    const progressBar = "▓".repeat(filledBars) + "░".repeat(emptyBars);
    
    profileText += `\n📈 <b>Прогресс до "${progress.nextLevel.name}"</b>\n`;
    profileText += `${progressBar} ${progressPercent}%\n`;
    profileText += `Осталось: ${progress.xpToNextLevel.toLocaleString("ru-RU")} XP\n`;
    profileText += `Скидка на следующем уровне: ${progress.nextLevel.discount}%`;
  } else {
    profileText += `\n🎉 <b>Максимальный уровень достигнут!</b>`;
  }

  profileText += `\n\n<b>📊 Все уровни программы</b>\n`;
  profileText += `━━━━━━━━━━━━━━━━━━━━\n`;
  
  const levelIcons = ["🥉", "🥈", "🥇", "👑"];
  LOYALTY_LEVELS.forEach((level, index) => {
    const isCurrentLevel = level.level === progress.currentLevel.level;
    const marker = isCurrentLevel ? "➤ " : "   ";
    const xpRange = level.maxXP 
      ? `${level.minXP.toLocaleString("ru-RU")} - ${level.maxXP.toLocaleString("ru-RU")} XP`
      : `от ${level.minXP.toLocaleString("ru-RU")} XP`;
    
    profileText += `${marker}${levelIcons[index]} <b>${level.name}</b>\n`;
    profileText += `      ${xpRange} • Скидка ${level.discount}%\n`;
  });

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [{ text: "🛒 Мои заказы", url: "https://puerpub.replit.app/profile" }],
      [{ text: "↩️ Главное меню", callback_data: "main_menu" }],
    ],
  };

  await sendMessage(chatId, profileText, keyboard);
}

async function handleLinkAccountCallback(chatId: string) {
  const linkText = `<b>🔗 Привязка аккаунта</b>

Для привязки Telegram к вашему аккаунту:

1. Войдите на сайт puerpub.replit.app
2. Перейдите в "Мой профиль"
3. Нажмите "Привязать Telegram"
4. Скопируйте код и отправьте его сюда

<i>Пример: LINK A1B2C3D4</i>

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

async function handleLinkCodeMessage(chatId: string, code: string, username?: string, firstName?: string) {
  console.log(`[TelegramBot] Processing link code: ${code}`);
  
  // User sends full token: LINK <full_token>
  const result = await validateAndConsumeMagicLink(code, chatId);

  if (!result.success) {
    await sendMessage(
      chatId,
      `❌ <b>Ошибка привязки</b>\n\n${result.error}\n\nПопробуйте получить новый код на сайте.`
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

async function handleWalletCommand(chatId: string, username?: string, firstName?: string) {
  const profile = await getOrCreateProfile(chatId, username, firstName);
  if (!profile) {
    await sendMessage(chatId, "Произошла ошибка. Попробуйте позже.");
    return;
  }

  const user = await getLinkedUser(profile);

  if (!user) {
    const linkText = `<b>💳 Кошелёк</b>

Для использования кошелька привяжите ваш аккаунт с сайта.

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

  // Get wallet balance (convert from kopecks to rubles)
  const balanceRub = Math.floor((user.walletBalance || 0) / 100);
  const balanceKop = (user.walletBalance || 0) % 100;
  const balanceFormatted = balanceKop > 0 
    ? `${balanceRub.toLocaleString("ru-RU")},${balanceKop.toString().padStart(2, '0')}` 
    : balanceRub.toLocaleString("ru-RU");

  let walletText = `<b>💳 Ваш кошелёк</b>\n\n`;
  walletText += `💰 <b>Баланс: ${balanceFormatted} ₽</b>\n`;
  walletText += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  walletText += `Пополните кошелёк для оплаты заказов.\n`;
  walletText += `Оплата через СБП (Система быстрых платежей).`;

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        { text: "500 ₽", callback_data: "topup_500" },
        { text: "1000 ₽", callback_data: "topup_1000" },
      ],
      [
        { text: "2000 ₽", callback_data: "topup_2000" },
        { text: "5000 ₽", callback_data: "topup_5000" },
      ],
      [{ text: "✏️ Своя сумма", callback_data: "custom_topup" }],
      [{ text: "📜 История операций", callback_data: "wallet_history" }],
      [{ text: "↩️ Главное меню", callback_data: "main_menu" }],
    ],
  };

  await sendMessage(chatId, walletText, keyboard);
}

async function handleWalletTopup(chatId: string, amount: number, username?: string, firstName?: string): Promise<boolean> {
  const profile = await getOrCreateProfile(chatId, username, firstName);
  if (!profile) {
    await sendMessage(chatId, "Произошла ошибка. Попробуйте позже.");
    return false;
  }

  const user = await getLinkedUser(profile);

  if (!user) {
    await sendMessage(chatId, "❌ Для пополнения кошелька привяжите аккаунт с сайта.");
    return false;
  }

  // Create top-up payment via internal API
  const walletOrderId = `W_${Date.now()}_${user.id.substring(0, 8)}_${amount}`;
  const amountKopecks = amount * 100;

  try {
    const { getTinkoffClient } = await import("../tinkoff");
    const tinkoffClient = getTinkoffClient();
    
    // Normalize phone for receipt
    let phoneForReceipt = user.phone.replace(/[^0-9+]/g, '');
    if (phoneForReceipt.startsWith('+')) {
      phoneForReceipt = phoneForReceipt.substring(1);
    }
    if (phoneForReceipt.startsWith('8') && phoneForReceipt.length === 11) {
      phoneForReceipt = '7' + phoneForReceipt.substring(1);
    }

    const baseUrl = 'https://puerpub.replit.app';

    const paymentRequest = {
      Amount: amountKopecks,
      OrderId: walletOrderId,
      Description: `Пополнение кошелька на ${amount}₽`,
      DATA: {
        Phone: phoneForReceipt,
      },
      Receipt: {
        Phone: phoneForReceipt,
        Taxation: "usn_income",
        Items: [{
          Name: `Пополнение кошелька на ${amount}₽`,
          Price: amountKopecks,
          Quantity: 1,
          Amount: amountKopecks,
          Tax: "none",
          PaymentMethod: "full_prepayment",
          PaymentObject: "service",
        }],
      },
      NotificationURL: `${baseUrl}/api/payments/notification`,
      SuccessURL: `${baseUrl}/wallet/success?amount=${amount}`,
      FailURL: `${baseUrl}/wallet/error`,
    };

    console.log("[Wallet Bot] Creating top-up payment:", walletOrderId, "Amount:", amount);

    const paymentResponse = await tinkoffClient.init(paymentRequest);

    console.log("[Wallet Bot] Payment created, URL:", paymentResponse.PaymentURL);

    const topupText = `<b>💳 Пополнение кошелька</b>

Сумма: <b>${amount} ₽</b>

Нажмите кнопку ниже для оплаты через СБП.
После успешной оплаты средства будут зачислены автоматически.`;

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [{ text: "💳 Оплатить через СБП", url: paymentResponse.PaymentURL }],
        [{ text: "↩️ Назад к кошельку", callback_data: "wallet" }],
      ],
    };

    await sendMessage(chatId, topupText, keyboard);
    return true;
  } catch (error) {
    console.error("[Wallet Bot] Top-up error:", error);
    // Re-send prompt so user can retry without navigating
    await sendMessage(chatId, `❌ Ошибка при создании платежа.

<b>Введите другую сумму (от 10 до 100000 ₽):</b>`, {
      inline_keyboard: [[{ text: "❌ Отмена", callback_data: "wallet" }]],
    });
    return false;
  }
}

async function handleWalletHistory(chatId: string, username?: string, firstName?: string) {
  const profile = await getOrCreateProfile(chatId, username, firstName);
  if (!profile) {
    await sendMessage(chatId, "Произошла ошибка. Попробуйте позже.");
    return;
  }

  const user = await getLinkedUser(profile);

  if (!user) {
    await sendMessage(chatId, "❌ Для просмотра истории привяжите аккаунт с сайта.");
    return;
  }

  // Get recent transactions
  const transactions = await db
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.userId, user.id))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(10);

  let historyText = `<b>📜 История операций</b>\n\n`;

  if (transactions.length === 0) {
    historyText += `<i>Операций пока нет</i>`;
  } else {
    transactions.forEach((tx) => {
      const amountRub = Math.abs(tx.amount) / 100;
      const sign = tx.amount > 0 ? "+" : "-";
      const icon = tx.type === "topup" ? "💰" : tx.type === "purchase" ? "🛒" : "↩️";
      const date = new Date(tx.createdAt).toLocaleDateString("ru-RU");
      
      historyText += `${icon} ${sign}${amountRub.toLocaleString("ru-RU")} ₽\n`;
      historyText += `   <i>${tx.description}</i>\n`;
      historyText += `   ${date}\n\n`;
    });
  }

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [{ text: "↩️ Назад к кошельку", callback_data: "wallet" }],
    ],
  };

  await sendMessage(chatId, historyText, keyboard);
}

async function handleCustomTopupRequest(chatId: string, username?: string, firstName?: string) {
  const profile = await getOrCreateProfile(chatId, username, firstName);
  if (!profile) {
    await sendMessage(chatId, "Произошла ошибка. Попробуйте позже.");
    return;
  }

  const user = await getLinkedUser(profile);

  if (!user) {
    await sendMessage(chatId, "❌ Для пополнения кошелька привяжите аккаунт с сайта.");
    return;
  }

  // Set user state to awaiting amount input (expires in 5 minutes)
  setUserState(chatId, {
    action: "awaiting_topup_amount",
    expiresAt: Date.now() + 5 * 60 * 1000,
  });

  const promptText = `<b>✏️ Введите сумму пополнения</b>

Отправьте сообщение с суммой в рублях (от 10 до 100000).

Например: <code>750</code>`;

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [{ text: "❌ Отмена", callback_data: "wallet" }],
    ],
  };

  await sendMessage(chatId, promptText, keyboard);
}

async function handleCustomTopupAmount(chatId: string, amountText: string, username?: string, firstName?: string) {
  // Remove spaces and parse - only allow digits
  const cleanedText = amountText.replace(/\s/g, "");
  
  // Reject if contains non-digit characters
  if (!/^\d+$/.test(cleanedText)) {
    await sendMessage(chatId, "❌ Введите только число (сумму в рублях).\n\nНапример: <code>750</code>", {
      inline_keyboard: [[{ text: "❌ Отмена", callback_data: "wallet" }]],
    });
    return; // Keep state active for retry
  }

  const amount = parseInt(cleanedText, 10);

  if (amount < 10) {
    await sendMessage(chatId, "❌ Минимальная сумма — 10 ₽. Введите другое число:", {
      inline_keyboard: [[{ text: "❌ Отмена", callback_data: "wallet" }]],
    });
    return; // Keep state active for retry
  }

  if (amount > 100000) {
    await sendMessage(chatId, "❌ Максимальная сумма — 100 000 ₽. Введите другое число:", {
      inline_keyboard: [[{ text: "❌ Отмена", callback_data: "wallet" }]],
    });
    return; // Keep state active for retry
  }

  // Process the top-up with validated amount
  const success = await handleWalletTopup(chatId, amount, username, firstName);
  
  // Only clear state after successful payment creation
  if (success) {
    clearUserState(chatId);
  }
  // On failure, state remains active so user can try another amount or cancel via button
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

  // Handle product detail callbacks
  if (data.startsWith("product_")) {
    const productId = parseInt(data.substring(8), 10);
    if (!isNaN(productId)) {
      await handleProductDetail(chatId, productId, username, firstName);
      return;
    }
  }

  // Handle add to cart callbacks (addcart_productId_quantity)
  if (data.startsWith("addcart_")) {
    const parts = data.split("_");
    if (parts.length >= 3) {
      const productId = parseInt(parts[1], 10);
      const quantity = parseInt(parts[2], 10);
      if (!isNaN(productId) && !isNaN(quantity)) {
        await handleAddToCart(chatId, productId, quantity, username, firstName);
        return;
      }
    }
  }

  // Handle remove from cart callbacks (removecart_cartId)
  if (data.startsWith("removecart_")) {
    const cartId = parseInt(data.substring(11), 10);
    if (!isNaN(cartId)) {
      await handleRemoveFromCart(chatId, cartId, username, firstName);
      return;
    }
  }

  // Handle tea type callbacks (format: tth_hash - uses SHA256 hash of tea type)
  if (data.startsWith("tth_")) {
    const hash = data.substring(4);
    await handleTeaTypeProductsByHash(chatId, hash);
    return;
  }

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
    case "menu_tea":
      await handleMenuCategory(chatId, "tea");
      break;
    case "menu_teaware":
      await handleMenuCategory(chatId, "teaware");
      break;
    case "profile":
      await handleProfileCommand(chatId, username, firstName);
      break;
    case "link_account":
      await handleLinkAccountCallback(chatId);
      break;
    case "wallet":
      clearUserState(chatId); // Clear any pending state (e.g., awaiting amount input)
      await handleWalletCommand(chatId, username, firstName);
      break;
    case "wallet_history":
      await handleWalletHistory(chatId, username, firstName);
      break;
    case "topup_500":
      await handleWalletTopup(chatId, 500, username, firstName);
      break;
    case "topup_1000":
      await handleWalletTopup(chatId, 1000, username, firstName);
      break;
    case "topup_2000":
      await handleWalletTopup(chatId, 2000, username, firstName);
      break;
    case "topup_5000":
      await handleWalletTopup(chatId, 5000, username, firstName);
      break;
    case "custom_topup":
      await handleCustomTopupRequest(chatId, username, firstName);
      break;
    case "cart":
      await handleCartCommand(chatId, username, firstName);
      break;
    case "clear_cart":
      await handleClearCart(chatId, username, firstName);
      break;
    case "checkout":
      await handleCheckoutStart(chatId, username, firstName);
      break;
    case "enter_address":
      setUserState(chatId, {
        action: "awaiting_address",
        expiresAt: Date.now() + 15 * 60 * 1000,
      });
      await sendMessage(chatId, `<b>📦 Введите адрес доставки:</b>

<i>Укажите город, улицу, дом, квартиру</i>`, {
        inline_keyboard: [[{ text: "❌ Отмена", callback_data: "cart" }]],
      });
      break;
    default:
      // Handle use_address_ID callbacks
      if (data.startsWith("use_address_")) {
        const addressId = parseInt(data.substring(12), 10);
        if (!isNaN(addressId)) {
          await handleUseAddress(chatId, addressId, username, firstName);
          return;
        }
      }
      console.log("[TelegramBot] Unknown callback:", data);
  }
}

export async function handleWebhookUpdate(update: TelegramUpdate): Promise<void> {
  console.log("[TelegramBot] Received update:", update.update_id);
  console.log("[TelegramBot] Full update:", JSON.stringify(update, null, 2));

  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
    return;
  }

  if (!update.message?.text) return;

  const chatId = update.message.chat.id.toString();
  const text = update.message.text.trim();
  const username = update.message.from?.username;
  const firstName = update.message.from?.first_name;

  console.log(`[TelegramBot] Message text: "${text}"`);
  
  const parts = text.split(" ");
  const command = parts[0].toLowerCase();
  const payload = parts.length > 1 ? parts.slice(1).join(" ") : undefined;
  
  console.log(`[TelegramBot] Parsed command: "${command}", payload: "${payload}"`);

  // Check for LINK command (case insensitive) - works with or without /
  if (text.toUpperCase().startsWith("LINK ") || text.toUpperCase().startsWith("/LINK ")) {
    const startIndex = text.toUpperCase().startsWith("/LINK ") ? 6 : 5;
    const code = text.substring(startIndex).trim();
    await handleLinkCodeMessage(chatId, code, username, firstName);
    return;
  }

  // Check if user is in a state expecting input (e.g., custom top-up amount, address)
  const userState = getUserState(chatId);
  if (userState) {
    if (userState.action === "awaiting_topup_amount") {
      // User is expected to enter a number for top-up
      await handleCustomTopupAmount(chatId, text, username, firstName);
      return;
    }
    if (userState.action === "awaiting_address") {
      // User is expected to enter delivery address
      await handleAddressInput(chatId, text, username, firstName);
      return;
    }
  }

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
    case "/wallet":
      await handleWalletCommand(chatId, username, firstName);
      break;
    case "/cart":
      await handleCartCommand(chatId, username, firstName);
      break;
    case "/link":
      // Just /link without token - show instructions
      if (!payload) {
        await handleLinkAccountCallback(chatId);
      } else {
        await handleLinkCodeMessage(chatId, payload, username, firstName);
      }
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
