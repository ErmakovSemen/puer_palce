import { type User, type InsertUser, type QuizConfig, type Product, type InsertProduct, type Settings, type UpdateSettings, type DbOrder, type TeaType, type InsertTeaType, type CartItem as DbCartItem, type InsertCartItem, type SmsVerification, type SavedAddress, type InsertSavedAddress, type XpTransaction, type InsertXpTransaction, type TvSlide, type InsertTvSlide, type UpdateTvSlide, type Experiment, type InsertExperiment, type UpdateExperiment, type AbEvent, type InsertAbEvent, type DeviceUserMapping, type InsertDeviceUserMapping, type Media, type InsertMedia, type UpdateMedia } from "@shared/schema";
import { randomUUID } from "crypto";
import { normalizePhone } from "./utils";

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
  markFirstOrderDiscountUsed(userId: string): Promise<User | undefined>;
  restoreFirstOrderDiscount(userId: string): Promise<User | undefined>;
  
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
  getOrders(statusFilter?: string, offset?: number, limit?: number): Promise<DbOrder[]>;
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
    usedFirstOrderDiscount?: boolean;
    receiptEmail?: string;
  }): Promise<DbOrder>;
  updateOrderStatus(orderId: number, status: string, expectedOldStatus?: string): Promise<DbOrder | undefined>;
  
  // Cart
  getCartItems(userId: string): Promise<Array<DbCartItem & { product: Product }>>;
  addToCart(cartItem: InsertCartItem): Promise<DbCartItem>;
  updateCartItem(id: number, quantity: number, userId: string, pricePerUnit?: number): Promise<DbCartItem | undefined>;
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
  
  // Site Settings
  getSiteSettings(): Promise<import("@shared/schema").SiteSettings | undefined>;
  updateSiteSettings(settings: import("@shared/schema").UpdateSiteSettings): Promise<import("@shared/schema").SiteSettings | undefined>;
  
  // Saved Addresses
  getSavedAddresses(userId: string): Promise<SavedAddress[]>;
  createSavedAddress(address: InsertSavedAddress): Promise<SavedAddress | null>;
  deleteSavedAddress(id: number, userId: string): Promise<boolean>;
  setDefaultAddress(id: number, userId: string): Promise<SavedAddress | undefined>;
  
  // Info Banners
  getInfoBanners(activeOnly?: boolean): Promise<import("@shared/schema").InfoBanner[]>;
  getInfoBanner(id: number): Promise<import("@shared/schema").InfoBanner | undefined>;
  createInfoBanner(banner: import("@shared/schema").InsertInfoBanner): Promise<import("@shared/schema").InfoBanner>;
  updateInfoBanner(id: number, banner: import("@shared/schema").UpdateInfoBanner): Promise<import("@shared/schema").InfoBanner | undefined>;
  deleteInfoBanner(id: number): Promise<boolean>;
  reorderBanners(orders: { id: number; desktopOrder?: number; mobileOrder?: number; desktopSlot?: string; mobileSlot?: string }[]): Promise<void>;
  
  // XP Transactions (loyalty program history)
  createXpTransaction(transaction: InsertXpTransaction): Promise<XpTransaction>;
  getXpTransactions(limit?: number, offset?: number): Promise<Array<XpTransaction & { user: User }>>;
  getUserXpTransactions(userId: string): Promise<XpTransaction[]>;
  
  // Leaderboard
  getMonthlyLeaderboard(): Promise<import("@shared/schema").LeaderboardEntry[]>;
  
  // TV Slides
  getTvSlides(activeOnly?: boolean): Promise<TvSlide[]>;
  getTvSlide(id: number): Promise<TvSlide | undefined>;
  createTvSlide(slide: InsertTvSlide): Promise<TvSlide>;
  updateTvSlide(id: number, slide: UpdateTvSlide): Promise<TvSlide | undefined>;
  deleteTvSlide(id: number): Promise<boolean>;
  reorderTvSlides(orders: { id: number; orderIndex: number }[]): Promise<void>;
  
  // A/B Testing - Experiments
  getExperiments(): Promise<import("@shared/schema").Experiment[]>;
  getActiveExperiments(): Promise<import("@shared/schema").Experiment[]>;
  getExperiment(id: number): Promise<import("@shared/schema").Experiment | undefined>;
  getExperimentByTestId(testId: string): Promise<import("@shared/schema").Experiment | undefined>;
  createExperiment(experiment: import("@shared/schema").InsertExperiment): Promise<import("@shared/schema").Experiment>;
  updateExperiment(id: number, experiment: import("@shared/schema").UpdateExperiment): Promise<import("@shared/schema").Experiment | undefined>;
  deleteExperiment(id: number): Promise<boolean>;
  
  // A/B Testing - Events
  createAbEvent(event: import("@shared/schema").InsertAbEvent): Promise<import("@shared/schema").AbEvent>;
  getAbEvents(limit?: number, offset?: number): Promise<import("@shared/schema").AbEvent[]>;
  
  // A/B Testing - Device/User Mapping
  createDeviceUserMapping(deviceId: string, userId: string): Promise<import("@shared/schema").DeviceUserMapping>;
  getDeviceUserMapping(deviceId: string): Promise<import("@shared/schema").DeviceUserMapping | undefined>;
  
  // Media (Video Gallery)
  getMedia(productId?: number): Promise<Media[]>;
  getFeaturedMedia(): Promise<(Media & { product: Product })[]>;
  getMediaItem(id: number): Promise<Media | undefined>;
  createMedia(mediaData: InsertMedia): Promise<Media>;
  updateMedia(id: number, mediaData: UpdateMedia): Promise<Media | undefined>;
  deleteMedia(id: number): Promise<boolean>;
  reorderMedia(orders: { id: number; displayOrder: number }[]): Promise<void>;
  
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
    { conditions: ["energize", "fresh"], teaType: "Шэн Пуэр", priority: 10 },
    { conditions: ["focus", "earthy"], teaType: "Шу Пуэр", priority: 9 },
    { conditions: ["focus", "fresh"], teaType: "Шэн Пуэр", priority: 9 },
    { conditions: ["calm", "fresh"], teaType: "Шэн Пуэр", priority: 8 },
    { conditions: ["calm"], teaType: "Габа", priority: 7 },
    { conditions: ["energize"], teaType: "Красный чай", priority: 5 },
    { conditions: [], teaType: "Шу Пуэр", priority: 1 },
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
      (user) => user.phone === normalizePhone(phone),
    );
  }

  async searchUserByPhone(phone: string): Promise<User | undefined> {
    // Extract only digits for flexible search (supports partial phone numbers)
    const digitsOnly = phone.replace(/\D/g, '');
    // Require at least 3 digits to prevent false positives
    if (digitsOnly.length < 3) return undefined;
    
    return Array.from(this.users.values()).find(
      (user) => user.phone && user.phone.includes(digitsOnly),
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      name: insertUser.name ?? null,
      email: insertUser.email ?? null,
      phone: normalizePhone(insertUser.phone),
      phoneVerified: false,
      xp: 0,
      firstOrderDiscountUsed: false,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, data: { name?: string; phone?: string }): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updated: User = { 
      ...user, 
      ...data,
      phone: data.phone ? normalizePhone(data.phone) : user.phone,
    };
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

  async markFirstOrderDiscountUsed(userId: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    
    const updated: User = { ...user, firstOrderDiscountUsed: true };
    this.users.set(userId, updated);
    return updated;
  }

  async restoreFirstOrderDiscount(userId: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    
    const updated: User = { ...user, firstOrderDiscountUsed: false };
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

  async getOrders(statusFilter?: string, offset?: number, limit?: number): Promise<DbOrder[]> {
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
    usedFirstOrderDiscount?: boolean;
    receiptEmail?: string;
  }): Promise<DbOrder> {
    // MemStorage doesn't persist orders, return mock order
    return {
      id: 1,
      userId: orderData.userId ?? null,
      name: orderData.name,
      email: orderData.email,
      phone: normalizePhone(orderData.phone),
      address: orderData.address,
      comment: orderData.comment ?? null,
      items: orderData.items,
      total: orderData.total,
      status: "pending",
      usedFirstOrderDiscount: orderData.usedFirstOrderDiscount ?? false,
      paymentId: null,
      paymentStatus: null,
      paymentUrl: null,
      receiptEmail: orderData.receiptEmail ?? null,
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

  async updateCartItem(id: number, quantity: number, userId: string, pricePerUnit?: number): Promise<DbCartItem | undefined> {
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
      phone: normalizePhone(phone),
      code: hashedCode,
      type,
      attempts: 0,
      createdAt: new Date().toISOString(),
      expiresAt,
    };
  }

  async getSmsVerification(phone: string, type: "registration" | "password_reset"): Promise<SmsVerification | undefined> {
    // Normalize phone for lookup
    normalizePhone(phone);
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

  private xpTransactions: XpTransaction[] = [];
  private xpTransactionIdCounter: number = 1;

  async createXpTransaction(transaction: InsertXpTransaction): Promise<XpTransaction> {
    const newTransaction: XpTransaction = {
      id: this.xpTransactionIdCounter++,
      userId: transaction.userId,
      amount: transaction.amount,
      reason: transaction.reason,
      description: transaction.description,
      orderId: transaction.orderId ?? null,
      createdBy: transaction.createdBy ?? null,
      createdAt: new Date().toISOString(),
    };
    this.xpTransactions.push(newTransaction);
    return newTransaction;
  }

  async getXpTransactions(limit: number = 1000, offset: number = 0): Promise<Array<XpTransaction & { user: User }>> {
    const sorted = [...this.xpTransactions].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const sliced = sorted.slice(offset, offset + limit);
    return sliced.map(t => {
      const user = this.users.get(t.userId);
      return { ...t, user: user! };
    }).filter(t => t.user);
  }

  async getUserXpTransactions(userId: string): Promise<XpTransaction[]> {
    return this.xpTransactions
      .filter(t => t.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  
  async getMonthlyLeaderboard(): Promise<import("@shared/schema").LeaderboardEntry[]> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const userXpMap = new Map<string, number>();
    
    for (const t of this.xpTransactions) {
      const txDate = new Date(t.createdAt);
      if (txDate >= startOfMonth) {
        userXpMap.set(t.userId, (userXpMap.get(t.userId) || 0) + t.amount);
      }
    }
    
    const entries: import("@shared/schema").LeaderboardEntry[] = [];
    for (const [userId, xpThisMonth] of Array.from(userXpMap.entries())) {
      const user = this.users.get(userId);
      if (user && xpThisMonth > 0) {
        entries.push({
          rank: 0,
          userId,
          name: user.name || "Гость",
          xpThisMonth,
        });
      }
    }
    
    entries.sort((a, b) => b.xpThisMonth - a.xpThisMonth);
    entries.forEach((e, i) => e.rank = i + 1);
    
    return entries.slice(0, 10);
  }

  // TV Slides stubs for MemStorage
  private tvSlides: TvSlide[] = [];
  private tvSlideIdCounter: number = 1;

  async getTvSlides(activeOnly: boolean = false): Promise<TvSlide[]> {
    let slides = [...this.tvSlides];
    if (activeOnly) {
      slides = slides.filter(s => s.isActive);
    }
    return slides.sort((a, b) => a.orderIndex - b.orderIndex);
  }

  async getTvSlide(id: number): Promise<TvSlide | undefined> {
    return this.tvSlides.find(s => s.id === id);
  }

  async createTvSlide(slide: InsertTvSlide): Promise<TvSlide> {
    const newSlide: TvSlide = {
      id: this.tvSlideIdCounter++,
      type: slide.type || "image",
      imageUrl: slide.imageUrl ?? null,
      title: slide.title ?? null,
      durationSeconds: slide.durationSeconds ?? 60,
      orderIndex: slide.orderIndex ?? 0,
      isActive: slide.isActive ?? true,
      createdAt: new Date().toISOString(),
    };
    this.tvSlides.push(newSlide);
    return newSlide;
  }

  async updateTvSlide(id: number, slide: UpdateTvSlide): Promise<TvSlide | undefined> {
    const index = this.tvSlides.findIndex(s => s.id === id);
    if (index === -1) return undefined;
    this.tvSlides[index] = { ...this.tvSlides[index], ...slide };
    return this.tvSlides[index];
  }

  async deleteTvSlide(id: number): Promise<boolean> {
    const index = this.tvSlides.findIndex(s => s.id === id);
    if (index === -1) return false;
    this.tvSlides.splice(index, 1);
    return true;
  }

  async reorderTvSlides(orders: { id: number; orderIndex: number }[]): Promise<void> {
    for (const { id, orderIndex } of orders) {
      const slide = this.tvSlides.find(s => s.id === id);
      if (slide) {
        slide.orderIndex = orderIndex;
      }
    }
  }
}

import { db } from "./db";
import { users as usersTable, products as productsTable, settings as settingsTable, orders as ordersTable, teaTypes as teaTypesTable, cartItems as cartItemsTable, smsVerifications as smsVerificationsTable, siteSettings as siteSettingsTable, savedAddresses as savedAddressesTable, tvSlides as tvSlidesTable, experiments as experimentsTable, abEvents as abEventsTable, deviceUserMappings as deviceUserMappingsTable, media as mediaTable } from "@shared/schema";
import { eq, desc, and, sql, asc } from "drizzle-orm";
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
    const [user] = await db.select().from(usersTable).where(eq(usersTable.phone, normalizePhone(phone)));
    return user;
  }

  async searchUserByPhone(phone: string): Promise<User | undefined> {
    const { like } = await import("drizzle-orm");
    // Extract only digits for flexible search (supports partial phone numbers)
    const digitsOnly = phone.replace(/\D/g, '');
    // Require at least 3 digits to prevent false positives
    if (digitsOnly.length < 3) return undefined;
    
    const [user] = await db.select().from(usersTable).where(like(usersTable.phone, `%${digitsOnly}%`));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(usersTable).values({
      ...insertUser,
      phone: normalizePhone(insertUser.phone),
    }).returning();
    return user;
  }

  async updateUser(id: string, data: { name?: string; phone?: string }): Promise<User | undefined> {
    const [user] = await db
      .update(usersTable)
      .set({
        ...data,
        phone: data.phone ? normalizePhone(data.phone) : undefined,
      })
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

  async markFirstOrderDiscountUsed(userId: string): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(usersTable)
      .set({ firstOrderDiscountUsed: true })
      .where(eq(usersTable.id, userId))
      .returning();
    return updatedUser;
  }

  async restoreFirstOrderDiscount(userId: string): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(usersTable)
      .set({ firstOrderDiscountUsed: false })
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

  async getOrders(statusFilter?: string, offset: number = 0, limit: number = 10): Promise<DbOrder[]> {
    let query = db.select().from(ordersTable);
    
    if (statusFilter) {
      query = query.where(eq(ordersTable.status, statusFilter)) as any;
    }
    
    const orders = await query
      .orderBy(desc(ordersTable.createdAt))
      .limit(limit)
      .offset(offset);
    
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
    usedFirstOrderDiscount?: boolean;
    receiptEmail?: string;
  }): Promise<DbOrder> {
    const [order] = await db.insert(ordersTable).values({
      userId: orderData.userId ?? null,
      name: orderData.name,
      email: orderData.email,
      phone: normalizePhone(orderData.phone),
      address: orderData.address,
      comment: orderData.comment ?? null,
      items: orderData.items,
      total: orderData.total,
      usedFirstOrderDiscount: orderData.usedFirstOrderDiscount ?? false,
      receiptEmail: orderData.receiptEmail ?? null,
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
    
    // If order is being cancelled and it used the first order discount, restore the flag
    if (order && status === 'cancelled' && order.usedFirstOrderDiscount && order.userId) {
      await db
        .update(usersTable)
        .set({ firstOrderDiscountUsed: false })
        .where(eq(usersTable.id, order.userId));
    }
    
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
        pricePerUnit: cartItemsTable.pricePerUnit,
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

  async updateCartItem(id: number, quantity: number, userId: string, pricePerUnit?: number): Promise<DbCartItem | undefined> {
    const updateData: { quantity: number; pricePerUnit?: number } = { quantity };
    if (pricePerUnit !== undefined) {
      updateData.pricePerUnit = pricePerUnit;
    }
    const [item] = await db
      .update(cartItemsTable)
      .set(updateData)
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
        phone: normalizePhone(phone),
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
          eq(smsVerificationsTable.phone, normalizePhone(phone)),
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
          eq(smsVerificationsTable.phone, normalizePhone(phone)),
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

  async getSiteSettings(): Promise<import("@shared/schema").SiteSettings | undefined> {
    const [settings] = await db.select().from(siteSettingsTable).limit(1);
    
    // If no settings exist, create default settings
    if (!settings) {
      const [newSettings] = await db.insert(siteSettingsTable).values({
        contactEmail: 'SimonErmak@yandex.ru',
        contactPhone: '+79667364077',
        contactTelegram: '@HotlineEugene',
        deliveryInfo: 'Доставка осуществляется через CDEK, Яндекс или WB по всей России в течение 15 рабочих дней',
      }).returning();
      return newSettings;
    }
    
    return settings;
  }

  async updateSiteSettings(settings: import("@shared/schema").UpdateSiteSettings): Promise<import("@shared/schema").SiteSettings | undefined> {
    // Get first settings record
    const [existing] = await db.select().from(siteSettingsTable).limit(1);
    
    // If no settings exist, create default settings first
    if (!existing) {
      const [newSettings] = await db.insert(siteSettingsTable).values({
        contactEmail: settings.contactEmail || 'SimonErmak@yandex.ru',
        contactPhone: settings.contactPhone || '+79667364077',
        contactTelegram: settings.contactTelegram || '@HotlineEugene',
        deliveryInfo: settings.deliveryInfo || 'Доставка осуществляется через CDEK, Яндекс или WB по всей России в течение 15 рабочих дней',
      }).returning();
      return newSettings;
    }

    const [updated] = await db
      .update(siteSettingsTable)
      .set(settings)
      .where(eq(siteSettingsTable.id, existing.id))
      .returning();
    
    return updated;
  }

  async getSavedAddresses(userId: string): Promise<SavedAddress[]> {
    const addresses = await db
      .select()
      .from(savedAddressesTable)
      .where(eq(savedAddressesTable.userId, userId))
      .orderBy(desc(savedAddressesTable.isDefault), desc(savedAddressesTable.createdAt));
    
    return addresses;
  }

  async createSavedAddress(address: InsertSavedAddress): Promise<SavedAddress | null> {
    // Check if user already has 10 addresses
    const existingAddresses = await db
      .select()
      .from(savedAddressesTable)
      .where(eq(savedAddressesTable.userId, address.userId));
    
    if (existingAddresses.length >= 10) {
      return null;
    }

    // If this is marked as default, unset other default addresses
    if (address.isDefault) {
      await db
        .update(savedAddressesTable)
        .set({ isDefault: false })
        .where(eq(savedAddressesTable.userId, address.userId));
    }

    const [newAddress] = await db
      .insert(savedAddressesTable)
      .values(address)
      .returning();
    
    return newAddress;
  }

  async deleteSavedAddress(id: number, userId: string): Promise<boolean> {
    const result = await db
      .delete(savedAddressesTable)
      .where(
        and(
          eq(savedAddressesTable.id, id),
          eq(savedAddressesTable.userId, userId)
        )
      )
      .returning();
    
    return result.length > 0;
  }

  async setDefaultAddress(id: number, userId: string): Promise<SavedAddress | undefined> {
    // First, unset all default addresses for this user
    await db
      .update(savedAddressesTable)
      .set({ isDefault: false })
      .where(eq(savedAddressesTable.userId, userId));
    
    // Then set the specified address as default
    const [updatedAddress] = await db
      .update(savedAddressesTable)
      .set({ isDefault: true })
      .where(
        and(
          eq(savedAddressesTable.id, id),
          eq(savedAddressesTable.userId, userId)
        )
      )
      .returning();
    
    return updatedAddress;
  }

  // Info Banners
  async getInfoBanners(activeOnly: boolean = false): Promise<import("@shared/schema").InfoBanner[]> {
    const { infoBanners } = await import("@shared/schema");
    const { asc } = await import("drizzle-orm");
    
    let banners;
    if (activeOnly) {
      banners = await db.select().from(infoBanners)
        .where(eq(infoBanners.isActive, true))
        .orderBy(asc(infoBanners.desktopOrder));
    } else {
      banners = await db.select().from(infoBanners)
        .orderBy(asc(infoBanners.desktopOrder));
    }
    return banners;
  }

  async getInfoBanner(id: number): Promise<import("@shared/schema").InfoBanner | undefined> {
    const { infoBanners } = await import("@shared/schema");
    const [banner] = await db.select().from(infoBanners).where(eq(infoBanners.id, id));
    return banner;
  }

  async createInfoBanner(banner: import("@shared/schema").InsertInfoBanner): Promise<import("@shared/schema").InfoBanner> {
    const { infoBanners } = await import("@shared/schema");
    const [newBanner] = await db.insert(infoBanners).values(banner).returning();
    return newBanner;
  }

  async updateInfoBanner(id: number, banner: import("@shared/schema").UpdateInfoBanner): Promise<import("@shared/schema").InfoBanner | undefined> {
    const { infoBanners } = await import("@shared/schema");
    const [updated] = await db.update(infoBanners)
      .set(banner)
      .where(eq(infoBanners.id, id))
      .returning();
    return updated;
  }

  async deleteInfoBanner(id: number): Promise<boolean> {
    const { infoBanners } = await import("@shared/schema");
    const result = await db.delete(infoBanners).where(eq(infoBanners.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async reorderBanners(orders: { id: number; desktopOrder?: number; mobileOrder?: number; desktopSlot?: string; mobileSlot?: string }[]): Promise<void> {
    const { infoBanners } = await import("@shared/schema");
    for (const order of orders) {
      const updateData: any = {};
      if (order.desktopOrder !== undefined) updateData.desktopOrder = order.desktopOrder;
      if (order.mobileOrder !== undefined) updateData.mobileOrder = order.mobileOrder;
      if (order.desktopSlot !== undefined) updateData.desktopSlot = order.desktopSlot;
      if (order.mobileSlot !== undefined) updateData.mobileSlot = order.mobileSlot;
      
      if (Object.keys(updateData).length > 0) {
        await db.update(infoBanners)
          .set(updateData)
          .where(eq(infoBanners.id, order.id));
      }
    }
  }

  async createXpTransaction(transaction: InsertXpTransaction): Promise<XpTransaction> {
    const { xpTransactions } = await import("@shared/schema");
    const [newTransaction] = await db.insert(xpTransactions).values(transaction).returning();
    return newTransaction;
  }

  async getXpTransactions(limit: number = 1000, offset: number = 0): Promise<Array<XpTransaction & { user: User }>> {
    const { xpTransactions } = await import("@shared/schema");
    const transactions = await db
      .select()
      .from(xpTransactions)
      .leftJoin(usersTable, eq(xpTransactions.userId, usersTable.id))
      .orderBy(desc(xpTransactions.createdAt))
      .limit(limit)
      .offset(offset);
    
    return transactions.map(t => ({
      ...t.xp_transactions,
      user: t.users!,
    }));
  }

  async getUserXpTransactions(userId: string): Promise<XpTransaction[]> {
    const { xpTransactions } = await import("@shared/schema");
    return db
      .select()
      .from(xpTransactions)
      .where(eq(xpTransactions.userId, userId))
      .orderBy(desc(xpTransactions.createdAt));
  }

  async getMonthlyLeaderboard(): Promise<import("@shared/schema").LeaderboardEntry[]> {
    const { xpTransactions } = await import("@shared/schema");
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthStr = startOfMonth.toISOString();
    
    // Диагностика: получаем информацию о базе данных
    const dbInfoResult = await db.execute(sql`
      SELECT 
        NOW() as db_now,
        DATE_TRUNC('month', NOW()) as db_month_start,
        current_setting('TIMEZONE') as db_timezone,
        (SELECT COUNT(*) FROM xp_transactions) as total_transactions,
        (SELECT COUNT(*) FROM xp_transactions WHERE created_at::timestamp >= DATE_TRUNC('month', NOW())) as this_month_count,
        (SELECT MAX(created_at) FROM xp_transactions) as last_transaction_date
    `);
    const dbInfo = (dbInfoResult as any).rows?.[0] || (dbInfoResult as any)[0] || {};
    
    console.log("[Leaderboard] === DIAGNOSTIC INFO ===");
    console.log("[Leaderboard] Server time:", now.toISOString());
    console.log("[Leaderboard] Server timezone:", Intl.DateTimeFormat().resolvedOptions().timeZone);
    console.log("[Leaderboard] DB NOW():", dbInfo?.db_now);
    console.log("[Leaderboard] DB month start:", dbInfo?.db_month_start);
    console.log("[Leaderboard] DB timezone:", dbInfo?.db_timezone);
    console.log("[Leaderboard] Total transactions in DB:", dbInfo?.total_transactions);
    console.log("[Leaderboard] Transactions THIS MONTH:", dbInfo?.this_month_count);
    console.log("[Leaderboard] Last transaction date:", dbInfo?.last_transaction_date);
    console.log("[Leaderboard] ========================");
    
    // Используем DATE_TRUNC на стороне PostgreSQL для корректного сравнения
    const results = await db
      .select({
        userId: xpTransactions.userId,
        xpThisMonth: sql<number>`COALESCE(SUM(${xpTransactions.amount}), 0)`.as('xp_this_month'),
        name: usersTable.name,
      })
      .from(xpTransactions)
      .innerJoin(usersTable, eq(xpTransactions.userId, usersTable.id))
      .where(sql`${xpTransactions.createdAt}::timestamp >= DATE_TRUNC('month', NOW())`)
      .groupBy(xpTransactions.userId, usersTable.name)
      .having(sql`SUM(${xpTransactions.amount}) > 0`)
      .orderBy(sql`xp_this_month DESC`)
      .limit(10);
    
    console.log("[Leaderboard] Results count:", results.length);
    console.log("[Leaderboard] Full top-10:", results.map((r, i) => ({ rank: i + 1, name: r.name, xp: r.xpThisMonth })));
    
    return results.map((r, index) => ({
      rank: index + 1,
      userId: r.userId,
      name: r.name || "Гость",
      xpThisMonth: Number(r.xpThisMonth),
    }));
  }

  // TV Slides implementation for DbStorage
  async getTvSlides(activeOnly: boolean = false): Promise<TvSlide[]> {
    let query = db.select().from(tvSlidesTable);
    if (activeOnly) {
      return db.select().from(tvSlidesTable).where(eq(tvSlidesTable.isActive, true)).orderBy(asc(tvSlidesTable.orderIndex));
    }
    return db.select().from(tvSlidesTable).orderBy(asc(tvSlidesTable.orderIndex));
  }

  async getTvSlide(id: number): Promise<TvSlide | undefined> {
    const [slide] = await db.select().from(tvSlidesTable).where(eq(tvSlidesTable.id, id));
    return slide;
  }

  async createTvSlide(slide: InsertTvSlide): Promise<TvSlide> {
    const [newSlide] = await db.insert(tvSlidesTable).values({
      type: slide.type || "image",
      imageUrl: slide.imageUrl,
      title: slide.title,
      durationSeconds: slide.durationSeconds ?? 60,
      orderIndex: slide.orderIndex ?? 0,
      isActive: slide.isActive ?? true,
    }).returning();
    return newSlide;
  }

  async updateTvSlide(id: number, slide: UpdateTvSlide): Promise<TvSlide | undefined> {
    const [updated] = await db.update(tvSlidesTable).set(slide).where(eq(tvSlidesTable.id, id)).returning();
    return updated;
  }

  async deleteTvSlide(id: number): Promise<boolean> {
    const result = await db.delete(tvSlidesTable).where(eq(tvSlidesTable.id, id)).returning();
    return result.length > 0;
  }

  async reorderTvSlides(orders: { id: number; orderIndex: number }[]): Promise<void> {
    for (const { id, orderIndex } of orders) {
      await db.update(tvSlidesTable).set({ orderIndex }).where(eq(tvSlidesTable.id, id));
    }
  }

  // A/B Testing - Experiments
  async getExperiments(): Promise<Experiment[]> {
    return db.select().from(experimentsTable).orderBy(desc(experimentsTable.id));
  }

  async getActiveExperiments(): Promise<Experiment[]> {
    return db.select().from(experimentsTable).where(eq(experimentsTable.status, "active")).orderBy(desc(experimentsTable.id));
  }

  async getExperiment(id: number): Promise<Experiment | undefined> {
    const [experiment] = await db.select().from(experimentsTable).where(eq(experimentsTable.id, id));
    return experiment;
  }

  async getExperimentByTestId(testId: string): Promise<Experiment | undefined> {
    const [experiment] = await db.select().from(experimentsTable).where(eq(experimentsTable.testId, testId));
    return experiment;
  }

  async createExperiment(experiment: InsertExperiment): Promise<Experiment> {
    const [newExperiment] = await db.insert(experimentsTable).values({
      testId: experiment.testId,
      name: experiment.name,
      description: experiment.description,
      status: experiment.status || "inactive",
      variants: experiment.variants,
    }).returning();
    return newExperiment;
  }

  async updateExperiment(id: number, experiment: UpdateExperiment): Promise<Experiment | undefined> {
    const updateData: any = { ...experiment, updatedAt: new Date().toISOString() };
    const [updated] = await db.update(experimentsTable).set(updateData).where(eq(experimentsTable.id, id)).returning();
    return updated;
  }

  async deleteExperiment(id: number): Promise<boolean> {
    const result = await db.delete(experimentsTable).where(eq(experimentsTable.id, id)).returning();
    return result.length > 0;
  }

  // A/B Testing - Events
  async createAbEvent(event: InsertAbEvent): Promise<AbEvent> {
    const [newEvent] = await db.insert(abEventsTable).values({
      eventType: event.eventType,
      userIdentifier: event.userIdentifier,
      userId: event.userId,
      deviceId: event.deviceId,
      testAssignments: event.testAssignments,
      eventData: event.eventData,
    }).returning();
    return newEvent;
  }

  async getAbEvents(limit: number = 100, offset: number = 0): Promise<AbEvent[]> {
    return db.select().from(abEventsTable).orderBy(desc(abEventsTable.id)).limit(limit).offset(offset);
  }

  // A/B Testing - Device/User Mapping
  async createDeviceUserMapping(deviceId: string, userId: string): Promise<DeviceUserMapping> {
    // Upsert - update if exists, insert if not
    const existing = await this.getDeviceUserMapping(deviceId);
    if (existing) {
      return existing;
    }
    const [mapping] = await db.insert(deviceUserMappingsTable).values({
      deviceId,
      userId,
    }).returning();
    return mapping;
  }

  async getDeviceUserMapping(deviceId: string): Promise<DeviceUserMapping | undefined> {
    const [mapping] = await db.select().from(deviceUserMappingsTable).where(eq(deviceUserMappingsTable.deviceId, deviceId));
    return mapping;
  }

  // Media (Video Gallery)
  async getMedia(productId?: number): Promise<Media[]> {
    if (productId) {
      return db.select().from(mediaTable).where(eq(mediaTable.productId, productId)).orderBy(asc(mediaTable.displayOrder));
    }
    return db.select().from(mediaTable).orderBy(asc(mediaTable.displayOrder));
  }

  async getFeaturedMedia(): Promise<(Media & { product: Product })[]> {
    const results = await db
      .select({
        media: mediaTable,
        product: productsTable,
      })
      .from(mediaTable)
      .innerJoin(productsTable, eq(mediaTable.productId, productsTable.id))
      .where(eq(mediaTable.featured, true))
      .orderBy(asc(mediaTable.displayOrder));
    
    return results.map(r => ({ ...r.media, product: r.product }));
  }

  async getMediaItem(id: number): Promise<Media | undefined> {
    const [item] = await db.select().from(mediaTable).where(eq(mediaTable.id, id));
    return item;
  }

  async createMedia(mediaData: InsertMedia): Promise<Media> {
    const [newMedia] = await db.insert(mediaTable).values({
      productId: mediaData.productId,
      type: mediaData.type,
      title: mediaData.title,
      description: mediaData.description,
      source: mediaData.source,
      sourceType: mediaData.sourceType,
      thumbnail: mediaData.thumbnail,
      featured: mediaData.featured ?? true,
      displayOrder: mediaData.displayOrder ?? 0,
    }).returning();
    return newMedia;
  }

  async updateMedia(id: number, mediaData: UpdateMedia): Promise<Media | undefined> {
    const updateData: any = { ...mediaData, updatedAt: new Date().toISOString() };
    const [updated] = await db.update(mediaTable).set(updateData).where(eq(mediaTable.id, id)).returning();
    return updated;
  }

  async deleteMedia(id: number): Promise<boolean> {
    const result = await db.delete(mediaTable).where(eq(mediaTable.id, id)).returning();
    return result.length > 0;
  }

  async reorderMedia(orders: { id: number; displayOrder: number }[]): Promise<void> {
    for (const order of orders) {
      await db.update(mediaTable).set({ displayOrder: order.displayOrder, updatedAt: new Date().toISOString() }).where(eq(mediaTable.id, order.id));
    }
  }
}

// Use database storage instead of memory storage
export const storage = new DbStorage();
