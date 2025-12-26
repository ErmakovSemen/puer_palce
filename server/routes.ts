import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { quizConfigSchema, insertProductSchema, orderSchema, updateSettingsSchema, insertTeaTypeSchema, updateOrderStatusSchema, insertCartItemSchema, updateCartItemSchema, updateSiteSettingsSchema, insertSavedAddressSchema } from "@shared/schema";
import multer from "multer";
import { randomUUID } from "crypto";
import { ObjectStorageService } from "./objectStorage";
import { sendOrderNotification } from "./resend";
import { setupAuth } from "./auth";
import { normalizePhone } from "./utils";
import { getTelegramUpdates, sendOrderNotification as sendTelegramOrderNotification, sendFailedReceiptSmsNotification } from "./telegram";
import { handleWebhookUpdate, setWebhook, getWebhookInfo } from "./services/telegramBot";
import { createMagicLink, getUserTelegramProfile, unlinkTelegram } from "./services/magicLink";
import { getLoyaltyDiscount } from "@shared/loyalty";
import { db } from "./db";
import { users as usersTable, orders as ordersTable, walletTransactions, pendingTelegramOrders as pendingTelegramOrdersTable, telegramCart as telegramCartTable } from "@shared/schema";
import { eq, sql, desc, and } from "drizzle-orm";
import { getTinkoffClient } from "./tinkoff";
import { sendReceiptSms } from "./sms-ru";

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Admin authentication middleware
function requireAdminAuth(req: any, res: any, next: any) {
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123"; // Default for development
  const providedPassword = req.headers["x-admin-password"];
  
  if (providedPassword !== adminPassword) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  
  next();
}

// User authentication middleware
function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    res.status(401).json({ error: "Необходимо войти в систему" });
    return;
  }
  next();
}

// Helper function to escape XML special characters
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Receipt fallback system - Tinkoff RECEIPT webhooks may be delayed or missed
// This polls GetState API as backup, but checks DB before sending to prevent duplicates
async function checkAndSendReceiptFallback(
  orderId: number, 
  paymentId: string, 
  customerPhone: string, 
  attemptNumber: number
): Promise<boolean> {
  try {
    console.log(`[Receipt Fallback #${attemptNumber}] Checking receipt for order ${orderId}`);
    
    // CRITICAL: Check if SMS already sent using the flag
    const existingOrder = await db.query.orders.findFirst({
      where: eq(ordersTable.id, orderId),
      columns: { receiptUrl: true, receiptSmsSent: true }
    });
    
    if (existingOrder?.receiptSmsSent) {
      console.log(`[Receipt Fallback #${attemptNumber}] SMS already sent for order ${orderId}, stopping`);
      return true; // Already done, stop fallback
    }
    
    const tinkoffClient = getTinkoffClient();
    const paymentState = await tinkoffClient.getState(paymentId);
    
    // Extract receipt URL from GetState response
    let receiptUrl: string | null = null;
    
    if (paymentState.Receipts && Array.isArray(paymentState.Receipts) && paymentState.Receipts.length > 0) {
      const receiptWithUrl = paymentState.Receipts.find((r: any) => r.Url);
      if (receiptWithUrl) {
        receiptUrl = receiptWithUrl.Url;
      }
    }
    
    if (!receiptUrl) {
      if (typeof paymentState.Receipt === 'string') {
        receiptUrl = paymentState.Receipt;
      } else if (paymentState.Receipt?.Url) {
        receiptUrl = paymentState.Receipt.Url;
      } else if (paymentState.ReceiptUrl) {
        receiptUrl = paymentState.ReceiptUrl;
      }
    }
    
    if (receiptUrl) {
      console.log(`[Receipt Fallback #${attemptNumber}] Receipt URL found:`, receiptUrl);
      
      // ATOMIC: Try to claim SMS sending rights with conditional update
      // Only updates if receiptSmsSent is still false (prevents race conditions)
      const updateResult = await db.update(ordersTable)
        .set({ receiptUrl: receiptUrl, receiptSmsSent: true })
        .where(and(eq(ordersTable.id, orderId), eq(ordersTable.receiptSmsSent, false)));
      
      // Check if we won the race (row was updated)
      if (updateResult.rowCount === 0) {
        console.log(`[Receipt Fallback #${attemptNumber}] SMS already sent (lost race), stopping`);
        return true;
      }
      
      console.log(`[Receipt Fallback #${attemptNumber}] Won SMS race - sending SMS`);
      
      // Send SMS
      try {
        const normalizedPhone = normalizePhone(customerPhone);
        await sendReceiptSms(normalizedPhone, receiptUrl, orderId);
        console.log(`[Receipt Fallback #${attemptNumber}] ✅ SMS sent for order ${orderId}`);
        return true;
      } catch (error) {
        console.error(`[Receipt Fallback #${attemptNumber}] SMS failed for order ${orderId}:`, error);
        // Reset flag so next timer can retry
        await db.update(ordersTable)
          .set({ receiptSmsSent: false })
          .where(eq(ordersTable.id, orderId));
        const smsText = `Спасибо за заказ #${orderId}! Ваш чек: ${receiptUrl}`;
        await sendFailedReceiptSmsNotification(orderId, customerPhone, smsText);
        return false; // Return false so next timer can retry
      }
    } else {
      console.log(`[Receipt Fallback #${attemptNumber}] Receipt not ready for order ${orderId}`);
      return false;
    }
  } catch (error) {
    console.error(`[Receipt Fallback #${attemptNumber}] Error for order ${orderId}:`, error);
    return false;
  }
}

// Track active fallback timers to cancel when webhook delivers first
const activeFallbackTimers = new Map<number, NodeJS.Timeout[]>();

// Cancel all pending fallback timers for an order (called when webhook delivers receipt)
function cancelReceiptFallback(orderId: number): void {
  const timers = activeFallbackTimers.get(orderId);
  if (timers) {
    timers.forEach(t => clearTimeout(t));
    activeFallbackTimers.delete(orderId);
    console.log(`[Receipt Fallback] Cancelled pending timers for order ${orderId}`);
  }
}

// Schedule fallback receipt checks (only runs if RECEIPT webhook doesn't arrive first)
function scheduleReceiptFallback(orderId: number, paymentId: string, customerPhone: string): void {
  // Cancel any existing timers for this order first (prevent duplicate scheduling)
  cancelReceiptFallback(orderId);
  
  // Delays: 3min, 7min, 12min after CONFIRMED (giving webhook time to arrive first)
  const delays = [3, 7, 12]; // minutes
  
  console.log(`[Receipt Fallback] Scheduled for order ${orderId} at: +3min, +7min, +12min`);
  
  const timers: NodeJS.Timeout[] = [];
  
  delays.forEach((delayMinutes, index) => {
    const timer = setTimeout(async () => {
      const attemptNumber = index + 1;
      const success = await checkAndSendReceiptFallback(orderId, paymentId, customerPhone, attemptNumber);
      
      if (success) {
        console.log(`[Receipt Fallback #${attemptNumber}] Complete for order ${orderId}`);
        // Cancel remaining timers
        cancelReceiptFallback(orderId);
      } else if (attemptNumber === delays.length) {
        console.error(`[Receipt Fallback] CRITICAL: All attempts exhausted for order ${orderId}`);
        const smsText = `Спасибо за заказ #${orderId}! Ваш чек: [см. ЛК Tinkoff]`;
        await sendFailedReceiptSmsNotification(orderId, customerPhone, smsText);
        activeFallbackTimers.delete(orderId);
      }
    }, delayMinutes * 60 * 1000);
    timers.push(timer);
  });
  
  activeFallbackTimers.set(orderId, timers);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup user authentication (email/password)
  setupAuth(app);
  
  // Goal tracking endpoints for Yandex Metrica (form submission type goals)
  // These endpoints accept POST from forms and return minimal HTML response
  app.post("/goal/cart", (_req, res) => {
    res.status(200).send("<!DOCTYPE html><html><head><title>Goal</title></head><body>OK</body></html>");
  });
  
  app.post("/goal/payment", (_req, res) => {
    res.status(200).send("<!DOCTYPE html><html><head><title>Goal</title></head><body>OK</body></html>");
  });
  
  app.post("/goal/registration", (_req, res) => {
    res.status(200).send("<!DOCTYPE html><html><head><title>Goal</title></head><body>OK</body></html>");
  });
  
  app.post("/goal/contact", (_req, res) => {
    res.status(200).send("<!DOCTYPE html><html><head><title>Goal</title></head><body>OK</body></html>");
  });
  
  app.post("/goal/quiz", (_req, res) => {
    res.status(200).send("<!DOCTYPE html><html><head><title>Goal</title></head><body>OK</body></html>");
  });
  
  // Also handle GET requests for goal pages (needed for Yandex Metrica visual editor)
  app.get("/goal/cart", (_req, res) => {
    res.status(200).send(`<!DOCTYPE html><html><head><title>Cart Goal</title></head><body>
      <form id="goal-cart-form" action="/goal/cart" method="POST">
        <input type="hidden" name="goal" value="cart" />
        <button type="submit">Submit</button>
      </form>
    </body></html>`);
  });
  
  app.get("/goal/payment", (_req, res) => {
    res.status(200).send(`<!DOCTYPE html><html><head><title>Payment Goal</title></head><body>
      <form id="goal-payment-form" action="/goal/payment" method="POST">
        <input type="hidden" name="goal" value="payment" />
        <button type="submit">Submit</button>
      </form>
    </body></html>`);
  });
  
  app.get("/goal/registration", (_req, res) => {
    res.status(200).send(`<!DOCTYPE html><html><head><title>Registration Goal</title></head><body>
      <form id="goal-registration-form" action="/goal/registration" method="POST">
        <input type="hidden" name="goal" value="registration" />
        <button type="submit">Submit</button>
      </form>
    </body></html>`);
  });
  
  app.get("/goal/contact", (_req, res) => {
    res.status(200).send(`<!DOCTYPE html><html><head><title>Contact Goal</title></head><body>
      <form id="goal-contact-form" name="contact-telegram" action="/goal/contact" method="POST">
        <input type="hidden" name="goal" value="contact" />
        <input type="hidden" name="form_name" value="contact-telegram" />
        <button type="submit">Написать в Telegram</button>
      </form>
    </body></html>`);
  });
  
  app.get("/goal/quiz", (_req, res) => {
    res.status(200).send(`<!DOCTYPE html><html><head><title>Quiz Goal</title></head><body>
      <form id="goal-quiz-form" name="quiz-tea-selection" action="/goal/quiz" method="POST">
        <input type="hidden" name="goal" value="quiz" />
        <input type="hidden" name="form_name" value="quiz-tea-selection" />
        <button type="submit">Подобрать чай</button>
      </form>
    </body></html>`);
  });
  
  // Admin auth verification endpoint
  app.post("/api/auth/verify", requireAdminAuth, async (_req, res) => {
    // If middleware passes, password is correct
    res.json({ valid: true });
  });

  // Quiz config routes
  app.get("/api/quiz/config", async (_req, res) => {
    try {
      const config = await storage.getQuizConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: "Failed to get quiz config" });
    }
  });

  app.put("/api/quiz/config", requireAdminAuth, async (req, res) => {
    try {
      const config = quizConfigSchema.parse(req.body);
      const updated = await storage.updateQuizConfig(config);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid quiz config" });
    }
  });

  // Settings routes
  app.get("/api/settings", async (_req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to get settings" });
    }
  });

  app.put("/api/settings", requireAdminAuth, async (req, res) => {
    try {
      const settingsData = updateSettingsSchema.parse(req.body);
      const updated = await storage.updateSettings(settingsData);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid settings data" });
    }
  });

  // Product routes
  app.get("/api/products", async (_req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Failed to get products" });
    }
  });

  // Get all unique tags (types and effects) from products
  app.get("/api/tags", async (_req, res) => {
    try {
      const products = await storage.getProducts();
      
      // Extract unique types
      const types = Array.from(new Set(products.map(p => p.teaType).filter(Boolean)));
      
      // Extract unique effects
      const effectsSet = new Set<string>();
      products.forEach(p => {
        if (p.effects) {
          p.effects.forEach(effect => effectsSet.add(effect));
        }
      });
      const effects = Array.from(effectsSet);
      
      res.json({ types, effects });
    } catch (error) {
      res.status(500).json({ error: "Failed to get tags" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.getProduct(id);
      if (!product) {
        res.status(404).json({ error: "Product not found" });
        return;
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: "Failed to get product" });
    }
  });

  app.post("/api/products", requireAdminAuth, async (req, res) => {
    try {
      console.log("[Products] Creating product with data:", req.body);
      const product = insertProductSchema.parse(req.body);
      console.log("[Products] Validation passed, creating product");
      const created = await storage.createProduct(product);
      console.log("[Products] Product created:", created);
      res.status(201).json(created);
    } catch (error) {
      console.error("[Products] Validation error:", error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(400).json({ error: "Invalid product data" });
      }
    }
  });

  app.put("/api/products/:id", requireAdminAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const product = insertProductSchema.parse(req.body);
      const updated = await storage.updateProduct(id, product);
      if (!updated) {
        res.status(404).json({ error: "Product not found" });
        return;
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid product data" });
    }
  });

  app.delete("/api/products/:id", requireAdminAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteProduct(id);
      if (!deleted) {
        res.status(404).json({ error: "Product not found" });
        return;
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // Helper function to generate YML feed
  async function generateYMLFeed(baseUrl: string): Promise<string> {
    const products = await storage.getProducts();
    
    // Get current date in ISO format
    const currentDate = new Date().toISOString().split('T')[0] + ' ' + 
                        new Date().toTimeString().split(' ')[0];
    
    // Build YML catalog
    let yml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    yml += `<yml_catalog date="${currentDate}">\n`;
    yml += '  <shop>\n';
    yml += '    <name>Пуэр Паб</name>\n';
    yml += '    <company>Пуэр Паб</company>\n';
    yml += `    <url>${baseUrl}</url>\n`;
    yml += '    <currencies>\n';
    yml += '      <currency id="RUB" rate="1"/>\n';
    yml += '    </currencies>\n';
    yml += '    <categories>\n';
    yml += '      <category id="1">Чай</category>\n';
    yml += '      <category id="2">Чайная посуда</category>\n';
    yml += '    </categories>\n';
    yml += '    <offers>\n';
    
    // Add each product as an offer
    products.forEach(product => {
      const categoryId = product.category === 'tea' ? '1' : '2';
      
      // Calculate price based on category
      let price: string;
      let weightParam: string | null = null;
      
      if (product.category === 'teaware') {
        // For teaware: pricePerGram is actually price per piece
        price = product.pricePerGram.toFixed(2);
      } else {
        // For tea: use minimum available quantity or 100g as base
        const minQuantity = product.availableQuantities && product.availableQuantities.length > 0
          ? Math.min(...product.availableQuantities.map(q => parseInt(q)))
          : 100;
        price = (product.pricePerGram * minQuantity).toFixed(2);
        weightParam = `${minQuantity}`;
      }
      
      yml += `      <offer id="${product.id}" available="true">\n`;
      yml += `        <url>${baseUrl}/product/${product.id}</url>\n`;
      yml += `        <name>${escapeXml(product.name)}</name>\n`;
      yml += `        <vendor>Пуэр Паб</vendor>\n`;
      yml += `        <price>${price}</price>\n`;
      yml += `        <currencyId>RUB</currencyId>\n`;
      yml += `        <categoryId>${categoryId}</categoryId>\n`;
      
      // Add images
      if (product.images && product.images.length > 0) {
        product.images.forEach(image => {
          const imageUrl = image.startsWith('http') ? image : `${baseUrl}${image}`;
          yml += `        <picture>${escapeXml(imageUrl)}</picture>\n`;
        });
      }
      
      // Add description
      yml += `        <description>${escapeXml(product.description)}</description>\n`;
      
      // Add tea type as param
      yml += `        <param name="Тип">${escapeXml(product.teaType)}</param>\n`;
      
      // Add category as param
      const categoryName = product.category === 'tea' ? 'Чай' : 'Чайная посуда';
      yml += `        <param name="Категория">${escapeXml(categoryName)}</param>\n`;
      
      // Add weight param for tea (indicates the weight for the listed price)
      if (weightParam) {
        yml += `        <param name="Вес">${weightParam}г</param>\n`;
      }
      
      // Add effects if present
      if (product.effects && product.effects.length > 0) {
        yml += `        <param name="Эффекты">${escapeXml(product.effects.join(', '))}</param>\n`;
      }
      
      // Add available quantities for tea
      if (product.category === 'tea' && product.availableQuantities && product.availableQuantities.length > 0) {
        yml += `        <param name="Доступные количества">${escapeXml(product.availableQuantities.join('г, '))}г</param>\n`;
      }
      
      yml += '      </offer>\n';
    });
    
    yml += '    </offers>\n';
    yml += '  </shop>\n';
    yml += '</yml_catalog>\n';
    
    return yml;
  }

  // YML feed endpoint (for marketplaces to fetch dynamically)
  app.get("/api/yml-feed", async (req, res) => {
    try {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const yml = await generateYMLFeed(baseUrl);
      
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.send(yml);
    } catch (error) {
      console.error('[YML Feed] Error:', error);
      res.status(500).json({ error: "Failed to generate YML feed" });
    }
  });

  // Export products to YML format (for file download)
  app.get("/api/products/export/yml", async (req, res) => {
    try {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const yml = await generateYMLFeed(baseUrl);
      
      // Set headers for file download
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="products.yml"');
      res.send(yml);
    } catch (error) {
      console.error('[YML Export] Error:', error);
      res.status(500).json({ error: "Failed to generate YML export" });
    }
  });

  // Image upload route (protected - only for admin)
  app.post("/api/upload", requireAdminAuth, upload.array("images", 10), async (req, res) => {
    try {
      console.log("[Upload] Received upload request");
      
      if (!req.files || !Array.isArray(req.files)) {
        console.log("[Upload] No files in request");
        res.status(400).json({ error: "No files uploaded" });
        return;
      }

      console.log(`[Upload] Processing ${req.files.length} files`);
      const sharp = (await import('sharp')).default;
      const objectStorageService = new ObjectStorageService();
      const uploadedUrls: string[] = [];

      for (const file of req.files) {
        const filename = `${randomUUID()}.webp`;
        console.log(`[Upload] Converting and uploading file: ${filename}`);
        
        // Convert image to WebP format with quality 80 and max dimension 1920px
        const webpBuffer = await sharp(file.buffer)
          .resize(1920, 1920, { 
            fit: 'inside', 
            withoutEnlargement: true 
          })
          .webp({ quality: 80 })
          .toBuffer();
        
        console.log(`[Upload] Original size: ${file.size} bytes, WebP size: ${webpBuffer.length} bytes`);
        const url = await objectStorageService.uploadPublicObject(webpBuffer, filename);
        console.log(`[Upload] File uploaded: ${url}`);
        uploadedUrls.push(url);
      }

      console.log(`[Upload] Success! URLs:`, uploadedUrls);
      res.json({ urls: uploadedUrls });
    } catch (error) {
      console.error("[Upload] Error:", error);
      res.status(500).json({ error: "Failed to upload files" });
    }
  });

  // Serve public objects (with HEIC to WebP conversion)
  app.get("/public/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    const objectStorageService = new ObjectStorageService();
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      
      // Check if file is HEIC - convert to WebP for better compatibility
      const isHeic = filePath.toLowerCase().endsWith('.heic');
      if (isHeic) {
        try {
          const sharp = (await import('sharp')).default;
          const [buffer] = await file.download();
          
          const webpBuffer = await sharp(buffer)
            .resize(1920, 1920, { 
              fit: 'inside', 
              withoutEnlargement: true 
            })
            .webp({ quality: 80 })
            .toBuffer();
          
          res.set({
            "Content-Type": "image/webp",
            "Content-Length": webpBuffer.length,
            "Cache-Control": "public, max-age=31536000", // Cache for 1 year
          });
          res.send(webpBuffer);
          return;
        } catch (conversionError) {
          console.error("[Public] HEIC conversion failed, serving original:", conversionError);
          // Fallback to original file
        }
      }
      
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Tea Types routes
  app.get("/api/tea-types", async (_req, res) => {
    try {
      const teaTypes = await storage.getTeaTypes();
      res.json(teaTypes);
    } catch (error) {
      res.status(500).json({ error: "Failed to get tea types" });
    }
  });

  app.post("/api/tea-types", requireAdminAuth, async (req, res) => {
    try {
      const teaTypeData = insertTeaTypeSchema.parse(req.body);
      const teaType = await storage.createTeaType(teaTypeData);
      res.json(teaType);
    } catch (error) {
      res.status(400).json({ error: "Invalid tea type data" });
    }
  });

  app.put("/api/tea-types/:id", requireAdminAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const teaTypeData = insertTeaTypeSchema.parse(req.body);
      const updated = await storage.updateTeaType(id, teaTypeData);
      if (!updated) {
        res.status(404).json({ error: "Tea type not found" });
        return;
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid tea type data" });
    }
  });

  app.delete("/api/tea-types/:id", requireAdminAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteTeaType(id);
      if (!deleted) {
        res.status(404).json({ error: "Tea type not found" });
        return;
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete tea type" });
    }
  });

  // Get user orders (requires auth)
  app.get("/api/orders", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Необходима авторизация" });
    }
    
    try {
      const userId = (req.user as any).id;
      const orders = await storage.getUserOrders(userId);
      res.json(orders);
    } catch (error) {
      console.error("[Orders] Failed to get user orders:", error);
      res.status(500).json({ error: "Ошибка получения заказов" });
    }
  });

  // Get personalized product recommendations based on purchase history (requires auth)
  app.get("/api/recommendations", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Необходима авторизация" });
    }
    
    try {
      const userId = (req.user as any).id;
      
      // Get user's completed/paid orders
      const userOrders = await storage.getUserOrders(userId);
      const completedOrders = userOrders.filter((order: any) => 
        order.status === 'paid' || order.status === 'completed'
      );
      
      // If no purchases yet, return empty recommendations
      if (completedOrders.length === 0) {
        return res.json([]);
      }
      
      // Extract product IDs from order items
      const purchasedProductIds = new Set<number>();
      completedOrders.forEach((order: any) => {
        try {
          const items = JSON.parse(order.items);
          items.forEach((item: any) => {
            if (item.id) {
              purchasedProductIds.add(item.id);
            }
          });
        } catch (e) {
          console.error("[Recommendations] Failed to parse order items:", e);
        }
      });
      
      // Get all products
      const allProducts = await storage.getProducts();
      
      // Get details of purchased products
      const purchasedProducts = allProducts.filter((p: any) => 
        purchasedProductIds.has(p.id)
      );
      
      // Analyze user preferences
      const teaTypePreferences = new Map<string, number>();
      const effectPreferences = new Map<string, number>();
      let categoryPreference = 'tea';
      
      purchasedProducts.forEach((product: any) => {
        // Count tea types
        if (product.teaType) {
          teaTypePreferences.set(
            product.teaType, 
            (teaTypePreferences.get(product.teaType) || 0) + 1
          );
        }
        
        // Count effects
        if (product.effects && Array.isArray(product.effects)) {
          product.effects.forEach((effect: string) => {
            effectPreferences.set(effect, (effectPreferences.get(effect) || 0) + 1);
          });
        }
        
        // Track category
        if (product.category) {
          categoryPreference = product.category;
        }
      });
      
      // Score and rank products
      const scoredProducts = allProducts
        .filter((p: any) => 
          !purchasedProductIds.has(p.id) && // Exclude already purchased
          !p.outOfStock // Exclude out of stock
        )
        .map((product: any) => {
          let score = 0;
          
          // Same tea type gets high score
          if (product.teaType && teaTypePreferences.has(product.teaType)) {
            score += (teaTypePreferences.get(product.teaType) || 0) * 10;
          }
          
          // Matching effects get points
          if (product.effects && Array.isArray(product.effects)) {
            product.effects.forEach((effect: string) => {
              if (effectPreferences.has(effect)) {
                score += (effectPreferences.get(effect) || 0) * 5;
              }
            });
          }
          
          // Same category gets bonus
          if (product.category === categoryPreference) {
            score += 3;
          }
          
          return { ...product, score };
        })
        .filter((p: any) => p.score > 0) // Only include products with some relevance
        .sort((a: any, b: any) => b.score - a.score) // Sort by score descending
        .slice(0, 6); // Top 6 recommendations
      
      // Remove score from response
      const recommendations = scoredProducts.map(({ score, ...product }) => product);
      
      res.json(recommendations);
    } catch (error) {
      console.error("[Recommendations] Failed to get recommendations:", error);
      res.status(500).json({ error: "Ошибка получения рекомендаций" });
    }
  });

  // Order placement route
  app.post("/api/orders", async (req, res) => {
    try {
      console.log("[Order] Received new order request");
      const orderData = orderSchema.parse(req.body);
      console.log("[Order] Order validated:", {
        customer: orderData.name,
        itemCount: orderData.items.length,
        total: orderData.total
      });
      
      // Get userId and user if authenticated
      let userId: string | null = null;
      let user: any = null;
      if (req.isAuthenticated()) {
        userId = (req.user as any).id;
        if (userId) {
          user = await storage.getUser(userId);
        }
      }
      
      // Backend security check: Recalculate total with proper discount
      // This prevents manipulation of discounts
      let calculatedTotal = 0;
      const products = await storage.getProducts();
      
      for (const item of orderData.items) {
        const product = products.find((p: any) => p.id === item.id);
        if (product) {
          calculatedTotal += (product.pricePerGram || 0) * item.quantity;
        }
      }
      
      // Apply first order discount first (20% from base total)
      let usedFirstOrderDiscount = false;
      let firstOrderDiscountAmount = 0;
      if (user && !user.firstOrderDiscountUsed) {
        firstOrderDiscountAmount = calculatedTotal * 0.20;
        calculatedTotal = calculatedTotal - firstOrderDiscountAmount;
        usedFirstOrderDiscount = true;
        console.log("[Order] First order discount applied:", firstOrderDiscountAmount);
      }
      
      // Apply loyalty discount to the reduced total (only if user is verified)
      const loyaltyDiscount = (user && user.phoneVerified) ? getLoyaltyDiscount(user.xp) : 0;
      const loyaltyDiscountAmount = (calculatedTotal * loyaltyDiscount) / 100;
      calculatedTotal = calculatedTotal - loyaltyDiscountAmount;
      
      // Apply custom discount (individual discount from admin) to the reduced total
      const customDiscount = user?.customDiscount || 0;
      const customDiscountAmount = (calculatedTotal * customDiscount) / 100;
      calculatedTotal = calculatedTotal - customDiscountAmount;
      
      // Clamp total to zero (prevent negative totals from stacked discounts)
      calculatedTotal = Math.max(calculatedTotal, 0);
      
      // Log if there's a discrepancy
      if (Math.abs(calculatedTotal - orderData.total) > 1) {
        console.warn("[Order] Total mismatch - calculated:", calculatedTotal, "received:", orderData.total);
      }
      
      // Use calculated total (prevents price manipulation)
      const finalTotal = calculatedTotal;
      
      // Validate total is not negative
      if (finalTotal < 0) {
        res.status(400).json({ error: "Итоговая сумма заказа не может быть отрицательной" });
        return;
      }
      
      // Save order to database with calculated total
      const savedOrder = await storage.createOrder({
        userId,
        name: orderData.name,
        email: orderData.email,
        phone: orderData.phone,
        address: orderData.address,
        comment: orderData.comment,
        items: JSON.stringify(orderData.items),
        total: finalTotal,
        usedFirstOrderDiscount,
      });
      console.log("[Order] Order saved to database, ID:", savedOrder.id);
      
      // Mark first order discount as used if applicable
      if (usedFirstOrderDiscount && userId) {
        await storage.markFirstOrderDiscountUsed(userId);
        console.log("[Order] First order discount marked as used for user:", userId);
      }
      
      // Clear custom discount if it was used
      if (customDiscount > 0 && userId) {
        await db.update(usersTable).set({ customDiscount: null }).where(eq(usersTable.id, userId));
        console.log("[Order] Custom discount cleared for user:", userId);
      }
      
      // Clear cart for authenticated users
      if (userId) {
        await storage.clearCart(userId);
        console.log("[Order] Cart cleared for user:", userId);
      }
      
      // Save address if requested (for authenticated users only)
      if (orderData.saveAddress && userId && orderData.address) {
        try {
          const newAddress = await storage.createSavedAddress({
            userId,
            address: orderData.address,
            isDefault: false,
          });
          if (newAddress) {
            console.log("[Order] Address saved for user:", userId);
          } else {
            console.log("[Order] Address limit reached, not saved");
          }
        } catch (error) {
          console.error("[Order] Failed to save address:", error);
          // Don't block order creation if address saving fails
        }
      }
      
      // Send email notification
      try {
        await sendOrderNotification(orderData);
        console.log("[Order] Email notification sent successfully");
      } catch (emailError) {
        console.error("[Order] Email sending failed:", emailError);
        // Return 502 for external service failures
        res.status(502).json({ error: "Не удалось отправить уведомление. Попробуйте позже." });
        return;
      }
      
      // Send Telegram notification (non-blocking)
      try {
        await sendTelegramOrderNotification(savedOrder);
        console.log("[Order] Telegram notification sent successfully");
      } catch (telegramError) {
        console.error("[Order] Telegram notification failed:", telegramError);
        // Don't block order creation if Telegram fails
      }
      
      res.status(201).json({ 
        success: true, 
        message: "Заказ успешно оформлен",
        orderId: savedOrder.id,
      });
    } catch (error) {
      console.error("[Order] Order processing error:", error);
      if (error instanceof Error && error.name === "ZodError") {
        res.status(400).json({ error: "Неверные данные заказа" });
      } else {
        res.status(500).json({ error: "Ошибка обработки заказа" });
      }
    }
  });

  // Admin user management routes
  app.get("/api/admin/users/search", requireAdminAuth, async (req, res) => {
    try {
      const phone = req.query.phone as string;
      if (!phone) {
        res.status(400).json({ error: "Phone number is required" });
        return;
      }
      
      // Pass phone as-is to searchUserByPhone (it will handle partial searches)
      const user = await storage.searchUserByPhone(phone);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("[Admin] User search error:", error);
      res.status(500).json({ error: "Failed to search user" });
    }
  });

  app.get("/api/admin/users/recent", requireAdminAuth, async (req, res) => {
    try {
      const recentUsers = await db
        .select({
          id: usersTable.id,
          phone: usersTable.phone,
          email: usersTable.email,
          name: usersTable.name,
          phoneVerified: usersTable.phoneVerified,
          xp: usersTable.xp,
          customDiscount: usersTable.customDiscount,
          firstOrderDiscountUsed: usersTable.firstOrderDiscountUsed,
        })
        .from(usersTable)
        .orderBy(desc(usersTable.id))
        .limit(10);
      
      res.json(recentUsers);
    } catch (error) {
      console.error("[Admin] Get recent users error:", error);
      res.status(500).json({ error: "Failed to get recent users" });
    }
  });

  app.get("/api/admin/users/:id/orders", requireAdminAuth, async (req, res) => {
    try {
      const userId = req.params.id;
      const orders = await storage.getUserOrders(userId);
      res.json(orders);
    } catch (error) {
      console.error("[Admin] Get user orders error:", error);
      res.status(500).json({ error: "Failed to get user orders" });
    }
  });

  app.patch("/api/admin/users/:id/xp", requireAdminAuth, async (req, res) => {
    try {
      const userId = req.params.id;
      const { xp, reason, description } = req.body;
      
      if (typeof xp !== 'number' || xp < 0) {
        res.status(400).json({ error: "Invalid XP value" });
        return;
      }
      
      const validReasons = ["online_order", "offline_purchase", "manual_adjustment", "bonus"];
      const validatedReason = reason && validReasons.includes(reason) ? reason : "manual_adjustment";
      
      const user = await storage.getUser(userId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      
      const xpDiff = xp - user.xp;
      const updatedUser = await storage.updateUserXP(userId, xp);
      if (!updatedUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      
      if (xpDiff !== 0) {
        await storage.createXpTransaction({
          userId,
          amount: xpDiff,
          reason: validatedReason,
          description: description || (xpDiff > 0 ? `Ручное начисление: +${xpDiff} XP` : `Ручная корректировка: ${xpDiff} XP`),
          orderId: null,
          createdBy: "admin",
        });
      }
      
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("[Admin] Update user XP error:", error);
      res.status(500).json({ error: "Failed to update user XP" });
    }
  });

  app.post("/api/admin/xp-transactions", requireAdminAuth, async (req, res) => {
    try {
      const { userId, amount, reason, description } = req.body;
      
      if (!userId || typeof amount !== 'number') {
        res.status(400).json({ error: "userId and amount are required" });
        return;
      }
      
      const validReasons = ["online_order", "offline_purchase", "manual_adjustment", "bonus"];
      const validatedReason = reason && validReasons.includes(reason) ? reason : "offline_purchase";
      
      const user = await storage.getUser(userId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      
      await storage.addUserXP(userId, amount);
      
      const transaction = await storage.createXpTransaction({
        userId,
        amount,
        reason: validatedReason,
        description: description || `Начисление бонусов: ${amount > 0 ? '+' : ''}${amount} XP`,
        orderId: null,
        createdBy: "admin",
      });
      
      res.json(transaction);
    } catch (error) {
      console.error("[Admin] Create XP transaction error:", error);
      res.status(500).json({ error: "Failed to create XP transaction" });
    }
  });

  app.get("/api/admin/xp-transactions", requireAdminAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 1000;
      const offset = parseInt(req.query.offset as string) || 0;
      const transactions = await storage.getXpTransactions(limit, offset);
      res.json(transactions);
    } catch (error) {
      console.error("[Admin] Get XP transactions error:", error);
      res.status(500).json({ error: "Failed to get XP transactions" });
    }
  });

  // Public leaderboard - no auth required
  app.get("/api/admin/leaderboard/monthly", async (_req, res) => {
    try {
      const leaderboard = await storage.getMonthlyLeaderboard();
      res.json(leaderboard);
    } catch (error) {
      console.error("[Admin] Get monthly leaderboard error:", error);
      res.status(500).json({ error: "Failed to get monthly leaderboard" });
    }
  });

  app.get("/api/admin/loyalty/export", requireAdminAuth, async (req, res) => {
    try {
      const XLSX = await import("xlsx");
      const transactions = await storage.getXpTransactions(10000, 0);
      
      const data = transactions.map(t => ({
        "Дата": new Date(t.createdAt).toLocaleString("ru-RU"),
        "Сумма XP": t.amount,
        "Причина": t.reason === "online_order" ? "Онлайн-заказ" :
                   t.reason === "offline_purchase" ? "Офлайн-покупка" :
                   t.reason === "manual_adjustment" ? "Ручная корректировка" :
                   t.reason === "bonus" ? "Бонус" : t.reason,
        "Описание": t.description,
        "Телефон": t.user?.phone || "",
        "Имя": t.user?.name || "",
        "Email": t.user?.email || "",
        "Текущий XP": t.user?.xp || 0,
      }));
      
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      
      ws["!cols"] = [
        { wch: 20 },
        { wch: 12 },
        { wch: 20 },
        { wch: 40 },
        { wch: 18 },
        { wch: 20 },
        { wch: 25 },
        { wch: 12 },
      ];
      
      XLSX.utils.book_append_sheet(wb, ws, "Программа лояльности");
      
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="loyalty_export_${new Date().toISOString().split('T')[0]}.xlsx"`);
      res.send(buffer);
    } catch (error) {
      console.error("[Admin] Export loyalty error:", error);
      res.status(500).json({ error: "Failed to export loyalty data" });
    }
  });

  app.patch("/api/admin/users/:id/custom-discount", requireAdminAuth, async (req, res) => {
    try {
      const userId = req.params.id;
      const { discount } = req.body;
      
      // Validate discount value (0-100 or null)
      if (discount !== null && (typeof discount !== 'number' || discount < 0 || discount > 100)) {
        res.status(400).json({ error: "Скидка должна быть числом от 0 до 100 или null" });
        return;
      }
      
      // Update custom discount
      const [updatedUser] = await db
        .update(usersTable)
        .set({ customDiscount: discount })
        .where(eq(usersTable.id, userId))
        .returning();
      
      if (!updatedUser) {
        res.status(404).json({ error: "Пользователь не найден" });
        return;
      }
      
      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("[Admin] Update custom discount error:", error);
      res.status(500).json({ error: "Не удалось установить скидку" });
    }
  });

  // Admin orders management routes
  app.get("/api/admin/orders", requireAdminAuth, async (req, res) => {
    try {
      const statusFilter = req.query.status as string | undefined;
      const offset = parseInt(req.query.offset as string) || 0;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const orders = await storage.getOrders(statusFilter, offset, limit);
      res.json(orders);
    } catch (error) {
      console.error("[Admin] Get orders error:", error);
      res.status(500).json({ error: "Failed to get orders" });
    }
  });

  app.patch("/api/admin/orders/:id/status", requireAdminAuth, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const statusData = updateOrderStatusSchema.parse(req.body);
      
      // Get the order before updating to check conditions for XP award
      const orderBeforeUpdate = await storage.getOrder(orderId);
      if (!orderBeforeUpdate) {
        res.status(404).json({ error: "Order not found" });
        return;
      }
      
      // Update order status atomically - only if current status matches expected
      // This prevents race conditions when multiple admins complete the same order
      const shouldAwardXP = statusData.status === "completed" && 
                            orderBeforeUpdate.status !== "completed" && 
                            orderBeforeUpdate.userId;
      
      const updatedOrder = await storage.updateOrderStatus(
        orderId, 
        statusData.status,
        shouldAwardXP ? orderBeforeUpdate.status : undefined
      );
      
      if (!updatedOrder) {
        // Order not found OR status has already changed (race condition prevented)
        res.status(404).json({ error: "Order not found or status has already been changed" });
        return;
      }
      
      // Award XP only if the atomic update succeeded
      if (shouldAwardXP && orderBeforeUpdate.userId) {
        const xpToAward = Math.floor(orderBeforeUpdate.total);
        await storage.addUserXP(orderBeforeUpdate.userId, xpToAward);
        await storage.createXpTransaction({
          userId: orderBeforeUpdate.userId,
          amount: xpToAward,
          reason: "online_order",
          description: `Заказ #${orderId}: +${xpToAward} XP`,
          orderId,
          createdBy: "system",
        });
        console.log(`[Admin] Order #${orderId} completed: Awarded ${xpToAward} XP to user ${orderBeforeUpdate.userId}`);
      }
      
      // Restore first order discount if order is cancelled and it was used
      const shouldRestoreDiscount = statusData.status === "cancelled" && 
                                     orderBeforeUpdate.usedFirstOrderDiscount && 
                                     orderBeforeUpdate.userId;
      
      if (shouldRestoreDiscount && orderBeforeUpdate.userId) {
        await storage.restoreFirstOrderDiscount(orderBeforeUpdate.userId);
        console.log(`[Admin] Order #${orderId} cancelled: Restored first order discount for user ${orderBeforeUpdate.userId}`);
      }
      
      res.json(updatedOrder);
    } catch (error) {
      console.error("[Admin] Update order status error:", error);
      if (error instanceof Error && error.name === "ZodError") {
        res.status(400).json({ error: "Invalid status value" });
      } else {
        res.status(500).json({ error: "Failed to update order status" });
      }
    }
  });

  // Sync order with Tinkoff - for manual recovery when webhook fails
  app.post("/api/admin/orders/:id/sync", requireAdminAuth, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { paymentId, receiptUrl: manualReceiptUrl } = req.body; // Optional overrides
      
      console.log(`[Admin] Manual sync requested for order ${orderId}, paymentId override:`, paymentId, ', receiptUrl override:', manualReceiptUrl);
      
      // Get order from database
      const order = await db.query.orders.findFirst({
        where: eq(ordersTable.id, orderId),
      });
      
      if (!order) {
        res.status(404).json({ error: "Order not found" });
        return;
      }
      
      // Determine which payment ID to use
      const paymentIdToUse = paymentId || order.paymentId;
      
      if (!paymentIdToUse) {
        res.status(400).json({ 
          error: "No payment ID available. Order has no paymentId and none was provided in request." 
        });
        return;
      }
      
      console.log(`[Admin] Syncing order ${orderId} with Tinkoff using PaymentId: ${paymentIdToUse}`);
      
      // Get payment state from Tinkoff
      const tinkoffClient = getTinkoffClient();
      const paymentState = await tinkoffClient.getState(paymentIdToUse);
      
      console.log(`[Admin] Received payment state:`, JSON.stringify(paymentState, null, 2));
      
      // Extract payment status
      const tinkoffStatus = paymentState.Status;
      
      // Extract receipt URL from response
      let receiptUrl: string | null = null;
      
      // Try Receipts array first (primary location for fiscal receipts)
      if (paymentState.Receipts && Array.isArray(paymentState.Receipts) && paymentState.Receipts.length > 0) {
        const receiptWithUrl = paymentState.Receipts.find((r: any) => r.Url);
        if (receiptWithUrl) {
          receiptUrl = receiptWithUrl.Url;
        }
      }
      
      // Fallback to legacy fields if Receipts array not available
      if (!receiptUrl) {
        if (typeof paymentState.Receipt === 'string') {
          receiptUrl = paymentState.Receipt;
        } else if (paymentState.Receipt?.Url) {
          receiptUrl = paymentState.Receipt.Url;
        } else if (paymentState.ReceiptUrl) {
          receiptUrl = paymentState.ReceiptUrl;
        }
      }
      
      console.log(`[Admin] Extracted receipt URL from Tinkoff:`, receiptUrl);
      console.log(`[Admin] Tinkoff status:`, tinkoffStatus);
      
      // Use manual receipt URL if provided, otherwise use Tinkoff's response, otherwise keep existing
      const finalReceiptUrl = manualReceiptUrl || receiptUrl || order.receiptUrl;
      console.log(`[Admin] Final receipt URL to use:`, finalReceiptUrl);
      
      // Determine order status based on payment status
      let orderStatus: string = order.status;
      if (tinkoffStatus === "CONFIRMED") {
        orderStatus = "paid";
      } else if (tinkoffStatus === "REJECTED") {
        orderStatus = "cancelled";
      }
      
      // Send SMS with receipt if available and payment is confirmed
      // Use ATOMIC update to claim SMS rights
      let smsSent = false;
      if (finalReceiptUrl && tinkoffStatus === "CONFIRMED") {
        // ATOMIC: Try to claim SMS sending rights with conditional update
        const updateResult = await db.update(ordersTable)
          .set({
            paymentId: paymentIdToUse,
            paymentStatus: tinkoffStatus,
            status: orderStatus,
            receiptUrl: finalReceiptUrl,
            receiptSmsSent: true,
          })
          .where(and(eq(ordersTable.id, orderId), eq(ordersTable.receiptSmsSent, false)));
        
        if (updateResult.rowCount === 0) {
          // Lost race - SMS already sent, just update other fields
          console.log(`[Admin] SMS already sent for order ${orderId}, skipping (lost race)`);
          await db.update(ordersTable)
            .set({
              paymentId: paymentIdToUse,
              paymentStatus: tinkoffStatus,
              status: orderStatus,
              receiptUrl: finalReceiptUrl,
            })
            .where(eq(ordersTable.id, orderId));
        } else {
          // Won race - send SMS
          try {
            const normalizedPhone = normalizePhone(order.phone);
            await sendReceiptSms(normalizedPhone, finalReceiptUrl, orderId);
            smsSent = true;
            console.log(`[Admin] Receipt SMS sent successfully to ${normalizedPhone}`);
          } catch (error) {
            console.error(`[Admin] Failed to send receipt SMS:`, error);
            // Reset flag so retry can work
            await db.update(ordersTable)
              .set({ receiptSmsSent: false })
              .where(eq(ordersTable.id, orderId));
          }
        }
      } else {
        // No receipt or not confirmed - just update order
        await db.update(ordersTable)
          .set({
            paymentId: paymentIdToUse,
            paymentStatus: tinkoffStatus,
            status: orderStatus,
            receiptUrl: finalReceiptUrl,
          })
          .where(eq(ordersTable.id, orderId));
      }
      
      console.log(`[Admin] Order ${orderId} updated in database`);
      
      // Award XP if payment is confirmed and user is authenticated
      let xpAwarded = false;
      if (tinkoffStatus === "CONFIRMED" && order.userId && orderStatus !== order.status) {
        const xpToAdd = Math.floor(order.total);
        await db.update(usersTable)
          .set({
            xp: sql`${usersTable.xp} + ${xpToAdd}`,
          })
          .where(eq(usersTable.id, order.userId));
        xpAwarded = true;
        console.log(`[Admin] Added ${xpToAdd} XP to user ${order.userId}`);
      }
      
      res.json({
        success: true,
        orderId,
        paymentId: paymentIdToUse,
        paymentStatus: tinkoffStatus,
        orderStatus,
        receiptUrl,
        smsSent,
        xpAwarded,
      });
    } catch (error) {
      console.error("[Admin] Order sync error:", error);
      res.status(500).json({ 
        error: "Failed to sync order with Tinkoff",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Cart routes
  app.get("/api/cart", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const cartItems = await storage.getCartItems(userId);
      res.json(cartItems);
    } catch (error) {
      console.error("[Cart] Get cart error:", error);
      res.status(500).json({ error: "Failed to get cart items" });
    }
  });

  app.post("/api/cart", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const cartItemData = insertCartItemSchema.parse({
        ...req.body,
        userId,
      });
      
      const cartItem = await storage.addToCart(cartItemData);
      res.json(cartItem);
    } catch (error) {
      console.error("[Cart] Add to cart error:", error);
      if (error instanceof Error && error.name === "ZodError") {
        res.status(400).json({ error: "Invalid cart item data" });
      } else {
        res.status(500).json({ error: "Failed to add item to cart" });
      }
    }
  });

  app.patch("/api/cart/:id", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.id;
      const { quantity } = updateCartItemSchema.parse(req.body);
      
      const updatedItem = await storage.updateCartItem(id, quantity, userId);
      if (!updatedItem) {
        res.status(404).json({ error: "Cart item not found" });
        return;
      }
      
      res.json(updatedItem);
    } catch (error) {
      console.error("[Cart] Update cart item error:", error);
      if (error instanceof Error && error.name === "ZodError") {
        res.status(400).json({ error: "Invalid quantity" });
      } else {
        res.status(500).json({ error: "Failed to update cart item" });
      }
    }
  });

  app.delete("/api/cart/:id", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.id;
      const removed = await storage.removeFromCart(id, userId);
      
      if (!removed) {
        res.status(404).json({ error: "Cart item not found" });
        return;
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("[Cart] Remove cart item error:", error);
      res.status(500).json({ error: "Failed to remove cart item" });
    }
  });

  app.delete("/api/cart", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await storage.clearCart(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("[Cart] Clear cart error:", error);
      res.status(500).json({ error: "Failed to clear cart" });
    }
  });

  // Saved Addresses routes
  app.get("/api/addresses", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const addresses = await storage.getSavedAddresses(userId);
      res.json(addresses);
    } catch (error) {
      console.error("[Addresses] Get addresses error:", error);
      res.status(500).json({ error: "Ошибка получения адресов" });
    }
  });

  app.post("/api/addresses", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const addressData = insertSavedAddressSchema.parse({
        ...req.body,
        userId,
      });
      
      const newAddress = await storage.createSavedAddress(addressData);
      
      if (!newAddress) {
        res.status(400).json({ error: "Достигнут лимит сохранённых адресов (максимум 10)" });
        return;
      }
      
      res.status(201).json(newAddress);
    } catch (error) {
      console.error("[Addresses] Create address error:", error);
      if (error instanceof Error && error.name === "ZodError") {
        res.status(400).json({ error: "Некорректные данные адреса" });
      } else {
        res.status(500).json({ error: "Ошибка сохранения адреса" });
      }
    }
  });

  app.delete("/api/addresses/:id", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.id;
      const deleted = await storage.deleteSavedAddress(id, userId);
      
      if (!deleted) {
        res.status(404).json({ error: "Адрес не найден" });
        return;
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("[Addresses] Delete address error:", error);
      res.status(500).json({ error: "Ошибка удаления адреса" });
    }
  });

  app.patch("/api/addresses/:id/default", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.id;
      const updatedAddress = await storage.setDefaultAddress(id, userId);
      
      if (!updatedAddress) {
        res.status(404).json({ error: "Адрес не найден" });
        return;
      }
      
      res.json(updatedAddress);
    } catch (error) {
      console.error("[Addresses] Set default address error:", error);
      res.status(500).json({ error: "Ошибка установки адреса по умолчанию" });
    }
  });

  // Site Settings routes
  app.get("/api/site-settings", async (_req, res) => {
    try {
      const settings = await storage.getSiteSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to get site settings" });
    }
  });

  app.put("/api/site-settings", requireAdminAuth, async (req, res) => {
    try {
      const settingsData = updateSiteSettingsSchema.parse(req.body);
      const updated = await storage.updateSiteSettings(settingsData);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid site settings data" });
    }
  });

  // Telegram helper endpoint to get chat_id
  app.get("/api/telegram/get-chat-id", async (_req, res) => {
    try {
      const updates = await getTelegramUpdates();
      
      if (updates.length === 0) {
        res.send(`
          <html>
            <head>
              <title>Telegram Chat ID</title>
              <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
                .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; }
                code { background: #f5f5f5; padding: 2px 5px; border-radius: 3px; }
              </style>
            </head>
            <body>
              <h1>Получение Chat ID для Telegram</h1>
              <div class="warning">
                <h3>Бот не получил ни одного сообщения</h3>
                <p>Чтобы получить Chat ID:</p>
                <ol>
                  <li>Добавьте вашего бота в беседу Telegram</li>
                  <li>Отправьте любое сообщение в беседу (например, "привет")</li>
                  <li>Обновите эту страницу</li>
                </ol>
              </div>
            </body>
          </html>
        `);
        return;
      }

      const chats = updates
        .filter(update => update.message?.chat)
        .map(update => ({
          chatId: update.message!.chat.id,
          chatType: update.message!.chat.type,
          chatTitle: update.message!.chat.title || 'Private chat',
          lastMessage: update.message!.text || '(no text)',
          from: update.message!.from?.first_name || 'Unknown'
        }));

      const uniqueChats = Array.from(
        new Map(chats.map(chat => [chat.chatId, chat])).values()
      );

      let html = `
        <html>
          <head>
            <title>Telegram Chat ID</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
              .chat { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
              .chat-id { font-size: 18px; font-weight: bold; color: #007bff; }
              code { background: #e9ecef; padding: 2px 5px; border-radius: 3px; }
              .success { background: #d4edda; border: 1px solid #28a745; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
            </style>
          </head>
          <body>
            <h1>Найденные беседы Telegram</h1>
            <div class="success">
              <strong>Найдено бесед: ${uniqueChats.length}</strong>
            </div>
      `;

      uniqueChats.forEach((chat, index) => {
        html += `
          <div class="chat">
            <div class="chat-id">Chat ID: ${chat.chatId}</div>
            <p><strong>Тип:</strong> ${chat.chatType}</p>
            <p><strong>Название:</strong> ${chat.chatTitle}</p>
            <p><strong>Последнее сообщение:</strong> ${chat.lastMessage}</p>
            <p><strong>От:</strong> ${chat.from}</p>
          </div>
        `;
      });

      html += `
            <div style="margin-top: 30px; padding: 15px; background: #e7f3ff; border-radius: 5px;">
              <h3>Следующий шаг:</h3>
              <p>Скопируйте нужный <strong>Chat ID</strong> (число) и добавьте его как секрет <code>TELEGRAM_CHAT_ID</code> в настройках Replit</p>
            </div>
          </body>
        </html>
      `;

      res.send(html);
    } catch (error) {
      console.error("Error getting Telegram chat ID:", error);
      res.status(500).send(`
        <html>
          <head>
            <title>Error</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
              .error { background: #f8d7da; border: 1px solid #dc3545; padding: 15px; border-radius: 5px; }
            </style>
          </head>
          <body>
            <div class="error">
              <h2>Ошибка</h2>
              <p>Проверьте что TELEGRAM_BOT_TOKEN добавлен в секреты Replit</p>
              <p>Ошибка: ${error instanceof Error ? error.message : 'Unknown error'}</p>
            </div>
          </body>
        </html>
      `);
    }
  });

  // Admin statistics endpoint
  app.get("/api/admin/stats", requireAdminAuth, async (_req, res) => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

      // 1. Overall user statistics
      const totalUsersResult = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
      const totalUsers = Number(totalUsersResult.rows[0]?.count || 0);

      const activeUsersResult = await db.execute(sql`
        SELECT COUNT(DISTINCT user_id) as count 
        FROM orders 
        WHERE user_id IS NOT NULL
      `);
      const activeUsers = Number(activeUsersResult.rows[0]?.count || 0);

      // 2. Overall order statistics (excluding cancelled)
      const orderStatsResult = await db.execute(sql`
        SELECT 
          COUNT(*) as total_orders,
          COALESCE(SUM(total), 0) as total_revenue,
          COALESCE(AVG(total), 0) as avg_order
        FROM orders
        WHERE status != 'cancelled' AND created_at >= ${thirtyDaysAgoStr}
      `);
      const orderStats = orderStatsResult.rows[0];
      const totalOrders = Number(orderStats?.total_orders || 0);
      const totalRevenue = Number(orderStats?.total_revenue || 0);
      const avgOrder = Number(orderStats?.avg_order || 0);

      // 3. Conversion rate (users who made at least one order)
      const conversionRate = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;

      // 4. New customers by day (users who made their first order in last 30 days)
      const newCustomersResult = await db.execute(sql`
        SELECT 
          DATE(created_at) as date,
          COUNT(DISTINCT user_id) as count
        FROM orders
        WHERE used_first_order_discount = true 
          AND user_id IS NOT NULL 
          AND created_at >= ${thirtyDaysAgoStr}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `);
      
      // 5. Daily orders and revenue for last 30 days
      const dailyOrdersResult = await db.execute(sql`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as order_count,
          COALESCE(SUM(total), 0) as revenue
        FROM orders
        WHERE status != 'cancelled' AND created_at >= ${thirtyDaysAgoStr}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `);

      // 6. Top 5 products by total quantity sold
      const topProductsResult = await db.execute(sql`
        SELECT 
          p.name,
          SUM(CAST(oi->>'quantity' AS INTEGER)) as total_quantity,
          COALESCE(SUM(CAST(oi->>'quantity' AS INTEGER) * CAST(oi->>'pricePerGram' AS FLOAT)), 0) as total_revenue
        FROM orders o,
        LATERAL json_array_elements(o.items::json) AS oi
        JOIN products p ON p.id = CAST(oi->>'id' AS INTEGER)
        WHERE o.status != 'cancelled' AND o.created_at >= ${thirtyDaysAgoStr}
        GROUP BY p.name
        ORDER BY total_quantity DESC
        LIMIT 5
      `);

      // 7. Loyalty levels distribution
      const loyaltyDistResult = await db.execute(sql`
        SELECT 
          CASE
            WHEN xp < 3000 THEN 'Новичок'
            WHEN xp < 7000 THEN 'Ценитель'
            WHEN xp < 15000 THEN 'Чайный мастер'
            ELSE 'Чайный Гуру'
          END as level,
          COUNT(*) as count
        FROM users
        GROUP BY level
        ORDER BY MIN(xp) ASC
      `);

      // 8. Order status distribution
      const statusDistResult = await db.execute(sql`
        SELECT 
          status,
          COUNT(*) as count
        FROM orders
        WHERE created_at >= ${thirtyDaysAgoStr}
        GROUP BY status
      `);

      // 9. Discount statistics
      // First order discount usage (last 30 days)
      const firstOrderDiscountResult = await db.execute(sql`
        SELECT COUNT(CASE WHEN used_first_order_discount = true THEN 1 END) as first_order_used
        FROM orders
        WHERE created_at >= ${thirtyDaysAgoStr}
      `);
      
      // Custom discounts currently granted (snapshot, not time-based)
      // This shows how many users currently have admin-granted custom discounts
      const customDiscountResult = await db.execute(sql`
        SELECT COUNT(*) as count 
        FROM users 
        WHERE custom_discount IS NOT NULL AND custom_discount > 0
      `);

      // Count users with verified phones (eligible for loyalty discount)
      const verifiedUsersResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM users WHERE phone_verified = true
      `);
      const verifiedUsers = Number(verifiedUsersResult.rows[0]?.count || 0);

      // 10. Repeat customers (users with 2+ orders)
      const repeatCustomersResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM (
          SELECT user_id
          FROM orders
          WHERE user_id IS NOT NULL AND status != 'cancelled'
          GROUP BY user_id
          HAVING COUNT(*) >= 2
        ) as repeat_users
      `);
      const repeatCustomers = Number(repeatCustomersResult.rows[0]?.count || 0);
      const repeatRate = activeUsers > 0 ? (repeatCustomers / activeUsers) * 100 : 0;

      res.json({
        overview: {
          totalUsers,
          activeUsers,
          verifiedUsers,
          totalOrders,
          totalRevenue: Math.round(totalRevenue),
          avgOrder: Math.round(avgOrder),
          conversionRate: Math.round(conversionRate * 10) / 10,
          repeatCustomers,
          repeatRate: Math.round(repeatRate * 10) / 10,
        },
        newCustomers: newCustomersResult.rows.map((row: any) => ({
          date: row.date,
          count: Number(row.count),
        })),
        dailyOrders: dailyOrdersResult.rows.map((row: any) => ({
          date: row.date,
          orderCount: Number(row.order_count),
          revenue: Math.round(Number(row.revenue)),
        })),
        topProducts: topProductsResult.rows.map((row: any) => ({
          name: row.name,
          quantity: Number(row.total_quantity),
          revenue: Math.round(Number(row.total_revenue)),
        })),
        loyaltyDistribution: loyaltyDistResult.rows.map((row: any) => ({
          level: row.level,
          count: Number(row.count),
        })),
        statusDistribution: statusDistResult.rows.map((row: any) => ({
          status: row.status,
          count: Number(row.count),
        })),
        discounts: {
          firstOrderUsed: Number(firstOrderDiscountResult.rows[0]?.first_order_used || 0),
          customDiscountGranted: Number(customDiscountResult.rows[0]?.count || 0),
          loyaltyEligible: verifiedUsers,
        },
      });
    } catch (error) {
      console.error("[Admin] Stats error:", error);
      res.status(500).json({ error: "Failed to get statistics" });
    }
  });

  // ============ Info Banners Routes ============
  
  // Public: Get active banners for display on site
  app.get("/api/banners", async (_req, res) => {
    try {
      const banners = await storage.getInfoBanners(true); // Active only
      res.json(banners);
    } catch (error) {
      console.error("[Banners] Error fetching banners:", error);
      res.status(500).json({ error: "Failed to fetch banners" });
    }
  });

  // Admin: Get all banners (including inactive)
  app.get("/api/admin/banners", requireAdminAuth, async (_req, res) => {
    try {
      const banners = await storage.getInfoBanners(false);
      res.json(banners);
    } catch (error) {
      console.error("[Admin Banners] Error fetching banners:", error);
      res.status(500).json({ error: "Failed to fetch banners" });
    }
  });

  // Admin: Get single banner
  app.get("/api/admin/banners/:id", requireAdminAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const banner = await storage.getInfoBanner(id);
      if (!banner) {
        res.status(404).json({ error: "Banner not found" });
        return;
      }
      res.json(banner);
    } catch (error) {
      console.error("[Admin Banners] Error fetching banner:", error);
      res.status(500).json({ error: "Failed to fetch banner" });
    }
  });

  // Admin: Create banner
  app.post("/api/admin/banners", requireAdminAuth, async (req, res) => {
    try {
      const { insertInfoBannerSchema } = await import("@shared/schema");
      const parsed = insertInfoBannerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid banner data", details: parsed.error.issues });
        return;
      }
      const banner = await storage.createInfoBanner(parsed.data);
      res.status(201).json(banner);
    } catch (error) {
      console.error("[Admin Banners] Error creating banner:", error);
      res.status(500).json({ error: "Failed to create banner" });
    }
  });

  // Admin: Update banner
  app.patch("/api/admin/banners/:id", requireAdminAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { updateInfoBannerSchema } = await import("@shared/schema");
      const parsed = updateInfoBannerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid banner data", details: parsed.error.issues });
        return;
      }
      const banner = await storage.updateInfoBanner(id, parsed.data);
      if (!banner) {
        res.status(404).json({ error: "Banner not found" });
        return;
      }
      res.json(banner);
    } catch (error) {
      console.error("[Admin Banners] Error updating banner:", error);
      res.status(500).json({ error: "Failed to update banner" });
    }
  });

  // Admin: Delete banner
  app.delete("/api/admin/banners/:id", requireAdminAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteInfoBanner(id);
      if (!deleted) {
        res.status(404).json({ error: "Banner not found" });
        return;
      }
      res.json({ success: true });
    } catch (error) {
      console.error("[Admin Banners] Error deleting banner:", error);
      res.status(500).json({ error: "Failed to delete banner" });
    }
  });

  // Admin: Reorder banners (bulk update positions and slots)
  app.post("/api/admin/banners/reorder", requireAdminAuth, async (req, res) => {
    try {
      const { orders } = req.body;
      if (!Array.isArray(orders)) {
        res.status(400).json({ error: "Orders must be an array" });
        return;
      }
      await storage.reorderBanners(orders);
      res.json({ success: true });
    } catch (error) {
      console.error("[Admin Banners] Error reordering banners:", error);
      res.status(500).json({ error: "Failed to reorder banners" });
    }
  });

  // Payment routes
  // Initialize payment for an order
  app.post("/api/payments/init", async (req, res) => {
    try {
      const { orderId } = req.body;

      if (!orderId) {
        res.status(400).json({ error: "Order ID is required" });
        return;
      }

      // Get order from database
      const order = await db.query.orders.findFirst({
        where: eq(ordersTable.id, orderId),
      });

      if (!order) {
        res.status(404).json({ error: "Order not found" });
        return;
      }

      // Security: Verify order ownership
      // Normalize userId - treat empty strings as null
      const orderUserId = order.userId?.trim() || null;
      
      if (req.isAuthenticated()) {
        const userId = (req.user as any).id;
        // Authenticated users can only init payment for their own orders
        if (orderUserId !== null && orderUserId !== userId) {
          res.status(403).json({ error: "Access denied" });
          return;
        }
        // Authenticated users cannot init payment for guest orders
        if (orderUserId === null) {
          res.status(403).json({ error: "Cannot access guest order" });
          return;
        }
      } else {
        // Unauthenticated users can only init payment for guest orders (userId === null)
        if (orderUserId !== null) {
          res.status(401).json({ error: "Authentication required" });
          return;
        }
      }

      // Check order status - only allow payment for pending/unpaid orders
      if (order.status === "paid") {
        res.status(400).json({ error: "Order already paid" });
        return;
      }
      if (order.status === "cancelled") {
        res.status(400).json({ error: "Order is cancelled" });
        return;
      }

      // Check if payment already initialized
      if (order.paymentId && order.paymentStatus === "NEW") {
        res.json({
          success: true,
          paymentUrl: order.paymentUrl,
          paymentId: order.paymentId,
        });
        return;
      }

      // Initialize payment with Tinkoff
      const tinkoffClient = getTinkoffClient();
      const orderItems = JSON.parse(order.items);

      // Normalize phone using centralized utility (returns +7XXXXXXXXXX format)
      if (!order.phone) {
        res.status(400).json({ error: "Phone number is required for payment" });
        return;
      }
      
      const normalizedPhone = normalizePhone(order.phone);
      // Tinkoff requires phone WITHOUT "+" for Receipt.Phone (79XXXXXXXXX format)
      const phoneForReceipt = normalizedPhone.replace(/^\+/, '');
      console.log("[Payment] Phone normalized:", order.phone, "->", normalizedPhone, "Receipt format:", phoneForReceipt);

      // Define receipt item interface for type safety
      interface ReceiptItem {
        Name: string;
        Price: number;
        Quantity: number;
        Amount: number;
        Tax: string;
        PaymentMethod: string;
        PaymentObject: string;
      }

      // Prepare receipt items for Tinkoff (54-ФЗ compliance)
      // For weight-based items (tea sold by gram), we use Quantity=1 and full line total as Price/Amount
      // This ensures Tinkoff displays the actual product name and correct price on the fiscal receipt
      const receiptItems: ReceiptItem[] = orderItems.map((item: any) => {
        // Calculate full line total in kopecks (before any discounts)
        const amountInKopecks = Math.round(item.pricePerGram * item.quantity * 100);
        
        // For fiscal receipts: display full item description with quantity info in the name
        let itemName = item.name;
        if (item.quantity !== 1) {
          // Add weight/quantity info to product name for clarity on receipt
          itemName = `${item.name} - ${item.quantity}g`;
        }
        
        return {
          Name: itemName, // Product name with quantity (e.g., "Лунный свет - 25g")
          Price: amountInKopecks, // Full line price in KOPECKS (equals Amount)
          Quantity: 1, // Always 1 for simplified fiscal receipt display
          Amount: amountInKopecks, // Total in KOPECKS (must equal Price * Quantity)
          Tax: "vat0", // VAT 0% (no VAT, 54-ФЗ compliance)
          PaymentMethod: "full_payment", // Full payment (54-ФЗ compliance)
          PaymentObject: "commodity", // Goods/commodity (54-ФЗ compliance)
        };
      });

      // Calculate payment amount in kopecks
      const amountInKopecks = Math.round(order.total * 100);
      
      // Calculate sum of receipt items (before discount adjustment)
      const totalItemsAmount = receiptItems.reduce((sum: number, item: ReceiptItem) => sum + item.Amount, 0);
      const discountAmount = totalItemsAmount - amountInKopecks;

      // Distribute any discount proportionally across all items
      // This handles loyalty discounts, first-order discounts, etc.
      if (discountAmount > 0) {
        console.log("[Payment] Total discount to distribute:", discountAmount, "kopecks");
        
        // First pass: apply proportional discounts with 54-ФЗ minimum (1 kopeck)
        let actualDiscountDistributed = 0;
        const minAmount = 1; // 54-ФЗ requires Amount ≥ 1 kopeck
        
        // Apply proportional discount to each item except the last
        for (let i = 0; i < receiptItems.length - 1; i++) {
          const item = receiptItems[i];
          const idealDiscount = Math.round((discountAmount * item.Amount) / totalItemsAmount);
          const maxPossibleDiscount = item.Amount - minAmount; // Leave at least 1 kopeck
          const actualDiscount = Math.min(idealDiscount, maxPossibleDiscount);
          
          item.Amount -= actualDiscount;
          item.Price = item.Amount; // Keep Price = Amount for Quantity=1
          actualDiscountDistributed += actualDiscount;
          console.log(`[Payment] Item "${item.Name}": discount=${actualDiscount}, Amount=${item.Amount}`);
        }
        
        // Last item gets all remaining discount (ensures exact total)
        const lastItem = receiptItems[receiptItems.length - 1];
        const remainingDiscount = discountAmount - actualDiscountDistributed;
        const maxPossibleDiscount = lastItem.Amount - minAmount;
        const actualDiscount = Math.min(remainingDiscount, maxPossibleDiscount);
        
        lastItem.Amount -= actualDiscount;
        lastItem.Price = lastItem.Amount; // Keep Price = Amount for Quantity=1
        actualDiscountDistributed += actualDiscount;
        console.log(`[Payment] Item "${lastItem.Name}": final discount=${actualDiscount}, Amount=${lastItem.Amount}`);
        
        // If we couldn't distribute full discount due to 54-ФЗ minimum constraints
        if (actualDiscountDistributed < discountAmount) {
          const undistributedDiscount = discountAmount - actualDiscountDistributed;
          console.warn(`[Payment] ⚠️ Could not distribute ${undistributedDiscount} kopecks due to 54-ФЗ minimum (1 kopeck per item)`);
          console.warn(`[Payment] This may cause receipt total mismatch - reducing order total to match`);
        }
      }

      // Verify that receipt items total equals payment amount (in KOPECKS)
      const receiptTotal = receiptItems.reduce((sum: number, item: ReceiptItem) => sum + item.Amount, 0);
      if (receiptTotal !== amountInKopecks) {
        console.error("[Payment] Receipt total mismatch:", {
          receiptTotal,
          amountInKopecks,
          diff: receiptTotal - amountInKopecks,
          items: receiptItems.map(i => ({ name: i.Name, amount: i.Amount, price: i.Price }))
        });
        throw new Error(`Receipt total mismatch: ${receiptTotal} !== ${amountInKopecks}`);
      }

      // Use REPLIT_DOMAINS if available (development), otherwise production domain
      const baseUrl = process.env.REPLIT_DOMAINS 
        ? `https://${process.env.REPLIT_DOMAINS}`
        : "https://puerpub.replit.app";

      const paymentRequest: any = {
        Amount: amountInKopecks, // Amount in KOPECKS (SDK does NOT convert, sends as-is)
        OrderId: String(orderId),
        Description: `Заказ #${orderId} - Puer Pub`,
        DATA: {
          Phone: phoneForReceipt, // Normalized phone in 79XXXXXXXXX format (no Email to ensure SMS receipt delivery)
        },
        Receipt: {
          Phone: phoneForReceipt, // Customer will receive receipt via SMS (format: 79XXXXXXXXX without +)
          Taxation: "usn_income", // Simplified tax system
          Items: receiptItems,
        },
        NotificationURL: `${baseUrl}/api/payments/notification`,
        SuccessURL: `${baseUrl}/payment/success?orderId=${orderId}`,
        FailURL: `${baseUrl}/payment/error?orderId=${orderId}`,
      };

      // Standard payment init - Tinkoff will show all available payment methods (card, T-Pay, SBP)
      console.log("[Payment] Full payment request:", JSON.stringify(paymentRequest, null, 2));

      const paymentResponse = await tinkoffClient.init(paymentRequest);

      // Save payment info to order
      await db.update(ordersTable)
        .set({
          paymentId: String(paymentResponse.PaymentId),
          paymentStatus: paymentResponse.Status,
          paymentUrl: paymentResponse.PaymentURL,
        })
        .where(eq(ordersTable.id, orderId));

      console.log("[Payment] Payment initialized for order:", orderId, "PaymentId:", paymentResponse.PaymentId);

      res.json({
        success: true,
        paymentUrl: paymentResponse.PaymentURL,
        paymentId: paymentResponse.PaymentId,
      });
    } catch (error: any) {
      console.error("[Payment] Failed to initialize payment:", error);
      res.status(500).json({ error: error.message || "Failed to initialize payment" });
    }
  });

  // Webhook for payment notifications from Tinkoff
  app.post("/api/payments/notification", async (req, res) => {
    try {
      const notification = req.body;
      console.log("[Payment] Received notification:", notification);

      // Verify notification signature
      const tinkoffClient = getTinkoffClient();
      if (!tinkoffClient.verifyNotification(notification)) {
        console.error("[Payment] Invalid notification signature");
        res.status(400).send("Invalid signature");
        return;
      }

      const orderIdRaw = notification.OrderId;
      const paymentStatus = notification.Status;

      // Check if this is a wallet top-up (OrderId starts with "W_")
      if (typeof orderIdRaw === 'string' && orderIdRaw.startsWith("W_")) {
        console.log("[Wallet] Received wallet payment notification:", orderIdRaw, "Status:", paymentStatus);
        
        // Only process confirmed payments
        if (paymentStatus === "CONFIRMED") {
          // Parse wallet order ID: W_timestamp_userId_amount
          const parts = orderIdRaw.split("_");
          if (parts.length >= 4) {
            const userIdPrefix = parts[2];
            const amountRub = parseInt(parts[3]);
            const amountKopecks = amountRub * 100;
            
            // Find user by ID prefix
            const allUsers = await db.select().from(usersTable);
            const user = allUsers.find(u => u.id.startsWith(userIdPrefix));
            
            if (user) {
              // Check if this payment was already processed (prevent duplicates)
              const existingTransaction = await db.query.walletTransactions.findFirst({
                where: eq(walletTransactions.paymentId, notification.PaymentId),
              });
              
              if (!existingTransaction) {
                // Credit the wallet
                await db.update(usersTable)
                  .set({ 
                    walletBalance: sql`${usersTable.walletBalance} + ${amountKopecks}` 
                  })
                  .where(eq(usersTable.id, user.id));
                
                // Record transaction
                await db.insert(walletTransactions).values({
                  userId: user.id,
                  type: "topup",
                  amount: amountKopecks,
                  description: `Пополнение через СБП на ${amountRub}₽`,
                  paymentId: notification.PaymentId,
                });
                
                console.log("[Wallet] ✅ Credited", amountRub, "RUB to user:", user.id);
              } else {
                console.log("[Wallet] Payment already processed:", notification.PaymentId);
              }
            } else {
              console.error("[Wallet] User not found for prefix:", userIdPrefix);
            }
          }
        }
        
        res.send(tinkoffClient.getNotificationSuccessResponse());
        return;
      }

      // Check if this is a Telegram order (OrderId starts with "T_")
      if (typeof orderIdRaw === 'string' && orderIdRaw.startsWith("T_")) {
        console.log("[Telegram Order] Received payment notification:", orderIdRaw, "Status:", paymentStatus);
        
        // Only process confirmed payments
        if (paymentStatus === "CONFIRMED") {
          // Find pending telegram order
          const pendingOrder = await db.query.pendingTelegramOrders.findFirst({
            where: eq(pendingTelegramOrdersTable.orderId, orderIdRaw),
          });
          
          if (pendingOrder) {
            // Check if already processed
            if (pendingOrder.status === "paid") {
              console.log("[Telegram Order] Order already processed:", orderIdRaw);
            } else {
              // Parse items
              const items = JSON.parse(pendingOrder.items as string);
              
              // Get user's email (or use placeholder for Telegram orders)
              const user = await db.query.users.findFirst({
                where: eq(usersTable.id, pendingOrder.userId),
              });
              const userEmail = user?.email || `telegram-${pendingOrder.chatId}@bot.puerpub.ru`;
              
              // Create real order (total is in kopecks, convert to rubles for orders table)
              const totalRubles = pendingOrder.total / 100;
              const usedFirstOrderDiscount = pendingOrder.discountType === "first_order";
              
              const [newOrder] = await db.insert(ordersTable).values({
                userId: pendingOrder.userId,
                name: pendingOrder.name,
                email: userEmail,
                phone: pendingOrder.phone,
                address: pendingOrder.address,
                items: JSON.stringify(items.map((i: any) => ({
                  id: i.id,
                  name: i.name,
                  pricePerGram: i.pricePerGram,
                  quantity: i.quantity,
                }))),
                total: totalRubles,
                status: "paid",
                usedFirstOrderDiscount,
                paymentStatus: "CONFIRMED",
                paymentId: String(notification.PaymentId),
                telegramChatId: pendingOrder.chatId, // Save chat ID for receipt delivery
              }).returning();
              
              console.log("[Telegram Order] Created order:", newOrder.id, "for Telegram order:", orderIdRaw);
              
              // Update pending order status
              await db.update(pendingTelegramOrdersTable)
                .set({ status: "paid" })
                .where(eq(pendingTelegramOrdersTable.id, pendingOrder.id));
              
              // Clear cart
              await db.delete(telegramCartTable)
                .where(eq(telegramCartTable.userId, pendingOrder.userId));
              
              // Award XP if user exists (user was already queried above for email)
              if (user) {
                const xpToAdd = Math.floor(pendingOrder.total / 100); // 1 XP per ruble
                
                if (!user.firstOrderDiscountUsed && pendingOrder.discountType === "first_order") {
                  await db.update(usersTable)
                    .set({ 
                      xp: sql`${usersTable.xp} + ${xpToAdd}`,
                      firstOrderDiscountUsed: true,
                    })
                    .where(eq(usersTable.id, user.id));
                } else {
                  await db.update(usersTable)
                    .set({ xp: sql`${usersTable.xp} + ${xpToAdd}` })
                    .where(eq(usersTable.id, user.id));
                }
                
                console.log("[Telegram Order] Awarded", xpToAdd, "XP to user:", user.id);
              }
              
              // Send confirmation to customer's Telegram chat
              try {
                const { sendMessage } = await import("./services/telegramBot");
                await sendMessage(pendingOrder.chatId, `✅ <b>Заказ #${newOrder.id} оплачен!</b>

Спасибо за покупку! Мы свяжемся с вами для уточнения деталей доставки.

💰 Сумма: ${(pendingOrder.total / 100).toLocaleString("ru-RU")} ₽`, {
                  inline_keyboard: [[{ text: "🏠 Главное меню", callback_data: "main_menu" }]],
                });
              } catch (telegramError) {
                console.error("[Telegram Order] Failed to send confirmation:", telegramError);
              }
              
              // Send order notification to admin group chat
              try {
                await sendTelegramOrderNotification(newOrder);
              } catch (adminNotifyError) {
                console.error("[Telegram Order] Failed to send admin notification:", adminNotifyError);
              }
              
              console.log("[Telegram Order] ✅ Order completed:", orderIdRaw);
            }
          } else {
            console.error("[Telegram Order] Pending order not found:", orderIdRaw);
          }
        }
        
        res.send(tinkoffClient.getNotificationSuccessResponse());
        return;
      }

      // Handle fiscalization notification (Status = "RECEIPT") for Telegram orders
      if (paymentStatus === "RECEIPT" && typeof orderIdRaw === 'string' && orderIdRaw.startsWith("T_")) {
        console.log("[Telegram Order] Received RECEIPT notification:", orderIdRaw);
        console.log("[Telegram Order] Full RECEIPT notification:", JSON.stringify(notification, null, 2));
        
        // Extract receipt URL
        let receiptUrl: string | null = null;
        if (notification.Url) {
          receiptUrl = notification.Url;
        } else if (notification.Receipt?.ReceiptUrl) {
          receiptUrl = notification.Receipt.ReceiptUrl;
        } else if (notification.ReceiptUrl) {
          receiptUrl = notification.ReceiptUrl;
        }
        
        if (receiptUrl) {
          // Find the real order by paymentId - this has telegramChatId saved
          const realOrder = await db.query.orders.findFirst({
            where: eq(ordersTable.paymentId, String(notification.PaymentId)),
          });
          
          // Update order with receipt URL
          if (realOrder) {
            await db.update(ordersTable)
              .set({ receiptUrl: receiptUrl })
              .where(eq(ordersTable.id, realOrder.id));
            
            // Get chat ID from order (saved during CONFIRMED)
            const chatId = realOrder.telegramChatId;
            
            if (chatId) {
              // Send receipt to Telegram user
              try {
                const { sendMessage } = await import("./services/telegramBot");
                await sendMessage(chatId, `🧾 <b>Электронный чек по заказу #${realOrder.id}</b>

<a href="${receiptUrl}">Открыть чек</a>

Чек сформирован и доступен по ссылке выше.`, {
                  inline_keyboard: [[{ text: "🏠 Главное меню", callback_data: "main_menu" }]],
                });
                console.log("[Telegram Order] ✅ Receipt sent to Telegram:", chatId);
              } catch (telegramError) {
                console.error("[Telegram Order] Failed to send receipt:", telegramError);
              }
            } else {
              console.warn("[Telegram Order] No telegramChatId on order", realOrder.id);
            }
          } else {
            console.warn("[Telegram Order] Real order not found for paymentId:", notification.PaymentId);
          }
        } else {
          console.warn("[Telegram Order] No receipt URL in notification");
        }
        
        res.send(tinkoffClient.getNotificationSuccessResponse());
        return;
      }

      const orderId = parseInt(orderIdRaw);

      // Handle fiscalization notification (Status = "RECEIPT")
      if (paymentStatus === "RECEIPT") {
        console.log("[Payment] Received fiscalization notification for order:", orderId);
        console.log("[Payment] Full RECEIPT notification:", JSON.stringify(notification, null, 2));
        
        // Extract receipt URL from notification - try multiple possible locations
        let receiptUrl: string | null = null;
        
        // Try various possible receipt URL locations in notification
        // Priority: direct Url field (most common in real Tinkoff payloads) > nested fields
        if (notification.Url) {
          // Tinkoff sends receipt URL directly in "Url" field for RECEIPT notifications
          receiptUrl = notification.Url;
        } else if (notification.Receipt?.ReceiptUrl) {
          receiptUrl = notification.Receipt.ReceiptUrl;
        } else if (notification.ReceiptUrl) {
          receiptUrl = notification.ReceiptUrl;
        } else if (notification.Receipt?.Url) {
          receiptUrl = notification.Receipt.Url;
        } else if (notification.Receipts && Array.isArray(notification.Receipts) && notification.Receipts.length > 0) {
          const receiptWithUrl = notification.Receipts.find((r: any) => r.Url || r.ReceiptUrl);
          if (receiptWithUrl) {
            receiptUrl = receiptWithUrl.Url || receiptWithUrl.ReceiptUrl;
          }
        }
        
        if (!receiptUrl) {
          console.warn("[Payment] No receipt URL found in fiscalization notification for order:", orderId);
          console.warn("[Payment] Available notification fields:", Object.keys(notification));
          res.send(tinkoffClient.getNotificationSuccessResponse());
          return;
        }

        console.log("[Payment] Receipt URL extracted:", receiptUrl);

        // Find order
        const order = await db.query.orders.findFirst({
          where: eq(ordersTable.id, orderId),
        });

        if (!order) {
          console.error("[Payment] Order not found:", orderId);
          res.status(404).send("Order not found");
          return;
        }

        // Cancel any pending fallback timers FIRST
        cancelReceiptFallback(orderId);

        // ATOMIC: Try to claim SMS sending rights with conditional update
        // Only updates if receiptSmsSent is still false (prevents race conditions)
        const updateResult = await db.update(ordersTable)
          .set({ 
            paymentStatus: paymentStatus,
            receiptUrl: receiptUrl,
            receiptSmsSent: true,
          })
          .where(and(eq(ordersTable.id, orderId), eq(ordersTable.receiptSmsSent, false)));

        // Check if we won the race (row was updated)
        // If rowCount is 0, another process already set the flag
        if (updateResult.rowCount === 0) {
          console.log("[Payment] Receipt SMS already sent for order:", orderId, "- skipping (lost race)");
          // Still update receiptUrl if needed (without changing flag)
          await db.update(ordersTable)
            .set({ receiptUrl: receiptUrl, paymentStatus: paymentStatus })
            .where(eq(ordersTable.id, orderId));
          res.send(tinkoffClient.getNotificationSuccessResponse());
          return;
        }

        console.log("[Payment] Won SMS race for order:", orderId, "- sending SMS");

        // Send SMS with receipt
        try {
          const normalizedPhone = normalizePhone(order.phone);
          await sendReceiptSms(normalizedPhone, receiptUrl, orderId);
          console.log("[Payment] ✅ Receipt SMS sent successfully to", normalizedPhone);
        } catch (error) {
          console.error("[Payment] ⚠️ Failed to send receipt SMS for order:", orderId);
          console.error("[Payment] Error:", error);
          console.error("[Payment] Receipt URL:", receiptUrl);
          console.error("[Payment] Customer phone:", order.phone);
          console.error("[Payment] ⚠️ MANUAL ACTION: Send receipt to customer manually");
          
          // Reset flag so manual retry can work
          await db.update(ordersTable)
            .set({ receiptSmsSent: false })
            .where(eq(ordersTable.id, orderId));
          
          // Try to send Telegram notification to admin (don't fail webhook if this fails)
          try {
            const smsText = `Спасибо за заказ #${orderId}! Ваш чек: ${receiptUrl}`;
            await sendFailedReceiptSmsNotification(orderId, order.phone, smsText);
          } catch (telegramError) {
            console.error("[Payment] ⚠️ Failed to send Telegram notification:", telegramError);
            // Continue anyway - receipt is already saved
          }
        }

        res.send(tinkoffClient.getNotificationSuccessResponse());
        return;
      }

      // Update order payment status
      await db.update(ordersTable)
        .set({
          paymentStatus: paymentStatus,
          status: paymentStatus === "CONFIRMED" ? "paid" : 
                  paymentStatus === "REJECTED" ? "cancelled" : "pending",
        })
        .where(eq(ordersTable.id, orderId));

      console.log("[Payment] Order", orderId, "payment status updated to:", paymentStatus);

      // If payment confirmed, process receipt and award XP
      if (paymentStatus === "CONFIRMED") {
        const order = await db.query.orders.findFirst({
          where: eq(ordersTable.id, orderId),
        });

        if (order) {
          // Get full payment state to extract receipt URL
          const paymentState = await tinkoffClient.getState(notification.PaymentId);
          console.log("[Payment] Full GetState response:", JSON.stringify(paymentState, null, 2));

          // Extract receipt URL from response
          // Tinkoff returns fiscal receipts in Receipts array with Url field
          let receiptUrl: string | null = null;
          
          // Try Receipts array first (primary location for fiscal receipts)
          if (paymentState.Receipts && Array.isArray(paymentState.Receipts) && paymentState.Receipts.length > 0) {
            // Find the first receipt with a URL (usually lk.platformaofd.ru)
            const receiptWithUrl = paymentState.Receipts.find((r: any) => r.Url);
            if (receiptWithUrl) {
              receiptUrl = receiptWithUrl.Url;
            }
          }
          
          // Fallback to legacy fields if Receipts array not available
          if (!receiptUrl) {
            if (typeof paymentState.Receipt === 'string') {
              receiptUrl = paymentState.Receipt;
            } else if (paymentState.Receipt?.Url) {
              receiptUrl = paymentState.Receipt.Url;
            } else if (paymentState.ReceiptUrl) {
              receiptUrl = paymentState.ReceiptUrl;
            }
          }

          console.log("[Payment] Receipt URL extracted:", receiptUrl);

          // Save receipt URL to order and send SMS
          if (receiptUrl) {
            // Receipt available immediately - send now
            await db.update(ordersTable)
              .set({ receiptUrl: receiptUrl })
              .where(eq(ordersTable.id, orderId));
            
            console.log("[Payment] Receipt URL saved for order:", orderId);

            // Send SMS with receipt link (normalize phone first)
            try {
              const normalizedPhone = normalizePhone(order.phone);
              await sendReceiptSms(normalizedPhone, receiptUrl, orderId);
            } catch (error) {
              // This catches both normalization errors and SMS sending errors
              console.error("[Payment] ⚠️ CRITICAL: Failed to send receipt SMS for order:", orderId);
              console.error("[Payment] Error details:", error);
              console.error("[Payment] Receipt URL:", receiptUrl);
              console.error("[Payment] Customer phone (raw):", order.phone);
              console.error("[Payment] ⚠️ MANUAL ACTION: Send receipt to customer manually");
              // Don't fail the webhook - graceful degradation
            }
          } else {
            // Receipt not ready yet - Tinkoff will send RECEIPT webhook (typically 2-10 minutes)
            // Schedule fallback polling in case webhook is missed (starts after 3min delay)
            console.log("[Payment] Receipt not available immediately for order:", orderId);
            console.log("[Payment] PRIMARY: Waiting for RECEIPT webhook from Tinkoff");
            console.log("[Payment] FALLBACK: Scheduled GetState checks at +3/7/12min (if webhook missed)");
            scheduleReceiptFallback(orderId, notification.PaymentId, order.phone);
          }

          // Award XP to user if authenticated
          if (order.userId) {
            const xpToAdd = Math.floor(order.total);
            await db.update(usersTable)
              .set({
                xp: sql`${usersTable.xp} + ${xpToAdd}`,
              })
              .where(eq(usersTable.id, order.userId));

            console.log("[Payment] Added", xpToAdd, "XP to user:", order.userId);
          }
        }
      }

      res.send(tinkoffClient.getNotificationSuccessResponse());
    } catch (error) {
      console.error("[Payment] Notification processing failed:", error);
      res.status(500).send("Internal server error");
    }
  });

  // Check payment status for an order
  app.get("/api/payments/check/:orderId", async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);

      const order = await db.query.orders.findFirst({
        where: eq(ordersTable.id, orderId),
      });

      if (!order) {
        res.status(404).json({ error: "Order not found" });
        return;
      }

      // Security: Verify order ownership
      // Normalize userId - treat empty strings as null
      const orderUserId = order.userId?.trim() || null;
      
      if (req.isAuthenticated()) {
        const userId = (req.user as any).id;
        // Authenticated users can only check payment for their own orders
        if (orderUserId !== null && orderUserId !== userId) {
          res.status(403).json({ error: "Access denied" });
          return;
        }
        // Authenticated users cannot check payment for guest orders
        if (orderUserId === null) {
          res.status(403).json({ error: "Cannot access guest order" });
          return;
        }
      } else {
        // Unauthenticated users can only check payment for guest orders (userId === null)
        if (orderUserId !== null) {
          res.status(401).json({ error: "Authentication required" });
          return;
        }
      }

      if (!order.paymentId) {
        res.json({
          status: "not_initialized",
          paymentStatus: null,
        });
        return;
      }

      // Get latest payment status from Tinkoff
      const tinkoffClient = getTinkoffClient();
      const paymentState = await tinkoffClient.getState(order.paymentId);

      // Update our database if status changed
      if (paymentState.Status !== order.paymentStatus) {
        await db.update(ordersTable)
          .set({
            paymentStatus: paymentState.Status,
            status: paymentState.Status === "CONFIRMED" ? "paid" : 
                    paymentState.Status === "REJECTED" ? "cancelled" : "pending",
          })
          .where(eq(ordersTable.id, orderId));

        console.log("[Payment] Order", orderId, "status synchronized:", paymentState.Status);
      }

      res.json({
        status: "initialized",
        paymentStatus: paymentState.Status,
        paymentUrl: order.paymentUrl,
      });
    } catch (error: any) {
      console.error("[Payment] Failed to check payment status:", error);
      res.status(500).json({ error: error.message || "Failed to check payment status" });
    }
  });

  // ========== WALLET ROUTES ==========

  // Create wallet top-up payment
  app.post("/api/wallet/topup", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { amount } = req.body;

      // Validate amount (in rubles)
      const amountRub = parseInt(amount);
      if (!amountRub || amountRub < 100 || amountRub > 50000) {
        res.status(400).json({ error: "Сумма должна быть от 100 до 50000 рублей" });
        return;
      }

      const amountKopecks = amountRub * 100;

      // Get user for phone
      const user = await db.query.users.findFirst({
        where: eq(usersTable.id, userId),
      });

      if (!user) {
        res.status(404).json({ error: "Пользователь не найден" });
        return;
      }

      // Generate unique wallet order ID: W_timestamp_userId_amount
      const walletOrderId = `W_${Date.now()}_${userId.substring(0, 8)}_${amountRub}`;

      const tinkoffClient = getTinkoffClient();
      
      // Normalize phone for receipt
      const normalizedPhone = normalizePhone(user.phone);
      const phoneForReceipt = normalizedPhone.startsWith('+') 
        ? normalizedPhone.substring(1) 
        : normalizedPhone;

      const baseUrl = process.env.NODE_ENV === 'production' 
        ? 'https://puerpub.replit.app' 
        : `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;

      const paymentRequest = {
        Amount: amountKopecks,
        OrderId: walletOrderId,
        Description: `Пополнение кошелька на ${amountRub}₽`,
        DATA: {
          Phone: phoneForReceipt,
        },
        Receipt: {
          Phone: phoneForReceipt,
          Taxation: "usn_income",
          Items: [{
            Name: `Пополнение кошелька на ${amountRub}₽`,
            Price: amountKopecks,
            Quantity: 1,
            Amount: amountKopecks,
            Tax: "none",
            PaymentMethod: "full_prepayment",
            PaymentObject: "service",
          }],
        },
        NotificationURL: `${baseUrl}/api/payments/notification`,
        SuccessURL: `${baseUrl}/wallet/success?amount=${amountRub}`,
        FailURL: `${baseUrl}/wallet/error`,
      };

      console.log("[Wallet] Creating top-up payment:", walletOrderId, "Amount:", amountRub);

      const paymentResponse = await tinkoffClient.init(paymentRequest);

      console.log("[Wallet] Payment created, PaymentId:", paymentResponse.PaymentId);

      res.json({
        success: true,
        paymentUrl: paymentResponse.PaymentURL,
        paymentId: paymentResponse.PaymentId,
        walletOrderId,
      });
    } catch (error: any) {
      console.error("[Wallet] Top-up creation failed:", error);
      res.status(500).json({ error: error.message || "Ошибка при создании платежа" });
    }
  });

  // Get wallet balance and transactions
  app.get("/api/wallet", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const user = await db.query.users.findFirst({
        where: eq(usersTable.id, userId),
      });

      if (!user) {
        res.status(404).json({ error: "Пользователь не найден" });
        return;
      }

      // Get recent transactions
      const transactions = await db
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.userId, userId))
        .orderBy(desc(walletTransactions.createdAt))
        .limit(20);

      res.json({
        balance: user.walletBalance || 0,
        transactions,
      });
    } catch (error: any) {
      console.error("[Wallet] Get balance failed:", error);
      res.status(500).json({ error: "Ошибка при получении баланса" });
    }
  });

  // ========== TELEGRAM ROUTES ==========

  // Telegram Magic Link - Create link for account binding
  app.post("/api/telegram/magic-link", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const existingProfile = await getUserTelegramProfile(userId);
      if (existingProfile) {
        res.status(400).json({ error: "Telegram уже привязан к вашему аккаунту" });
        return;
      }
      
      const result = await createMagicLink(userId, "telegram");
      
      if (!result.success || !result.token) {
        res.status(500).json({ error: result.error || "Не удалось создать ссылку" });
        return;
      }
      
      // Generate short code from token (first 8 chars uppercase)
      const shortCode = result.token.substring(0, 8).toUpperCase();
      const botUsername = "PuerPabbot";
      const deepLink = `https://t.me/${botUsername}`;
      
      res.json({ 
        success: true, 
        deepLink,
        shortCode,
        token: result.token,
        expiresIn: 15
      });
    } catch (error) {
      console.error("[Telegram] Magic link creation error:", error);
      res.status(500).json({ error: "Ошибка при создании ссылки" });
    }
  });

  // Telegram Profile - Get linked Telegram info
  app.get("/api/telegram/profile", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const profile = await getUserTelegramProfile(userId);
      
      if (!profile) {
        res.json({ linked: false });
        return;
      }
      
      res.json({
        linked: true,
        username: profile.username,
        firstName: profile.firstName,
        linkedAt: profile.createdAt,
      });
    } catch (error) {
      console.error("[Telegram] Get profile error:", error);
      res.status(500).json({ error: "Ошибка при получении профиля" });
    }
  });

  // Telegram Unlink - Remove Telegram binding
  app.delete("/api/telegram/profile", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const success = await unlinkTelegram(userId);
      
      if (!success) {
        res.status(400).json({ error: "Telegram не привязан к вашему аккаунту" });
        return;
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("[Telegram] Unlink error:", error);
      res.status(500).json({ error: "Ошибка при отвязке Telegram" });
    }
  });

  // Telegram Bot Webhook
  app.post("/api/telegram/webhook", async (req, res) => {
    try {
      const update = req.body;
      console.log("[Telegram Bot] Webhook received update:", update?.update_id);
      
      await handleWebhookUpdate(update);
      
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error("[Telegram Bot] Webhook error:", error);
      res.status(200).json({ ok: true });
    }
  });

  // Admin: Set/Get webhook info
  app.post("/api/admin/telegram/webhook", requireAdminAuth, async (req, res) => {
    try {
      const { webhookUrl } = req.body;
      
      if (webhookUrl) {
        const success = await setWebhook(webhookUrl);
        res.json({ success, message: success ? "Webhook установлен" : "Ошибка установки webhook" });
      } else {
        const info = await getWebhookInfo();
        res.json(info);
      }
    } catch (error) {
      console.error("[Telegram Bot] Webhook setup error:", error);
      res.status(500).json({ error: "Failed to configure webhook" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
