import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, real, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  phone: text("phone"),
  xp: integer("xp").notNull().default(0),
});

export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email("Введите корректный email"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
  name: z.string().min(2, "Имя должно содержать минимум 2 символа").optional(),
  phone: z.string().min(10, "Введите корректный номер телефона").optional(),
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
  userId: varchar("user_id").references(() => users.id), // nullable - for guest orders
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  comment: text("comment"),
  items: text("items").notNull(), // JSON string of order items
  total: real("total").notNull(),
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

export type OrderItem = z.infer<typeof orderItemSchema>;
export type Order = z.infer<typeof orderSchema>;
export type DbOrder = typeof orders.$inferSelect;
