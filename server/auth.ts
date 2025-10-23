import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, updateUserSchema } from "@shared/schema";
import { z } from "zod";
import { sendVerificationEmail } from "./resend";

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

// Remove password and verification code from user object before sending to client
function sanitizeUser(user: SelectUser) {
  const { password, verificationCode, verificationCodeExpires, ...sanitized } = user;
  return sanitized;
}

// Generate a 6-digit verification code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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

  // Use email field instead of username
  passport.use(
    new LocalStrategy(
      { usernameField: 'email' },
      async (email, password, done) => {
        const user = await storage.getUserByEmail(email);
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
      const existingUser = await storage.getUserByEmail(req.body.email);
      
      // Generate verification code
      const verificationCode = generateVerificationCode();
      const verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      
      let user;
      
      if (existingUser) {
        // If user exists but is not verified, allow re-registration with new password
        if (!existingUser.emailVerified) {
          const hashedPassword = await hashPassword(req.body.password);
          user = await storage.updateUnverifiedUser(
            existingUser.id,
            hashedPassword,
            verificationCode,
            verificationCodeExpires
          );
          console.log('[Auth] Updated unverified user:', existingUser.email);
        } else {
          // If user is verified, they can't re-register
          return res.status(400).json({ error: "Email уже используется" });
        }
      } else {
        // Create new user
        user = await storage.createUser({
          ...req.body,
          password: await hashPassword(req.body.password),
          emailVerified: false,
          verificationCode,
          verificationCodeExpires,
        });
        console.log('[Auth] Created new user:', user.email);
      }

      // Send verification email
      try {
        await sendVerificationEmail(user!.email, verificationCode, user!.name || undefined);
      } catch (emailError) {
        console.error('[Auth] Failed to send verification email:', emailError);
        // Don't fail registration if email fails - user can request resend
      }

      // Return success without logging in
      res.status(201).json({ 
        message: "Регистрация успешна. Проверьте вашу почту для подтверждения.",
        email: user!.email,
        needsVerification: true
      });
    } catch (error) {
      console.error('[Auth] Registration error:', error);
      return res.status(500).json({ error: "Ошибка при регистрации" });
    }
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    // Check if email is verified
    if (!req.user!.emailVerified) {
      return res.status(403).json({
        error: "Email не подтвержден",
        needsVerification: true,
        email: req.user!.email
      });
    }
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

  // Verify email with code
  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      const { email, code } = req.body;

      if (!email || !code) {
        return res.status(400).json({ error: "Email и код обязательны" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ error: "Пользователь не найден" });
      }

      if (user.emailVerified) {
        return res.status(400).json({ error: "Email уже подтвержден" });
      }

      if (!user.verificationCode || !user.verificationCodeExpires) {
        return res.status(400).json({ error: "Код верификации не найден" });
      }

      // Check if code is expired
      if (new Date() > user.verificationCodeExpires) {
        return res.status(400).json({ error: "Код верификации истек" });
      }

      // Check if code matches
      if (user.verificationCode !== code) {
        return res.status(400).json({ error: "Неверный код верификации" });
      }

      // Verify the user
      const updated = await storage.verifyUser(user.id);
      if (!updated) {
        return res.status(500).json({ error: "Не удалось подтвердить email" });
      }

      res.json({ success: true, message: "Email успешно подтвержден!" });
    } catch (error) {
      console.error('[Auth] Verification error:', error);
      res.status(500).json({ error: "Ошибка при верификации" });
    }
  });

  // Resend verification code
  app.post("/api/auth/resend-verification", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email обязателен" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ error: "Пользователь не найден" });
      }

      if (user.emailVerified) {
        return res.status(400).json({ error: "Email уже подтвержден" });
      }

      // Generate new verification code
      const verificationCode = generateVerificationCode();
      const verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      await storage.updateVerificationCode(user.id, verificationCode, verificationCodeExpires);

      // Send verification email
      try {
        await sendVerificationEmail(user.email, verificationCode, user.name || undefined);
        res.json({ success: true, message: "Код верификации отправлен повторно" });
      } catch (emailError) {
        console.error('[Auth] Failed to resend verification email:', emailError);
        return res.status(500).json({ error: "Не удалось отправить email" });
      }
    } catch (error) {
      console.error('[Auth] Resend verification error:', error);
      res.status(500).json({ error: "Ошибка при отправке кода" });
    }
  });
}
