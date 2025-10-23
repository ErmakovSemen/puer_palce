import { type User, type InsertUser, type QuizConfig, type Product, type InsertProduct, type Settings, type UpdateSettings, type DbOrder, insertUserWithVerificationSchema } from "@shared/schema";
import type { z } from "zod";

type InsertUserWithVerification = z.infer<typeof insertUserWithVerificationSchema>;
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser | InsertUserWithVerification): Promise<User>;
  updateUser(id: string, data: { name?: string; phone?: string }): Promise<User | undefined>;
  updateUnverifiedUser(userId: string, hashedPassword: string, code: string, expires: Date): Promise<User | undefined>;
  addUserXP(userId: string, xpAmount: number): Promise<User | undefined>;
  verifyUser(userId: string): Promise<User | undefined>;
  updateVerificationCode(userId: string, code: string, expires: Date): Promise<User | undefined>;
  
  getQuizConfig(): Promise<QuizConfig>;
  updateQuizConfig(config: QuizConfig): Promise<QuizConfig>;
  
  // Products
  getProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: InsertProduct): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;
  
  // Settings
  getSettings(): Promise<Settings>;
  updateSettings(settings: UpdateSettings): Promise<Settings>;
  
  // Orders
  getUserOrders(userId: string): Promise<DbOrder[]>;
  createOrder(orderData: { 
    userId?: string | null; 
    name: string; 
    email: string; 
    phone: string; 
    address: string; 
    comment?: string; 
    items: string; 
    total: number; 
  }): Promise<DbOrder>;
  
  // Session store for auth
  sessionStore: any;
}

const defaultQuizConfig: QuizConfig = {
  questions: [
    {
      id: "q1",
      text: "КАКОЙ ЭФФЕКТ ВЫ ХОТИТЕ ПОЛУЧИТЬ?",
      options: [
        { label: "Бодрость и энергию", value: "energize" },
        { label: "Спокойствие", value: "calm" },
        { label: "Концентрацию", value: "focus" },
      ],
    },
    {
      id: "q2",
      text: "КАКОЙ ВКУС ВАМ БЛИЖЕ?",
      options: [
        { label: "Землистый и глубокий", value: "earthy" },
        { label: "Свежий и цветочный", value: "fresh" },
        { label: "Насыщенный выдержанный", value: "aged" },
      ],
    },
    {
      id: "q3",
      text: "КОГДА ПЛАНИРУЕТЕ ПИТЬ ЧАЙ?",
      options: [
        { label: "Утром", value: "morning" },
        { label: "Днём", value: "day" },
        { label: "Вечером", value: "evening" },
      ],
    },
  ],
  rules: [
    { conditions: ["energize", "earthy"], teaType: "Шу Пуэр", priority: 10 },
    { conditions: ["energize", "fresh"], teaType: "Шен Пуэр", priority: 10 },
    { conditions: ["focus", "earthy"], teaType: "Шу Пуэр", priority: 9 },
    { conditions: ["focus", "fresh"], teaType: "Шен Пуэр", priority: 9 },
    { conditions: ["calm", "fresh"], teaType: "Шен Пуэр", priority: 8 },
    { conditions: ["calm"], teaType: "Габа", priority: 7 },
    { conditions: ["energize"], teaType: "Красный", priority: 5 },
    { conditions: [], teaType: "Шу Пуэр", priority: 1 }, // дефолт
  ],
};

import createMemoryStore from "memorystore";
import session from "express-session";

const MemoryStore = createMemoryStore(session);

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private quizConfig: QuizConfig;
  private products: Map<number, Product>;
  private productIdCounter: number;
  private settings: Settings;
  sessionStore: any;

  constructor() {
    this.users = new Map();
    this.quizConfig = defaultQuizConfig;
    this.products = new Map();
    this.productIdCounter = 1;
    this.settings = { id: 1, designMode: "minimalist" };
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser | InsertUserWithVerification): Promise<User> {
    const id = randomUUID();
    const withVerification = insertUser as InsertUserWithVerification;
    const user: User = { 
      ...insertUser, 
      id,
      name: insertUser.name ?? null,
      phone: insertUser.phone ?? null,
      xp: 0,
      emailVerified: withVerification.emailVerified ?? false,
      verificationCode: withVerification.verificationCode ?? null,
      verificationCodeExpires: withVerification.verificationCodeExpires ?? null,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, data: { name?: string; phone?: string }): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updated: User = { ...user, ...data };
    this.users.set(id, updated);
    return updated;
  }

  async addUserXP(userId: string, xpAmount: number): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    
    const updated: User = { ...user, xp: user.xp + xpAmount };
    this.users.set(userId, updated);
    return updated;
  }

  async verifyUser(userId: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    
    const updated: User = { 
      ...user, 
      emailVerified: true,
      verificationCode: null,
      verificationCodeExpires: null
    };
    this.users.set(userId, updated);
    return updated;
  }

  async updateVerificationCode(userId: string, code: string, expires: Date): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    
    const updated: User = { 
      ...user, 
      verificationCode: code,
      verificationCodeExpires: expires
    };
    this.users.set(userId, updated);
    return updated;
  }

  async updateUnverifiedUser(userId: string, hashedPassword: string, code: string, expires: Date): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    
    const updated: User = { 
      ...user, 
      password: hashedPassword,
      verificationCode: code,
      verificationCodeExpires: expires
    };
    this.users.set(userId, updated);
    return updated;
  }

  async getQuizConfig(): Promise<QuizConfig> {
    return this.quizConfig;
  }

  async updateQuizConfig(config: QuizConfig): Promise<QuizConfig> {
    this.quizConfig = config;
    return this.quizConfig;
  }

  async getProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  async getProduct(id: number): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const id = this.productIdCounter++;
    const product: Product = { 
      ...insertProduct, 
      id,
      fixedQuantity: insertProduct.fixedQuantity ?? null,
    };
    this.products.set(id, product);
    return product;
  }

  async updateProduct(id: number, insertProduct: InsertProduct): Promise<Product | undefined> {
    const existing = this.products.get(id);
    if (!existing) return undefined;
    
    const updated: Product = { 
      ...insertProduct, 
      id,
      fixedQuantity: insertProduct.fixedQuantity ?? null,
    };
    this.products.set(id, updated);
    return updated;
  }

  async deleteProduct(id: number): Promise<boolean> {
    return this.products.delete(id);
  }

  async getSettings(): Promise<Settings> {
    return this.settings;
  }

  async updateSettings(updateData: UpdateSettings): Promise<Settings> {
    this.settings = { ...this.settings, ...updateData };
    return this.settings;
  }

  async getUserOrders(userId: string): Promise<DbOrder[]> {
    // MemStorage doesn't persist orders, return empty array
    return [];
  }

  async createOrder(orderData: { 
    userId?: string | null; 
    name: string; 
    email: string; 
    phone: string; 
    address: string; 
    comment?: string; 
    items: string; 
    total: number; 
  }): Promise<DbOrder> {
    // MemStorage doesn't persist orders, return mock order
    return {
      id: 1,
      userId: orderData.userId ?? null,
      name: orderData.name,
      email: orderData.email,
      phone: orderData.phone,
      address: orderData.address,
      comment: orderData.comment ?? null,
      items: orderData.items,
      total: orderData.total,
      createdAt: new Date().toISOString(),
    };
  }
}

import { db } from "./db";
import { users as usersTable, products as productsTable, settings as settingsTable, orders as ordersTable } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);

export class DbStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
    });
  }
  async seedInitialSettings(): Promise<void> {
    const allSettings = await db.select().from(settingsTable);
    
    if (allSettings.length === 0) {
      console.log('Initializing default settings...');
      await db.insert(settingsTable).values({ designMode: "minimalist" });
      console.log('✓ Default settings initialized');
    }
  }

  async seedInitialProducts(): Promise<void> {
    const existingProducts = await this.getProducts();
    
    if (existingProducts.length === 0) {
      console.log('Seeding initial products...');
      
      const initialProducts: InsertProduct[] = [
        {
          name: 'Шу Пуэр Мэнхай 2018',
          description: 'Классический выдержанный Шу Пуэр из провинции Юньнань. Насыщенный землистый вкус с нотками орехов и древесины. Идеален для ежедневного чаепития.',
          pricePerGram: 15.50,
          images: [],
          teaType: 'Шу Пуэр',
          teaTypeColor: '#8B4513',
          effects: ['Бодрит', 'Концентрирует'],
          availableQuantities: ['25', '50', '100'],
          fixedQuantityOnly: false,
        },
        {
          name: 'Шэн Пуэр Дикие деревья',
          description: 'Редкий Шэн Пуэр с дикорастущих деревьев. Свежий цветочно-медовый аромат с долгим послевкусием. Для истинных ценителей.',
          pricePerGram: 28.00,
          images: [],
          teaType: 'Шэн Пуэр',
          teaTypeColor: '#228B22',
          effects: ['Концентрирует', 'Расслабляет'],
          availableQuantities: ['25', '50', '100'],
          fixedQuantityOnly: false,
        },
        {
          name: 'Белый Пуэр Лунный свет',
          description: 'Деликатный белый пуэр с мягким сладковатым вкусом. Легкий цветочный аромат успокаивает и гармонизирует.',
          pricePerGram: 22.50,
          images: [],
          teaType: 'Белый Пуэр',
          teaTypeColor: '#F5DEB3',
          effects: ['Успокаивает', 'Расслабляет'],
          availableQuantities: ['25', '50', '100'],
          fixedQuantityOnly: false,
        },
        {
          name: 'Красный Пуэр Императорский',
          description: 'Премиальный красный пуэр глубокой ферментации. Бархатистый вкус с нотками сухофруктов и специй.',
          pricePerGram: 35.00,
          images: [],
          teaType: 'Красный Пуэр',
          teaTypeColor: '#DC143C',
          effects: ['Согревает', 'Тонизирует'],
          availableQuantities: ['25', '50', '100'],
          fixedQuantityOnly: false,
        },
        {
          name: 'Чёрный Пуэр Старые головы',
          description: 'Насыщенный чёрный пуэр из крупных листьев. Глубокий вкус с оттенками шоколада и карамели.',
          pricePerGram: 18.75,
          images: [],
          teaType: 'Чёрный Пуэр',
          teaTypeColor: '#2F4F4F',
          effects: ['Бодрит', 'Согревает'],
          availableQuantities: ['25', '50', '100'],
          fixedQuantityOnly: false,
        }
      ];

      for (const product of initialProducts) {
        await this.createProduct(product);
      }
      
      console.log(`✓ Seeded ${initialProducts.length} initial products`);
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(usersTable).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, data: { name?: string; phone?: string }): Promise<User | undefined> {
    const [user] = await db
      .update(usersTable)
      .set(data)
      .where(eq(usersTable.id, id))
      .returning();
    return user;
  }

  async addUserXP(userId: string, xpAmount: number): Promise<User | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;
    
    const [updatedUser] = await db
      .update(usersTable)
      .set({ xp: user.xp + xpAmount })
      .where(eq(usersTable.id, userId))
      .returning();
    return updatedUser;
  }

  async verifyUser(userId: string): Promise<User | undefined> {
    const [user] = await db
      .update(usersTable)
      .set({ 
        emailVerified: true,
        verificationCode: null,
        verificationCodeExpires: null
      })
      .where(eq(usersTable.id, userId))
      .returning();
    return user;
  }

  async updateVerificationCode(userId: string, code: string, expires: Date): Promise<User | undefined> {
    const [user] = await db
      .update(usersTable)
      .set({ 
        verificationCode: code,
        verificationCodeExpires: expires
      })
      .where(eq(usersTable.id, userId))
      .returning();
    return user;
  }

  async updateUnverifiedUser(userId: string, hashedPassword: string, code: string, expires: Date): Promise<User | undefined> {
    const [user] = await db
      .update(usersTable)
      .set({ 
        password: hashedPassword,
        verificationCode: code,
        verificationCodeExpires: expires
      })
      .where(eq(usersTable.id, userId))
      .returning();
    return user;
  }

  async getQuizConfig(): Promise<QuizConfig> {
    // For now, return default config (could be stored in DB later)
    return defaultQuizConfig;
  }

  async updateQuizConfig(config: QuizConfig): Promise<QuizConfig> {
    // For now, just return the config (could be persisted in DB later)
    return config;
  }

  async getProducts(): Promise<Product[]> {
    return await db.select().from(productsTable);
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
    return product;
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db.insert(productsTable).values(insertProduct).returning();
    return product;
  }

  async updateProduct(id: number, insertProduct: InsertProduct): Promise<Product | undefined> {
    const [product] = await db
      .update(productsTable)
      .set(insertProduct)
      .where(eq(productsTable.id, id))
      .returning();
    return product;
  }

  async deleteProduct(id: number): Promise<boolean> {
    const result = await db.delete(productsTable).where(eq(productsTable.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getSettings(): Promise<Settings> {
    const allSettings = await db.select().from(settingsTable);
    
    if (allSettings.length === 0) {
      // If no settings exist, create default
      const [settings] = await db.insert(settingsTable).values({ designMode: "minimalist" }).returning();
      return settings;
    }
    
    return allSettings[0];
  }

  async updateSettings(updateData: UpdateSettings): Promise<Settings> {
    // Get current settings or create default
    const currentSettings = await this.getSettings();
    
    const [settings] = await db
      .update(settingsTable)
      .set(updateData)
      .where(eq(settingsTable.id, currentSettings.id))
      .returning();
    
    return settings;
  }

  async getUserOrders(userId: string): Promise<DbOrder[]> {
    const orders = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.userId, userId))
      .orderBy(desc(ordersTable.createdAt));
    
    return orders;
  }

  async createOrder(orderData: { 
    userId?: string | null; 
    name: string; 
    email: string; 
    phone: string; 
    address: string; 
    comment?: string; 
    items: string; 
    total: number; 
  }): Promise<DbOrder> {
    const [order] = await db.insert(ordersTable).values({
      userId: orderData.userId ?? null,
      name: orderData.name,
      email: orderData.email,
      phone: orderData.phone,
      address: orderData.address,
      comment: orderData.comment ?? null,
      items: orderData.items,
      total: orderData.total,
    }).returning();
    
    return order;
  }
}

// Use database storage instead of memory storage
export const storage = new DbStorage();
