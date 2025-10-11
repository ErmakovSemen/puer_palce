import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { quizConfigSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Quiz config routes
  app.get("/api/quiz/config", async (_req, res) => {
    try {
      const config = await storage.getQuizConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: "Failed to get quiz config" });
    }
  });

  app.put("/api/quiz/config", async (req, res) => {
    try {
      const config = quizConfigSchema.parse(req.body);
      const updated = await storage.updateQuizConfig(config);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid quiz config" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
