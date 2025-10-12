import { type User, type InsertUser, type QuizConfig, type Product, type InsertProduct } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getQuizConfig(): Promise<QuizConfig>;
  updateQuizConfig(config: QuizConfig): Promise<QuizConfig>;
  
  // Products
  getProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: InsertProduct): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;
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

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private quizConfig: QuizConfig;
  private products: Map<number, Product>;
  private productIdCounter: number;

  constructor() {
    this.users = new Map();
    this.quizConfig = defaultQuizConfig;
    this.products = new Map();
    this.productIdCounter = 1;
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
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
    const product: Product = { ...insertProduct, id };
    this.products.set(id, product);
    return product;
  }

  async updateProduct(id: number, insertProduct: InsertProduct): Promise<Product | undefined> {
    const existing = this.products.get(id);
    if (!existing) return undefined;
    
    const updated: Product = { ...insertProduct, id };
    this.products.set(id, updated);
    return updated;
  }

  async deleteProduct(id: number): Promise<boolean> {
    return this.products.delete(id);
  }
}

import { db } from "./db";
import { users as usersTable, products as productsTable } from "@shared/schema";
import { eq } from "drizzle-orm";

export class DbStorage implements IStorage {
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
          effects: ['Бодрит', 'Концентрирует']
        },
        {
          name: 'Шэн Пуэр Дикие деревья',
          description: 'Редкий Шэн Пуэр с дикорастущих деревьев. Свежий цветочно-медовый аромат с долгим послевкусием. Для истинных ценителей.',
          pricePerGram: 28.00,
          images: [],
          teaType: 'Шэн Пуэр',
          effects: ['Концентрирует', 'Расслабляет']
        },
        {
          name: 'Белый Пуэр Лунный свет',
          description: 'Деликатный белый пуэр с мягким сладковатым вкусом. Легкий цветочный аромат успокаивает и гармонизирует.',
          pricePerGram: 22.50,
          images: [],
          teaType: 'Белый Пуэр',
          effects: ['Успокаивает', 'Расслабляет']
        },
        {
          name: 'Красный Пуэр Императорский',
          description: 'Премиальный красный пуэр глубокой ферментации. Бархатистый вкус с нотками сухофруктов и специй.',
          pricePerGram: 35.00,
          images: [],
          teaType: 'Красный Пуэр',
          effects: ['Согревает', 'Тонизирует']
        },
        {
          name: 'Чёрный Пуэр Старые головы',
          description: 'Насыщенный чёрный пуэр из крупных листьев. Глубокий вкус с оттенками шоколада и карамели.',
          pricePerGram: 18.75,
          images: [],
          teaType: 'Чёрный Пуэр',
          effects: ['Бодрит', 'Согревает']
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

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(usersTable).values(insertUser).returning();
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
}

// Use database storage instead of memory storage
export const storage = new DbStorage();
