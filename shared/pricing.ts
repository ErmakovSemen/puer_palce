export const BULK_DISCOUNT = 0.10; // 10% for tea items with quantity >= 100g

export interface LoyaltySettings {
  loyaltyLevel2MinXP?: number;
  loyaltyLevel2Discount?: number;
  loyaltyLevel3MinXP?: number;
  loyaltyLevel3Discount?: number;
  loyaltyLevel4MinXP?: number;
  loyaltyLevel4Discount?: number;
}

export function getLoyaltyDiscountFromSettings(xp: number, settings?: LoyaltySettings | null): number {
  const level4MinXP = settings?.loyaltyLevel4MinXP ?? 15000;
  const level3MinXP = settings?.loyaltyLevel3MinXP ?? 7000;
  const level2MinXP = settings?.loyaltyLevel2MinXP ?? 3000;
  if (xp >= level4MinXP) return settings?.loyaltyLevel4Discount ?? 15;
  if (xp >= level3MinXP) return settings?.loyaltyLevel3Discount ?? 10;
  if (xp >= level2MinXP) return settings?.loyaltyLevel2Discount ?? 5;
  return 0;
}

export interface PricingItem {
  category?: string;
  basePrice: number;  // raw pricePerGram, without any discounts
  quantity: number;
}

export interface UserPricingInfo {
  phoneVerified: boolean;
  firstOrderDiscountUsed: boolean;
  customDiscount?: number | null;
}

export interface CartBreakdown {
  baseTotal: number;                  // sum(basePrice * qty) - no discounts at all
  abAdjustedTotal: number;            // baseTotal * abMultiplier (prices user sees on cards)
  abDiscountAmount: number;           // baseTotal - abAdjustedTotal
  bulkDiscountAmount: number;         // bulk savings off abAdjustedTotal
  subtotalAfterItemDiscounts: number; // abAdjustedTotal - bulkDiscountAmount
  firstOrderDiscountAmount: number;
  loyaltyDiscountAmount: number;
  customDiscountAmount: number;
  finalTotal: number;
}

export function calculateCartBreakdown(
  items: PricingItem[],
  user: UserPricingInfo | null | undefined,
  firstOrderDiscountPercent: number,
  loyaltyDiscountPercent: number,
  abMultiplier: number = 1,
): CartBreakdown {
  const abMult = Math.max(0.01, abMultiplier);

  // 1. Base total — raw prices, no discounts
  const baseTotal = items.reduce((sum, item) => sum + item.basePrice * item.quantity, 0);

  // 2. A/B adjusted total — what the user sees on product cards
  const abAdjustedTotal = baseTotal * abMult;
  const abDiscountAmount = baseTotal - abAdjustedTotal;

  // 3. Bulk discount — applied to A/B-adjusted prices
  let bulkDiscountAmount = 0;
  for (const item of items) {
    if (item.category === "tea" && item.quantity >= 100) {
      const abAdjustedItemTotal = item.basePrice * abMult * item.quantity;
      bulkDiscountAmount += abAdjustedItemTotal * BULK_DISCOUNT;
    }
  }

  const subtotalAfterItemDiscounts = abAdjustedTotal - bulkDiscountAmount;
  let runningTotal = subtotalAfterItemDiscounts;

  // 4. First order discount
  const canFirstOrder = !!(user && !user.firstOrderDiscountUsed);
  const firstOrderDiscountAmount = canFirstOrder
    ? runningTotal * (firstOrderDiscountPercent / 100)
    : 0;
  runningTotal -= firstOrderDiscountAmount;

  // 5. Loyalty discount (only for phone-verified users)
  const effectiveLoyaltyPercent = user?.phoneVerified ? loyaltyDiscountPercent : 0;
  const loyaltyDiscountAmount = runningTotal * (effectiveLoyaltyPercent / 100);
  runningTotal -= loyaltyDiscountAmount;

  // 6. Custom discount (individual discount from admin)
  const customDiscountPercent = user?.customDiscount || 0;
  const customDiscountAmount = runningTotal * (customDiscountPercent / 100);
  runningTotal -= customDiscountAmount;

  return {
    baseTotal,
    abAdjustedTotal,
    abDiscountAmount,
    bulkDiscountAmount,
    subtotalAfterItemDiscounts,
    firstOrderDiscountAmount,
    loyaltyDiscountAmount,
    customDiscountAmount,
    finalTotal: Math.max(runningTotal, 0),
  };
}

// ──────────────────────────────────────────────
// A/B Experiment helpers (shared by client + server)
// ──────────────────────────────────────────────

export interface VariantEntry {
  id: string;
  weight: number;
  config: Record<string, unknown>;
}

export interface ExperimentEntry {
  testId: string;
  status: string;
  variants: string; // JSON string
  targetUserIds?: string | null;
}

export function djbx33xHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & 0xFFFFFFFF;
  }
  return Math.abs(hash);
}

export function determineVariantFromHash(
  identifier: string,
  testId: string,
  variants: VariantEntry[],
): VariantEntry {
  if (variants.length === 0) throw new Error("No variants");
  const combined = identifier + "-" + testId;
  const bucket = djbx33xHash(combined) % 100;
  let accumulated = 0;
  for (const variant of variants) {
    accumulated += variant.weight;
    if (bucket < accumulated) return variant;
  }
  return variants[variants.length - 1];
}

export interface AbAssignment {
  testId: string;
  variantId: string;
  multiplier: number;
}

export function getAbAssignmentFromExperiments(
  experiments: ExperimentEntry[],
  identifier: string,
  userId?: string | null,
  savedAssignments?: Record<string, string> | null,
): AbAssignment | null {
  for (const exp of experiments) {
    if (exp.status !== "active") continue;

    let variants: VariantEntry[];
    try {
      variants = JSON.parse(exp.variants) as VariantEntry[];
    } catch {
      continue;
    }
    if (variants.length === 0) continue;

    const hasPriceMulty = variants.some(
      (v) => v.config && typeof v.config.price_multy === "number",
    );
    if (!hasPriceMulty) continue;

    // Respect targetUserIds restriction
    if (exp.targetUserIds) {
      try {
        const targetIds = JSON.parse(exp.targetUserIds) as string[];
        if (Array.isArray(targetIds) && targetIds.length > 0) {
          if (!userId || !targetIds.includes(userId)) continue;
        }
      } catch {}
    }

    // Prefer saved assignment (for logged-in users)
    if (savedAssignments?.[exp.testId]) {
      const savedId = savedAssignments[exp.testId];
      const savedVariant = variants.find((v) => v.id === savedId);
      if (savedVariant && typeof savedVariant.config.price_multy === "number") {
        return {
          testId: exp.testId,
          variantId: savedVariant.id,
          multiplier: savedVariant.config.price_multy as number,
        };
      }
    }

    // Fallback: deterministic hash
    if (identifier) {
      try {
        const variant = determineVariantFromHash(identifier, exp.testId, variants);
        if (typeof variant.config.price_multy === "number") {
          return {
            testId: exp.testId,
            variantId: variant.id,
            multiplier: variant.config.price_multy as number,
          };
        }
      } catch {}
    }
  }
  return null;
}

export function getAbMultiplierFromExperiments(
  experiments: ExperimentEntry[],
  identifier: string,
  userId?: string | null,
  savedAssignments?: Record<string, string> | null,
): number {
  return getAbAssignmentFromExperiments(experiments, identifier, userId, savedAssignments)?.multiplier ?? 1;
}
