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
}).omit({ id: true, createdAt: true });

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
