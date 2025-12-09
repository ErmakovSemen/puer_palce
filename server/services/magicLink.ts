import { randomBytes, createHash } from "crypto";
import { db } from "../db";
import { magicLinks, telegramProfiles, users } from "@shared/schema";
import { eq, and, isNull, lt } from "drizzle-orm";

const TOKEN_EXPIRY_MINUTES = 15;

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface MagicLinkResult {
  success: boolean;
  token?: string;
  error?: string;
}

export async function createMagicLink(
  userId: string,
  channel: "telegram" | "web" = "telegram"
): Promise<MagicLinkResult> {
  try {
    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000).toISOString();

    await db.insert(magicLinks).values({
      userId,
      tokenHash,
      channel,
      expiresAt,
    });

    console.log(`[MagicLink] Created token for user ${userId}, expires ${expiresAt}`);
    
    return { success: true, token };
  } catch (error) {
    console.error("[MagicLink] Create error:", error);
    return { success: false, error: "Failed to create magic link" };
  }
}

export interface ValidateMagicLinkResult {
  success: boolean;
  userId?: string;
  error?: string;
}

export async function validateAndConsumeMagicLink(
  token: string,
  chatId: string
): Promise<ValidateMagicLinkResult> {
  try {
    const tokenHash = hashToken(token);

    const [link] = await db
      .select()
      .from(magicLinks)
      .where(
        and(
          eq(magicLinks.tokenHash, tokenHash),
          isNull(magicLinks.consumedAt)
        )
      );

    if (!link) {
      return { success: false, error: "Ссылка недействительна или уже использована" };
    }

    const now = new Date();
    const expiresAt = new Date(link.expiresAt);

    if (now > expiresAt) {
      return { success: false, error: "Срок действия ссылки истёк" };
    }

    const [existingProfile] = await db
      .select()
      .from(telegramProfiles)
      .where(eq(telegramProfiles.userId, link.userId));

    if (existingProfile && existingProfile.chatId !== chatId) {
      return { success: false, error: "Этот аккаунт уже привязан к другому Telegram" };
    }

    await db
      .update(magicLinks)
      .set({ consumedAt: now.toISOString() })
      .where(eq(magicLinks.id, link.id));

    const [profile] = await db
      .select()
      .from(telegramProfiles)
      .where(eq(telegramProfiles.chatId, chatId));

    if (profile) {
      await db
        .update(telegramProfiles)
        .set({ 
          userId: link.userId,
          lastSeen: now.toISOString()
        })
        .where(eq(telegramProfiles.id, profile.id));
    } else {
      await db.insert(telegramProfiles).values({
        chatId,
        userId: link.userId,
      });
    }

    console.log(`[MagicLink] Successfully linked user ${link.userId} to Telegram chat ${chatId}`);
    
    return { success: true, userId: link.userId };
  } catch (error) {
    console.error("[MagicLink] Validate error:", error);
    return { success: false, error: "Ошибка при подтверждении ссылки" };
  }
}

export async function getUserTelegramProfile(userId: string) {
  try {
    const [profile] = await db
      .select()
      .from(telegramProfiles)
      .where(eq(telegramProfiles.userId, userId));
    return profile || null;
  } catch (error) {
    console.error("[MagicLink] Get profile error:", error);
    return null;
  }
}

export async function unlinkTelegram(userId: string): Promise<boolean> {
  try {
    const [profile] = await db
      .select()
      .from(telegramProfiles)
      .where(eq(telegramProfiles.userId, userId));

    if (!profile) {
      return false;
    }

    await db
      .update(telegramProfiles)
      .set({ userId: null })
      .where(eq(telegramProfiles.id, profile.id));

    console.log(`[MagicLink] Unlinked Telegram for user ${userId}`);
    return true;
  } catch (error) {
    console.error("[MagicLink] Unlink error:", error);
    return false;
  }
}

export async function cleanupExpiredMagicLinks(): Promise<number> {
  try {
    const now = new Date().toISOString();
    await db
      .delete(magicLinks)
      .where(
        and(
          isNull(magicLinks.consumedAt),
          lt(magicLinks.expiresAt, now)
        )
      );
    console.log("[MagicLink] Cleaned up expired magic links");
    return 0;
  } catch (error) {
    console.error("[MagicLink] Cleanup error:", error);
    return 0;
  }
}
