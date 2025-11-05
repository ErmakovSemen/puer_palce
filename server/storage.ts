import { type User, type InsertUser, type QuizConfig, type Product, type InsertProduct, type Settings, type UpdateSettings, type DbOrder, type TeaType, type InsertTeaType, type CartItem as DbCartItem, type InsertCartItem, type SmsVerification } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  searchUserByPhone(phone: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: { name?: string; phone?: string }): Promise<User | undefined>;
  updateUserPassword(id: string, hashedPassword: string): Promise<User | undefined>;
  addUserXP(userId: string, xpAmount: number): Promise<User | undefined>;
  updateUserXP(userId: string, newXP: number): Promise<User | undefined>;
  
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
  
  // Tea Types
  getTeaTypes(): Promise<TeaType[]>;
  getTeaType(id: number): Promise<TeaType | undefined>;
  createTeaType(teaType: InsertTeaType): Promise<TeaType>;
  updateTeaType(id: number, teaType: InsertTeaType): Promise<TeaType | undefined>;
  deleteTeaType(id: number): Promise<boolean>;
  
  // Orders
  getOrder(orderId: number): Promise<DbOrder | undefined>;
  getOrders(statusFilter?: string): Promise<DbOrder[]>;
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
  updateOrderStatus(orderId: number, status: string, expectedOldStatus?: string): Promise<DbOrder | undefined>;
  
  // Cart
  getCartItems(userId: string): Promise<Array<DbCartItem & { product: Product }>>;
  addToCart(cartItem: InsertCartItem): Promise<DbCartItem>;
  updateCartItem(id: number, quantity: number, userId: string): Promise<DbCartItem | undefined>;
  removeFromCart(id: number, userId: string): Promise<boolean>;
  clearCart(userId: string): Promise<void>;
  
  // SMS Verification
  createSmsVerification(phone: string, hashedCode: string, type: "registration" | "password_reset"): Promise<SmsVerification>;
  getSmsVerification(phone: string, type: "registration" | "password_reset"): Promise<SmsVerification | undefined>;
  incrementSmsAttempts(id: number): Promise<SmsVerification | undefined>;
  deleteSmsVerification(id: number): Promise<void>;
  cleanupExpiredSmsVerifications(): Promise<void>;
  checkSmsRateLimit(phone: string): Promise<boolean>;
  markPhoneVerified(userId: string): Promise<User | undefined>;
  
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

  async getUserByPhone(phone: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.phone === phone,
    );
  }

  async searchUserByPhone(phone: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.phone && user.phone.includes(phone),
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      name: insertUser.name ?? null,
      email: insertUser.email ?? null,
      phone: insertUser.phone,
      phoneVerified: false,
      xp: 0,
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

  async updateUserPassword(id: string, hashedPassword: string): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updated: User = { ...user, password: hashedPassword };
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

  async updateUserXP(userId: string, newXP: number): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    
    const updated: User = { ...user, xp: newXP };
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

  async getOrder(orderId: number): Promise<DbOrder | undefined> {
    // MemStorage doesn't persist orders, return undefined
    return undefined;
  }

  async getUserOrders(userId: string): Promise<DbOrder[]> {
    // MemStorage doesn't persist orders, return empty array
    return [];
  }

  async getOrders(statusFilter?: string): Promise<DbOrder[]> {
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
      status: "pending",
      createdAt: new Date().toISOString(),
    };
  }

  async updateOrderStatus(orderId: number, status: string, expectedOldStatus?: string): Promise<DbOrder | undefined> {
    // MemStorage doesn't persist orders, return undefined
    return undefined;
  }

  // Tea Types methods (not persisted in MemStorage)
  async getTeaTypes(): Promise<TeaType[]> {
    return [];
  }

  async getTeaType(id: number): Promise<TeaType | undefined> {
    return undefined;
  }

  async createTeaType(teaType: InsertTeaType): Promise<TeaType> {
    return { id: 1, ...teaType };
  }

  async updateTeaType(id: number, teaType: InsertTeaType): Promise<TeaType | undefined> {
    return undefined;
  }

  async deleteTeaType(id: number): Promise<boolean> {
    return false;
  }

  // Cart methods (not implemented in MemStorage)
  async getCartItems(userId: string): Promise<Array<DbCartItem & { product: Product }>> {
    return [];
  }

  async addToCart(cartItem: InsertCartItem): Promise<DbCartItem> {
    throw new Error("Cart operations not supported in MemStorage");
  }

  async updateCartItem(id: number, quantity: number, userId: string): Promise<DbCartItem | undefined> {
    return undefined;
  }

  async removeFromCart(id: number, userId: string): Promise<boolean> {
    return false;
  }

  async clearCart(userId: string): Promise<void> {
    // No-op in MemStorage
  }

  // SMS Verification methods (not persisted in MemStorage)
  async createSmsVerification(phone: string, hashedCode: string, type: "registration" | "password_reset"): Promise<SmsVerification> {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes
    return {
      id: 1,
      phone,
      code: hashedCode,
      type,
      attempts: 0,
      createdAt: new Date().toISOString(),
      expiresAt,
    };
  }

  async getSmsVerification(phone: string, type: "registration" | "password_reset"): Promise<SmsVerification | undefined> {
    return undefined;
  }

  async incrementSmsAttempts(id: number): Promise<SmsVerification | undefined> {
    return undefined;
  }

  async deleteSmsVerification(id: number): Promise<void> {
    // No-op
  }

  async cleanupExpiredSmsVerifications(): Promise<void> {
    // No-op
  }

  async checkSmsRateLimit(phone: string): Promise<boolean> {
    // Always allow in MemStorage
    return true;
  }

  async markPhoneVerified(userId: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    
    const updated: User = { ...user, phoneVerified: true };
    this.users.set(userId, updated);
    return updated;
  }
}

import { db } from "./db";
import { users as usersTable, products as productsTable, settings as settingsTable, orders as ordersTable, teaTypes as teaTypesTable, cartItems as cartItemsTable, smsVerifications as smsVerificationsTable } from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
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
          category: 'tea',
          description: 'Классический выдержанный Шу Пуэр из провинции Юньнань. Насыщенный землистый вкус с нотками орехов и древесины. Идеален для ежедневного чаепития.',
          pricePerGram: 15.50,
          images: [],
          teaType: 'Шу Пуэр',
          effects: ['Бодрит', 'Концентрирует'],
          availableQuantities: ['25', '50', '100'],
          fixedQuantityOnly: false,
        },
        {
          name: 'Шэн Пуэр Дикие деревья',
          category: 'tea',
          description: 'Редкий Шэн Пуэр с дикорастущих деревьев. Свежий цветочно-медовый аромат с долгим послевкусием. Для истинных ценителей.',
          pricePerGram: 28.00,
          images: [],
          teaType: 'Шэн Пуэр',
          effects: ['Концентрирует', 'Расслабляет'],
          availableQuantities: ['25', '50', '100'],
          fixedQuantityOnly: false,
        },
        {
          name: 'Белый Пуэр Лунный свет',
          category: 'tea',
          description: 'Деликатный белый пуэр с мягким сладковатым вкусом. Легкий цветочный аромат успокаивает и гармонизирует.',
          pricePerGram: 22.50,
          images: [],
          teaType: 'Белый Пуэр',
          effects: ['Успокаивает', 'Расслабляет'],
          availableQuantities: ['25', '50', '100'],
          fixedQuantityOnly: false,
        },
        {
          name: 'Красный Пуэр Императорский',
          category: 'tea',
          description: 'Премиальный красный пуэр глубокой ферментации. Бархатистый вкус с нотками сухофруктов и специй.',
          pricePerGram: 35.00,
          images: [],
          teaType: 'Красный Пуэр',
          effects: ['Согревает', 'Тонизирует'],
          availableQuantities: ['25', '50', '100'],
          fixedQuantityOnly: false,
        },
        {
          name: 'Чёрный Пуэр Старые головы',
          category: 'tea',
          description: 'Насыщенный чёрный пуэр из крупных листьев. Глубокий вкус с оттенками шоколада и карамели.',
          pricePerGram: 18.75,
          images: [],
          teaType: 'Чёрный Пуэр',
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

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
    return user;
  }

  async searchUserByPhone(phone: string): Promise<User | undefined> {
    const { like } = await import("drizzle-orm");
    const [user] = await db.select().from(usersTable).where(like(usersTable.phone, `%${phone}%`));
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

  async updateUserPassword(id: string, hashedPassword: string): Promise<User | undefined> {
    const [user] = await db
      .update(usersTable)
      .set({ password: hashedPassword })
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

  async updateUserXP(userId: string, newXP: number): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(usersTable)
      .set({ xp: newXP })
      .where(eq(usersTable.id, userId))
      .returning();
    return updatedUser;
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

  async getOrder(orderId: number): Promise<DbOrder | undefined> {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    return order;
  }

  async getOrders(statusFilter?: string): Promise<DbOrder[]> {
    let query = db.select().from(ordersTable);
    
    if (statusFilter) {
      query = query.where(eq(ordersTable.status, statusFilter)) as any;
    }
    
    const orders = await query.orderBy(desc(ordersTable.createdAt));
    return orders;
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

  async updateOrderStatus(orderId: number, status: string, expectedOldStatus?: string): Promise<DbOrder | undefined> {
    // If expectedOldStatus is provided, only update if current status matches
    // This prevents race conditions when multiple admins try to complete the same order
    const whereCondition = expectedOldStatus 
      ? and(eq(ordersTable.id, orderId), eq(ordersTable.status, expectedOldStatus))
      : eq(ordersTable.id, orderId);
    
    const [order] = await db
      .update(ordersTable)
      .set({ status })
      .where(whereCondition)
      .returning();
    
    return order;
  }

  // Tea Types methods
  async getTeaTypes(): Promise<TeaType[]> {
    const types = await db.select().from(teaTypesTable);
    return types;
  }

  async getTeaType(id: number): Promise<TeaType | undefined> {
    const [teaType] = await db.select().from(teaTypesTable).where(eq(teaTypesTable.id, id));
    return teaType;
  }

  async createTeaType(insertTeaType: InsertTeaType): Promise<TeaType> {
    const [teaType] = await db.insert(teaTypesTable).values(insertTeaType).returning();
    return teaType;
  }

  async updateTeaType(id: number, insertTeaType: InsertTeaType): Promise<TeaType | undefined> {
    const [teaType] = await db
      .update(teaTypesTable)
      .set(insertTeaType)
      .where(eq(teaTypesTable.id, id))
      .returning();
    return teaType;
  }

  async deleteTeaType(id: number): Promise<boolean> {
    const result = await db.delete(teaTypesTable).where(eq(teaTypesTable.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Cart methods
  async getCartItems(userId: string): Promise<Array<DbCartItem & { product: Product }>> {
    const items = await db
      .select({
        id: cartItemsTable.id,
        userId: cartItemsTable.userId,
        productId: cartItemsTable.productId,
        quantity: cartItemsTable.quantity,
        addedAt: cartItemsTable.addedAt,
        product: productsTable,
      })
      .from(cartItemsTable)
      .innerJoin(productsTable, eq(cartItemsTable.productId, productsTable.id))
      .where(eq(cartItemsTable.userId, userId));

    return items;
  }

  async addToCart(cartItem: InsertCartItem): Promise<DbCartItem> {
    // Use INSERT ... ON CONFLICT to handle race conditions atomically
    const [item] = await db
      .insert(cartItemsTable)
      .values(cartItem)
      .onConflictDoUpdate({
        target: [cartItemsTable.userId, cartItemsTable.productId],
        set: {
          quantity: sql`${cartItemsTable.quantity} + ${cartItem.quantity}`,
        },
      })
      .returning();
    
    return item;
  }

  async updateCartItem(id: number, quantity: number, userId: string): Promise<DbCartItem | undefined> {
    const [item] = await db
      .update(cartItemsTable)
      .set({ quantity })
      .where(and(eq(cartItemsTable.id, id), eq(cartItemsTable.userId, userId)))
      .returning();
    return item;
  }

  async removeFromCart(id: number, userId: string): Promise<boolean> {
    const result = await db
      .delete(cartItemsTable)
      .where(and(eq(cartItemsTable.id, id), eq(cartItemsTable.userId, userId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async clearCart(userId: string): Promise<void> {
    await db.delete(cartItemsTable).where(eq(cartItemsTable.userId, userId));
  }

  async seedInitialTeaTypes(): Promise<void> {
    const existingTypes = await this.getTeaTypes();
    
    if (existingTypes.length === 0) {
      console.log('Seeding initial tea types...');
      
      // Import colors from tea-colors.ts structure
      const initialTeaTypes: InsertTeaType[] = [
        { name: "Шу Пуэр", backgroundColor: "#8B4513", textColor: "#FFFFFF" },
        { name: "Шэн Пуэр", backgroundColor: "#228B22", textColor: "#FFFFFF" },
        { name: "Белый Пуэр", backgroundColor: "#D3D3D3", textColor: "#000000" },
        { name: "Красный Пуэр", backgroundColor: "#DC143C", textColor: "#FFFFFF" },
        { name: "Чёрный Пуэр", backgroundColor: "#2F4F4F", textColor: "#FFFFFF" },
        { name: "Улун", backgroundColor: "#FF8C00", textColor: "#FFFFFF" },
        { name: "Красный чай", backgroundColor: "#B22222", textColor: "#FFFFFF" },
        { name: "Зелёный чай", backgroundColor: "#32CD32", textColor: "#000000" },
        { name: "Жёлтый чай", backgroundColor: "#FFD700", textColor: "#000000" },
        { name: "Габа", backgroundColor: "#9370DB", textColor: "#FFFFFF" },
        { name: "Выдержанный", backgroundColor: "#CD853F", textColor: "#000000" },
      ];

      for (const teaType of initialTeaTypes) {
        await this.createTeaType(teaType);
      }
      
      console.log('✓ Initial tea types seeded');
    }
  }

  // SMS Verification methods
  async createSmsVerification(phone: string, hashedCode: string, type: "registration" | "password_reset"): Promise<SmsVerification> {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes from now
    
    const [verification] = await db
      .insert(smsVerificationsTable)
      .values({
        phone,
        code: hashedCode,
        type,
        expiresAt,
      })
      .returning();
    
    return verification;
  }

  async getSmsVerification(phone: string, type: "registration" | "password_reset"): Promise<SmsVerification | undefined> {
    const [verification] = await db
      .select()
      .from(smsVerificationsTable)
      .where(
        and(
          eq(smsVerificationsTable.phone, phone),
          eq(smsVerificationsTable.type, type)
        )
      )
      .orderBy(desc(smsVerificationsTable.createdAt))
      .limit(1);
    
    return verification;
  }

  async incrementSmsAttempts(id: number): Promise<SmsVerification | undefined> {
    const [verification] = await db
      .update(smsVerificationsTable)
      .set({
        attempts: sql`${smsVerificationsTable.attempts} + 1`,
      })
      .where(eq(smsVerificationsTable.id, id))
      .returning();
    
    return verification;
  }

  async deleteSmsVerification(id: number): Promise<void> {
    await db.delete(smsVerificationsTable).where(eq(smsVerificationsTable.id, id));
  }

  async cleanupExpiredSmsVerifications(): Promise<void> {
    const now = new Date().toISOString();
    await db
      .delete(smsVerificationsTable)
      .where(sql`${smsVerificationsTable.expiresAt} < ${now}`);
  }

  async checkSmsRateLimit(phone: string): Promise<boolean> {
    // Check if user has sent more than 3 SMS in last 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const recentVerifications = await db
      .select()
      .from(smsVerificationsTable)
      .where(
        and(
          eq(smsVerificationsTable.phone, phone),
          sql`${smsVerificationsTable.createdAt} > ${tenMinutesAgo}`
        )
      );
    
    // Allow if less than 3 SMS sent in last 10 minutes
    return recentVerifications.length < 3;
  }

  async markPhoneVerified(userId: string): Promise<User | undefined> {
    const [user] = await db
      .update(usersTable)
      .set({ phoneVerified: true })
      .where(eq(usersTable.id, userId))
      .returning();
    
    return user;
  }
}

// Use database storage instead of memory storage
export const storage = new DbStorage();
