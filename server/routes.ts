import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { quizConfigSchema, insertProductSchema, orderSchema, updateSettingsSchema, insertTeaTypeSchema, updateOrderStatusSchema } from "@shared/schema";
import multer from "multer";
import { randomUUID } from "crypto";
import { ObjectStorageService } from "./objectStorage";
import { sendOrderNotification } from "./resend";
import { setupAuth } from "./auth";

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

  // Export products to YML format (Yandex Market Language)
  app.get("/api/products/export/yml", async (req, res) => {
    try {
      const products = await storage.getProducts();
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
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
      const objectStorageService = new ObjectStorageService();
      const uploadedUrls: string[] = [];

      for (const file of req.files) {
        const ext = file.originalname.split('.').pop();
        const filename = `${randomUUID()}.${ext}`;
        console.log(`[Upload] Uploading file: ${filename}`);
        const url = await objectStorageService.uploadPublicObject(file.buffer, filename);
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
      
      // Get userId if user is authenticated
      const userId = req.isAuthenticated() ? (req.user as any).id : null;
      
      // Save order to database
      const savedOrder = await storage.createOrder({
        userId,
        name: orderData.name,
        email: orderData.email,
        phone: orderData.phone,
        address: orderData.address,
        comment: orderData.comment,
        items: JSON.stringify(orderData.items),
        total: orderData.total,
      });
      console.log("[Order] Order saved to database, ID:", savedOrder.id);
      
      // Award XP to authenticated users (1 RUB = 1 XP)
      if (userId) {
        const xpToAward = Math.floor(orderData.total);
        await storage.addUserXP(userId, xpToAward);
        console.log(`[Order] Awarded ${xpToAward} XP to user ${userId}`);
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
      
      const updatedOrder = await storage.updateOrderStatus(orderId, statusData.status);
      if (!updatedOrder) {
        res.status(404).json({ error: "Order not found" });
        return;
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

  const httpServer = createServer(app);

  return httpServer;
}
