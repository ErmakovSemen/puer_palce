import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Products
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  pricePerGram: real("price_per_gram").notNull(),
  description: text("description").notNull(),
  images: text("images").array().notNull().default(sql`ARRAY[]::text[]`),
  teaType: text("tea_type").notNull(),
  teaTypeColor: text("tea_type_color").notNull().default("#8B4513"), // Default brown color
  effects: text("effects").array().notNull().default(sql`ARRAY[]::text[]`),
  availableQuantities: text("available_quantities").array().notNull().default(sql`ARRAY['25', '50', '100']::text[]`), // Available quantities in grams
});

export const insertProductSchema = createInsertSchema(products, {
  name: z.string().min(2, "Название должно содержать минимум 2 символа"),
  pricePerGram: z.number().min(0, "Цена должна быть положительной"),
  description: z.string().min(10, "Описание должно содержать минимум 10 символов"),
  images: z.array(z.string().min(1)).min(1, "Добавьте хотя бы одно изображение"),
  teaType: z.string().min(1, "Выберите тип чая"),
  teaTypeColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Введите корректный hex-цвет (например, #8B4513)"),
  effects: z.array(z.string()).min(1, "Выберите хотя бы один эффект"),
  availableQuantities: z.array(z.string().regex(/^\d+$/, "Количество должно быть числом")).min(1, "Добавьте хотя бы одно доступное количество"),
}).omit({ id: true });

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

// Order schema
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
  total: z.number().min(0),
});

export type OrderItem = z.infer<typeof orderItemSchema>;
export type Order = z.infer<typeof orderSchema>;
