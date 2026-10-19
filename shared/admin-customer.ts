export type CustomerPurchase = {
  id: number;
  source: "inventory" | "online";
  createdAt: string;
  status: string;
  totalCents: number;
  comment: string | null;
  lines: { productId: number | null; name: string; quantity: number; unit: string; format: string; isTea: boolean }[];
};

export type AdminCustomerProfile = {
  customer: { id: string | null; contactId: number | null; name: string; phone: string | null; email: string | null; source: string | null; ownerName: string | null; notes: string | null };
  loyalty: { xp: number; levelName: string; discountPercent: number; loyaltyDiscountPercent: number; customDiscount: number | null } | null;
  summary: { purchaseCount: number; totalCents: number; lastPurchaseAt: string | null };
  teas: { key: string; name: string; grams: number; purchases: number; lastAt: string }[];
  purchases: CustomerPurchase[];
  purchaseCount: number;
  xpHistory: { id: number; amount: number; description: string; createdBy: string | null; createdAt: string }[];
  xpCount: number;
};
