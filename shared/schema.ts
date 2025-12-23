import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, real, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").unique(),
  password: text("password").notNull(),
  name: text("name"),
  phone: text("phone").notNull().unique(),
  phoneVerified: boolean("phone_verified").notNull().default(false),
  xp: integer("xp").notNull().default(0),
  firstOrderDiscountUsed: boolean("first_order_discount_used").notNull().default(false),
  customDiscount: integer("custom_discount"), // Индивидуальная скидка в процентах (nullable)
  walletBalance: integer("wallet_balance").notNull().default(0), // Баланс кошелька в копейках
});

export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email("Введите корректный email").optional(),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
  name: z.string().min(2, "Имя должно содержать минимум 2 символа"),
  phone: z.string().min(1, "Укажите номер телефона").min(10, "Введите корректный номер телефона"),
}).pick({
  email: true,
  password: true,
  name: true,
  phone: true,
});

export const updateUserSchema = z.object({
  name: z.string().min(2, "Имя должно содержать минимум 2 символа").optional(),
  phone: z.string().min(10, "Введите корректный номер телефона").optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type User = typeof users.$inferSelect;

// Wallet Transactions table
export const walletTransactions = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // "topup" | "purchase" | "refund"
  amount: integer("amount").notNull(), // Сумма в копейках (положительная для пополнения, отрицательная для списания)
  description: text("description").notNull(),
  paymentId: text("payment_id"), // ID платежа в Tinkoff (для пополнений)
  orderId: integer("order_id"), // ID заказа (для списаний)
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertWalletTransactionSchema = createInsertSchema(walletTransactions, {
  userId: z.string(),
  type: z.enum(["topup", "purchase", "refund"]),
  amount: z.number().int(),
  description: z.string().min(1),
  paymentId: z.string().optional(),
  orderId: z.number().int().optional(),
}).omit({ id: true, createdAt: true });

export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;
export type WalletTransaction = typeof walletTransactions.$inferSelect;

// XP Transactions table (loyalty program history)
export const xpTransactions = pgTable("xp_transactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  amount: integer("amount").notNull(), // Positive for accrual, negative for deduction
  reason: text("reason").notNull(), // "online_order" | "offline_purchase" | "manual_adjustment" | "bonus"
  description: text("description").notNull(), // Human-readable description
  orderId: integer("order_id"), // Related order ID (for online orders)
  createdBy: text("created_by"), // "system" | admin user ID
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertXpTransactionSchema = createInsertSchema(xpTransactions, {
  userId: z.string(),
  amount: z.number().int(),
  reason: z.enum(["online_order", "offline_purchase", "manual_adjustment", "bonus"]),
  description: z.string().min(1),
  orderId: z.number().int().optional().nullable(),
  createdBy: z.string().optional().nullable(),
}).omit({ id: true, createdAt: true });

export type InsertXpTransaction = z.infer<typeof insertXpTransactionSchema>;
export type XpTransaction = typeof xpTransactions.$inferSelect;

// SMS Verifications table
export const smsVerifications = pgTable("sms_verifications", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(),
  code: text("code").notNull(), // hashed code
  type: text("type").notNull(), // "registration" or "password_reset"
  attempts: integer("attempts").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  expiresAt: text("expires_at").notNull(),
});

export const insertSmsVerificationSchema = createInsertSchema(smsVerifications, {
  phone: z.string().min(10, "Введите корректный номер телефона"),
  code: z.string().length(6, "Код должен содержать 6 цифр"),
  type: z.enum(["registration", "password_reset"]),
}).omit({ id: true, attempts: true, createdAt: true, expiresAt: true });

export type InsertSmsVerification = z.infer<typeof insertSmsVerificationSchema>;
export type SmsVerification = typeof smsVerifications.$inferSelect;

// Products
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull().default("tea"), // "tea" or "teaware"
  pricePerGram: real("price_per_gram").notNull(), // For teaware, this is price per piece
  description: text("description").notNull(),
  images: text("images").array().notNull().default(sql`ARRAY[]::text[]`),
  teaType: text("tea_type").notNull(),
  effects: text("effects").array().notNull().default(sql`ARRAY[]::text[]`),
  availableQuantities: text("available_quantities").array().notNull().default(sql`ARRAY['25', '50', '100']::text[]`), // Available quantities in grams
  fixedQuantityOnly: boolean("fixed_quantity_only").notNull().default(false), // If true, only sell in fixed quantity
  fixedQuantity: integer("fixed_quantity"), // Fixed quantity in grams (e.g., 357g for tea cake) or 1 for teaware
  outOfStock: boolean("out_of_stock").notNull().default(false), // If true, product is out of stock and cannot be ordered
});

export const insertProductSchema = createInsertSchema(products, {
  name: z.string().min(2, "Название должно содержать минимум 2 символа"),
  category: z.enum(["tea", "teaware"], {
    errorMap: () => ({ message: "Выберите категорию: чай или посуда" })
  }),
  pricePerGram: z.number().min(0, "Цена должна быть положительной"),
  description: z.string().min(10, "Описание должно содержать минимум 10 символов"),
  images: z.array(z.string().min(1)).min(1, "Добавьте хотя бы одно изображение"),
  teaType: z.string().min(1, "Выберите тип"),
  effects: z.array(z.string()).min(0, "Укажите эффекты или оставьте пустым"),
  availableQuantities: z.array(z.string().regex(/^\d+$/, "Количество должно быть числом")).min(1, "Добавьте хотя бы одно доступное количество"),
  fixedQuantityOnly: z.boolean(),
  fixedQuantity: z.number().int().positive().optional().nullable(),
  outOfStock: z.boolean(),
}).omit({ id: true }).refine((data) => {
  if (data.fixedQuantityOnly && !data.fixedQuantity) {
    return false;
  }
  return true;
}, {
  message: "Укажите фиксированное количество, если включен режим фиксированного количества",
  path: ["fixedQuantity"],
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// Quiz types
export interface QuizOption {
  label: string;
  value: string;
}

export interface QuizQuestion {
  id: string;
  text: string;
  options: QuizOption[];
}

export interface QuizRecommendationRule {
  conditions: string[];  // массив выбранных значений
  teaType: string;       // рекомендуемый тип чая
  priority: number;      // приоритет правила
}

export interface QuizConfig {
  questions: QuizQuestion[];
  rules: QuizRecommendationRule[];
}

export const quizQuestionSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
  options: z.array(z.object({
    label: z.string().min(1),
    value: z.string().min(1),
  })).min(2),
});

export const quizRecommendationRuleSchema = z.object({
  conditions: z.array(z.string()),
  teaType: z.string().min(1),
  priority: z.number(),
});

export const quizConfigSchema = z.object({
  questions: z.array(quizQuestionSchema),
  rules: z.array(quizRecommendationRuleSchema),
});

export type InsertQuizQuestion = z.infer<typeof quizQuestionSchema>;
export type InsertQuizRecommendationRule = z.infer<typeof quizRecommendationRuleSchema>;
export type InsertQuizConfig = z.infer<typeof quizConfigSchema>;

// Tea Types table for managing tea categories with custom colors
export const teaTypes = pgTable("tea_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  backgroundColor: text("background_color").notNull(), // Hex color for badge background
  textColor: text("text_color").notNull(), // Hex color for badge text
});

export const insertTeaTypeSchema = createInsertSchema(teaTypes, {
  name: z.string().min(2, "Название должно содержать минимум 2 символа"),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Введите корректный hex-цвет (например, #8B4513)"),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Введите корректный hex-цвет (например, #FFFFFF)"),
}).omit({ id: true });

export type InsertTeaType = z.infer<typeof insertTeaTypeSchema>;
export type TeaType = typeof teaTypes.$inferSelect;

// Site settings
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  designMode: text("design_mode").notNull().default("classic"), // "classic" or "minimalist"
});

export const updateSettingsSchema = z.object({
  designMode: z.enum(["classic", "minimalist"]),
});

export type Settings = typeof settings.$inferSelect;
export type UpdateSettings = z.infer<typeof updateSettingsSchema>;

// Orders table
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }), // nullable - for guest orders
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  comment: text("comment"),
  items: text("items").notNull(), // JSON string of order items
  total: real("total").notNull(),
  status: text("status").notNull().default("pending"), // pending, paid, cancelled, completed
  usedFirstOrderDiscount: boolean("used_first_order_discount").notNull().default(false),
  paymentId: text("payment_id"), // Tinkoff payment ID
  paymentStatus: text("payment_status"), // NEW, CONFIRMED, REJECTED, etc.
  paymentUrl: text("payment_url"), // URL for customer to pay
  receiptUrl: text("receipt_url"), // URL to view fiscal receipt from OFD
  receiptEmail: text("receipt_email"), // Email for sending receipt
  receiptSmsSent: boolean("receipt_sms_sent").notNull().default(false), // Flag to prevent duplicate SMS
  telegramChatId: text("telegram_chat_id"), // Telegram chat ID for orders placed via bot
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Order validation schemas
export const orderItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  pricePerGram: z.number().min(0),
  quantity: z.number().min(1, "Количество должно быть больше 0"), // quantity in grams
});

export const orderSchema = z.object({
  name: z.string().min(2, "Имя должно содержать минимум 2 символа"),
  email: z.string().email("Введите корректный email"),
  phone: z.string().min(10, "Введите корректный номер телефона"),
  address: z.string().min(10, "Введите полный адрес доставки"),
  comment: z.string().optional(),
  items: z.array(orderItemSchema).min(1, "Корзина не может быть пустой"),
  total: z.number().min(500, "Минимальная сумма заказа 500₽"),
  saveAddress: z.boolean().optional(),
});

export const insertOrderSchema = createInsertSchema(orders, {
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
  address: z.string().min(10),
  items: z.string(),
  total: z.number().min(0),
  status: z.string().default("pending"),
  usedFirstOrderDiscount: z.boolean().default(false),
  receiptEmail: z.string().email().optional().nullable(),
}).omit({ id: true, createdAt: true, paymentId: true, paymentStatus: true, paymentUrl: true });

export const updateOrderStatusSchema = z.object({
  status: z.enum(["pending", "paid", "cancelled", "completed"], {
    errorMap: () => ({ message: "Выберите корректный статус" })
  }),
});

export type OrderItem = z.infer<typeof orderItemSchema>;
export type Order = z.infer<typeof orderSchema>;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type DbOrder = typeof orders.$inferSelect;
export type UpdateOrderStatus = z.infer<typeof updateOrderStatusSchema>;

// Cart Items table
export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(), // quantity in grams or pieces
  addedAt: text("added_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  userProductUnique: sql`CONSTRAINT ${sql.identifier("cart_items_user_product_unique")} UNIQUE (${table.userId}, ${table.productId})`
}));

export const insertCartItemSchema = createInsertSchema(cartItems, {
  userId: z.string(),
  productId: z.number().int().positive(),
  quantity: z.number().int().positive("Количество должно быть больше 0"),
}).omit({ id: true, addedAt: true });

export const updateCartItemSchema = z.object({
  quantity: z.number().int().positive("Количество должно быть больше 0"),
});

export type InsertCartItem = z.infer<typeof insertCartItemSchema>;
export type UpdateCartItem = z.infer<typeof updateCartItemSchema>;
export type CartItem = typeof cartItems.$inferSelect;

// Site Settings table
export const siteSettings = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone").notNull(),
  contactTelegram: text("contact_telegram").notNull(),
  deliveryInfo: text("delivery_info").notNull(),
});

export const insertSiteSettingsSchema = createInsertSchema(siteSettings, {
  contactEmail: z.string().email("Введите корректный email"),
  contactPhone: z.string().min(10, "Введите корректный номер телефона"),
  contactTelegram: z.string().min(1, "Введите Telegram"),
  deliveryInfo: z.string().min(10, "Введите информацию о доставке"),
}).omit({ id: true });

export const updateSiteSettingsSchema = z.object({
  contactEmail: z.string().email("Введите корректный email").optional(),
  contactPhone: z.string().min(10, "Введите корректный номер телефона").optional(),
  contactTelegram: z.string().min(1, "Введите Telegram").optional(),
  deliveryInfo: z.string().min(10, "Введите информацию о доставке").optional(),
});

export type InsertSiteSettings = z.infer<typeof insertSiteSettingsSchema>;
export type UpdateSiteSettings = z.infer<typeof updateSiteSettingsSchema>;
export type SiteSettings = typeof siteSettings.$inferSelect;

// Saved Addresses table
export const savedAddresses = pgTable("saved_addresses", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  address: text("address").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertSavedAddressSchema = createInsertSchema(savedAddresses, {
  userId: z.string(),
  address: z.string().min(10, "Введите полный адрес доставки"),
  isDefault: z.boolean().default(false),
}).omit({ id: true, createdAt: true });

export const updateSavedAddressSchema = z.object({
  address: z.string().min(10, "Введите полный адрес доставки").optional(),
  isDefault: z.boolean().optional(),
});

export type InsertSavedAddress = z.infer<typeof insertSavedAddressSchema>;
export type UpdateSavedAddress = z.infer<typeof updateSavedAddressSchema>;
export type SavedAddress = typeof savedAddresses.$inferSelect;

// Telegram Profiles table - links Telegram users to website accounts
export const telegramProfiles = pgTable("telegram_profiles", {
  id: serial("id").primaryKey(),
  chatId: text("chat_id").notNull().unique(), // Telegram chat ID
  username: text("username"), // Telegram username (optional)
  firstName: text("first_name"), // Telegram first name
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }), // nullable - linked website account
  lastSeen: text("last_seen").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertTelegramProfileSchema = createInsertSchema(telegramProfiles, {
  chatId: z.string().min(1),
  username: z.string().optional().nullable(),
  firstName: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
}).omit({ id: true, lastSeen: true, createdAt: true });

export type InsertTelegramProfile = z.infer<typeof insertTelegramProfileSchema>;
export type TelegramProfile = typeof telegramProfiles.$inferSelect;

// Magic Links table - for one-time login links
export const magicLinks = pgTable("magic_links", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(), // SHA-256 hash of the token
  channel: text("channel").notNull().default("telegram"), // "telegram" or "web"
  expiresAt: text("expires_at").notNull(),
  consumedAt: text("consumed_at"), // null if not yet used
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertMagicLinkSchema = createInsertSchema(magicLinks, {
  userId: z.string().min(1),
  tokenHash: z.string().min(1),
  channel: z.enum(["telegram", "web"]),
  expiresAt: z.string(),
}).omit({ id: true, consumedAt: true, createdAt: true });

export type InsertMagicLink = z.infer<typeof insertMagicLinkSchema>;
export type MagicLink = typeof magicLinks.$inferSelect;

// Telegram Cart table - stores cart items for Telegram bot users
export const telegramCart = pgTable("telegram_cart", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(1), // For tea: grams, for teaware: pieces
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertTelegramCartSchema = createInsertSchema(telegramCart, {
  userId: z.string().min(1),
  productId: z.number().int().positive(),
  quantity: z.number().int().positive(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertTelegramCart = z.infer<typeof insertTelegramCartSchema>;
export type TelegramCartItem = typeof telegramCart.$inferSelect;

// Pending Telegram Orders - stores order info before payment confirmation
export const pendingTelegramOrders = pgTable("pending_telegram_orders", {
  id: serial("id").primaryKey(),
  orderId: text("order_id").notNull().unique(), // Tinkoff OrderId (T_userId_timestamp)
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  chatId: text("chat_id").notNull(), // For sending confirmation
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  items: text("items").notNull(), // JSON string of cart items
  subtotal: integer("subtotal").notNull(), // In kopecks before discount
  discount: integer("discount").notNull().default(0), // Discount in kopecks
  total: integer("total").notNull(), // Final amount in kopecks
  discountType: text("discount_type"), // "first_order" | "loyalty" | null
  status: text("status").notNull().default("pending"), // "pending" | "paid" | "cancelled"
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type PendingTelegramOrder = typeof pendingTelegramOrders.$inferSelect;

// Info Banners table - customizable information blocks for the site
export const infoBanners = pgTable("info_banners", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  icon: text("icon"), // Lucide icon name (e.g., "Truck", "Coffee", "Gift")
  theme: text("theme").notNull().default("dark"), // "dark" or "light"
  buttons: text("buttons"), // JSON array of {text: string, action?: string}
  desktopSlot: text("desktop_slot").notNull().default("after_filters"), // Placement slot on desktop
  mobileSlot: text("mobile_slot").notNull().default("after_filters"), // Placement slot on mobile
  desktopOrder: integer("desktop_order").notNull().default(0), // Sort order within desktop slot
  mobileOrder: integer("mobile_order").notNull().default(0), // Sort order within mobile slot
  hideOnDesktop: boolean("hide_on_desktop").notNull().default(false),
  hideOnMobile: boolean("hide_on_mobile").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Available slots for banner placement
export const BANNER_SLOTS = [
  { id: "after_header", name: "После шапки" },
  { id: "after_filters", name: "После фильтров" },
  { id: "before_products", name: "Перед товарами" },
  { id: "between_categories", name: "Между категориями" },
  { id: "after_products", name: "После товаров" },
  { id: "before_footer", name: "Перед подвалом" },
] as const;

export type BannerSlotId = typeof BANNER_SLOTS[number]["id"];

export const bannerButtonSchema = z.object({
  text: z.string().min(1, "Укажите текст кнопки"),
  action: z.string().optional(), // URL or action identifier
});

export const insertInfoBannerSchema = createInsertSchema(infoBanners, {
  title: z.string().min(2, "Заголовок должен содержать минимум 2 символа"),
  description: z.string().min(10, "Описание должно содержать минимум 10 символов"),
  icon: z.string().optional().nullable(),
  theme: z.enum(["dark", "light"]),
  buttons: z.string().optional().nullable(), // JSON string of buttons array
  desktopSlot: z.string(),
  mobileSlot: z.string(),
  desktopOrder: z.number().int().default(0),
  mobileOrder: z.number().int().default(0),
  hideOnDesktop: z.boolean().default(false),
  hideOnMobile: z.boolean().default(false),
  isActive: z.boolean().default(true),
}).omit({ id: true, createdAt: true });

export const updateInfoBannerSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().min(10).optional(),
  icon: z.string().optional().nullable(),
  theme: z.enum(["dark", "light"]).optional(),
  buttons: z.string().optional().nullable(),
  desktopSlot: z.string().optional(),
  mobileSlot: z.string().optional(),
  desktopOrder: z.number().int().optional(),
  mobileOrder: z.number().int().optional(),
  hideOnDesktop: z.boolean().optional(),
  hideOnMobile: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export type InsertInfoBanner = z.infer<typeof insertInfoBannerSchema>;
export type UpdateInfoBanner = z.infer<typeof updateInfoBannerSchema>;
export type InfoBanner = typeof infoBanners.$inferSelect;
export type BannerButton = z.infer<typeof bannerButtonSchema>;
