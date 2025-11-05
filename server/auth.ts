import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, updateUserSchema, insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { generateVerificationCode, sendSmsCode } from "./sms-ru";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Remove password from user object before sending to client
function sanitizeUser(user: SelectUser) {
  const { password, ...sanitized } = user;
  return sanitized;
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Use phone field instead of email for authentication
  passport.use(
    new LocalStrategy(
      { usernameField: 'phone' },
      async (phone, password, done) => {
        const user = await storage.getUserByPhone(phone);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      }
    ),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    const user = await storage.getUser(id);
    done(null, user);
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const data = insertUserSchema.parse(req.body);
      
      // Check if email already exists (only if email is provided)
      if (data.email) {
        const existingUser = await storage.getUserByEmail(data.email);
        if (existingUser) {
          return res.status(400).json({ error: "Email уже используется" });
        }
      }

      // Check if phone already exists
      const existingPhone = await storage.getUserByPhone(data.phone);
      if (existingPhone) {
        return res.status(400).json({ error: "Номер телефона уже используется" });
      }

      // Create user (phone not yet verified)
      const user = await storage.createUser({
        ...data,
        password: await hashPassword(data.password),
      });

      // Don't log in yet - user needs to verify phone first
      res.status(201).json({
        message: "Пользователь создан. Подтвердите номер телефона.",
        userId: user.id,
        phoneVerified: false,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Ошибка регистрации" });
    }
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.status(200).json(sanitizeUser(req.user!));
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(sanitizeUser(req.user!));
  });

  app.put("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const data = updateUserSchema.parse(req.body);
      const updated = await storage.updateUser(req.user!.id, data);
      
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(sanitizeUser(updated));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // SMS Verification endpoints
  app.post("/api/auth/send-verification-code", async (req, res) => {
    try {
      const { phone, type } = z.object({
        phone: z.string().min(10, "Введите корректный номер телефона"),
        type: z.enum(["registration", "password_reset"]),
      }).parse(req.body);

      // Check rate limit
      const canSend = await storage.checkSmsRateLimit(phone);
      if (!canSend) {
        return res.status(429).json({ 
          error: "Слишком много попыток. Попробуйте через 10 минут." 
        });
      }

      // For password reset, check if user exists
      if (type === "password_reset") {
        const user = await storage.getUserByPhone(phone);
        if (!user) {
          return res.status(404).json({ error: "Пользователь с таким номером не найден" });
        }
      }

      // Generate and hash code
      const code = generateVerificationCode();
      const hashedCode = await hashPassword(code);

      // Save to database
      await storage.createSmsVerification(phone, hashedCode, type);

      // Send SMS
      await sendSmsCode(phone, code);

      // Clean up expired codes
      await storage.cleanupExpiredSmsVerifications();

      res.json({ message: "Код отправлен" });
    } catch (error) {
      console.error("[SMS Verification] Error sending code:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Ошибка отправки кода" });
    }
  });

  app.post("/api/auth/verify-phone", async (req, res) => {
    try {
      const { phone, code, type } = z.object({
        phone: z.string().min(10),
        code: z.string().length(6),
        type: z.enum(["registration", "password_reset"]),
      }).parse(req.body);

      // Get verification record
      const verification = await storage.getSmsVerification(phone, type);
      if (!verification) {
        return res.status(400).json({ error: "Код не найден или истёк" });
      }

      // Check if expired
      if (new Date(verification.expiresAt) < new Date()) {
        await storage.deleteSmsVerification(verification.id);
        return res.status(400).json({ error: "Код истёк. Запросите новый." });
      }

      // Check attempts
      if (verification.attempts >= 3) {
        await storage.deleteSmsVerification(verification.id);
        return res.status(400).json({ error: "Превышено количество попыток. Запросите новый код." });
      }

      // Verify code
      const isValid = await comparePasswords(code, verification.code);
      if (!isValid) {
        await storage.incrementSmsAttempts(verification.id);
        return res.status(400).json({ error: "Неверный код" });
      }

      // Code is valid - delete verification record
      await storage.deleteSmsVerification(verification.id);

      // For registration type, mark phone as verified and log in
      if (type === "registration") {
        const user = await storage.getUserByPhone(phone);
        if (!user) {
          return res.status(404).json({ error: "Пользователь не найден" });
        }

        // Mark phone as verified
        await storage.markPhoneVerified(user.id);

        // Log in the user
        req.login(user, (err) => {
          if (err) {
            return res.status(500).json({ error: "Ошибка входа" });
          }
          res.json({ 
            message: "Телефон подтверждён",
            user: sanitizeUser(user),
          });
        });
      } else {
        // For password reset, return success (next step is to set new password)
        res.json({ message: "Код подтверждён", verified: true });
      }
    } catch (error) {
      console.error("[SMS Verification] Error verifying code:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Ошибка проверки кода" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { phone, newPassword } = z.object({
        phone: z.string().min(10),
        newPassword: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
      }).parse(req.body);

      // Find user
      const user = await storage.getUserByPhone(phone);
      if (!user) {
        return res.status(404).json({ error: "Пользователь не найден" });
      }

      // Update password
      const hashedPassword = await hashPassword(newPassword);
      const updatedUser = await storage.updateUserPassword(user.id, hashedPassword);
      
      if (!updatedUser) {
        return res.status(500).json({ error: "Ошибка обновления пароля" });
      }

      res.json({ message: "Пароль успешно изменён" });
    } catch (error) {
      console.error("[Password Reset] Error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Ошибка сброса пароля" });
    }
  });
}
