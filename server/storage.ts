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

export const storage = new MemStorage();
