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
  effects: text("effects").array().notNull().default(sql`ARRAY[]::text[]`),
});

export const insertProductSchema = createInsertSchema(products, {
  name: z.string().min(2, "Название должно содержать минимум 2 символа"),
  pricePerGram: z.number().min(0, "Цена должна быть положительной"),
  description: z.string().min(10, "Описание должно содержать минимум 10 символов"),
  images: z.array(z.string().url()).min(1, "Добавьте хотя бы одно изображение"),
  teaType: z.string().min(1, "Выберите тип чая"),
  effects: z.array(z.string()).min(1, "Выберите хотя бы один эффект"),
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
