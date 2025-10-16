import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";

const app = express();

// CORS configuration for native apps (Capacitor) and web
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow same-origin requests (no origin header means same-origin)
    if (!origin) {
      callback(null, true);
      return;
    }
    
    // Parse origin URL to check protocol and hostname
    try {
      const url = new URL(origin);
      const protocol = url.protocol.replace(':', '');
      const hostname = url.hostname;
      
      // Allow requests from Capacitor/Ionic native apps (with any port)
      if (protocol === 'capacitor' || protocol === 'ionic') {
        callback(null, true);
        return;
      }
      
      // Allow localhost (for development and Capacitor)
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        callback(null, true);
        return;
      }
    } catch (e) {
      // Invalid URL, fall through to default behavior
      log(`Invalid origin URL: ${origin}`);
    }
    
    // In development, allow all origins
    if (process.env.NODE_ENV === 'development') {
      callback(null, true);
      return;
    }
    
    // In production, reject other origins (don't throw error, just return false)
    log(`CORS blocked origin: ${origin}`);
    callback(null, false);
  },
  credentials: true, // Allow cookies and sessions for authentication
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Allow embedding in Replit preview iframe
app.use((req, res, next) => {
  // Allow Replit preview iframe
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://*.replit.com https://*.replit.dev");
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize settings and seed initial products if database is empty
  if ('seedInitialSettings' in storage) {
    await storage.seedInitialSettings();
  }
  if ('seedInitialProducts' in storage) {
    await storage.seedInitialProducts();
  }
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
