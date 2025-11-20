import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { quizConfigSchema, insertProductSchema, orderSchema, updateSettingsSchema, insertTeaTypeSchema, updateOrderStatusSchema, insertCartItemSchema, updateCartItemSchema, updateSiteSettingsSchema } from "@shared/schema";
import multer from "multer";
import { randomUUID } from "crypto";
import { ObjectStorageService } from "./objectStorage";
import { sendOrderNotification } from "./resend";
import { setupAuth } from "./auth";
import { getTelegramUpdates, sendOrderNotification as sendTelegramOrderNotification } from "./telegram";
import { getLoyaltyDiscount } from "@shared/loyalty";
import { db } from "./db";
import { users as usersTable, orders as ordersTable } from "@shared/schema";
import { eq, sql, desc } from "drizzle-orm";
import { getTinkoffClient } from "./tinkoff";

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

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup user authentication (email/password)
  setupAuth(app);
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

  // Serve public objects
  app.get("/public/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    const objectStorageService = new ObjectStorageService();
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
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
      const { xp } = req.body;
      
      if (typeof xp !== 'number' || xp < 0) {
        res.status(400).json({ error: "Invalid XP value" });
        return;
      }
      
      const updatedUser = await storage.updateUserXP(userId, xp);
      if (!updatedUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      
      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("[Admin] Update user XP error:", error);
      res.status(500).json({ error: "Failed to update user XP" });
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
      const orders = await storage.getOrders(statusFilter);
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
      
      // Convert total to kopecks (1 RUB = 100 kopecks)
      const amountInKopecks = Math.round(order.total * 100);

      // Prepare receipt items for Tinkoff
      const receiptItems = orderItems.map((item: any) => ({
        Name: item.name,
        Price: Math.round(item.pricePerGram * 100), // Price per unit in kopecks
        Quantity: item.quantity,
        Amount: Math.round(item.pricePerGram * item.quantity * 100), // Total in kopecks
        Tax: "none", // Assuming no VAT
      }));

      const baseUrl = process.env.NODE_ENV === "production" 
        ? "https://puerpub.replit.app"
        : `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;

      const paymentRequest = {
        Amount: amountInKopecks,
        OrderId: String(orderId),
        Description: `Заказ #${orderId} - Puer Pub`,
        DATA: {
          Phone: order.phone,
        },
        Receipt: {
          Phone: order.phone,
          Taxation: "usn_income", // Simplified tax system
          Items: receiptItems,
        },
        NotificationURL: `${baseUrl}/api/payments/notification`,
        SuccessURL: `${baseUrl}/payment/success?orderId=${orderId}`,
        FailURL: `${baseUrl}/payment/error?orderId=${orderId}`,
      };

      const paymentResponse = await tinkoffClient.init(paymentRequest);

      // Save payment info to order
      await db.update(ordersTable)
        .set({
          paymentId: paymentResponse.PaymentId,
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

      const orderId = parseInt(notification.OrderId);
      const paymentStatus = notification.Status;

      // Update order payment status
      await db.update(ordersTable)
        .set({
          paymentStatus: paymentStatus,
          status: paymentStatus === "CONFIRMED" ? "paid" : 
                  paymentStatus === "REJECTED" ? "cancelled" : "pending",
        })
        .where(eq(ordersTable.id, orderId));

      console.log("[Payment] Order", orderId, "payment status updated to:", paymentStatus);

      // If payment confirmed, award XP to user
      if (paymentStatus === "CONFIRMED") {
        const order = await db.query.orders.findFirst({
          where: eq(ordersTable.id, orderId),
        });

        if (order?.userId) {
          const xpToAdd = Math.floor(order.total);
          await db.update(usersTable)
            .set({
              xp: sql`${usersTable.xp} + ${xpToAdd}`,
            })
            .where(eq(usersTable.id, order.userId));

          console.log("[Payment] Added", xpToAdd, "XP to user:", order.userId);
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

  const httpServer = createServer(app);

  return httpServer;
}
