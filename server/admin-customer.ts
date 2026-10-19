import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { pool as defaultPool } from "./db";
import { inventoryTransaction } from "./inventory";
import { getLoyaltyDiscountFromSettings } from "../shared/pricing";
import type { AdminCustomerProfile, CustomerPurchase } from "../shared/admin-customer";

const adjustmentSchema = z.object({
  requestId: z.string().uuid(), actorId: z.number().int().positive(),
  amount: z.number().int().min(-10000000).max(10000000).refine((value) => value !== 0),
  description: z.string().trim().min(2).max(1000),
});
const targetSchema = z.object({
  userId: z.string().trim().min(1).max(200).optional(),
  contactId: z.coerce.number().int().positive().optional(),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
  xpOffset: z.coerce.number().int().min(0).max(1000000).default(0),
}).refine((value) => !!value.userId !== !!value.contactId, "Укажите одного клиента");

function parseItems(value: unknown): any[] {
  try { const parsed = typeof value === "string" ? JSON.parse(value) : value; return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}
const dateString = (value: string | Date) => new Date(value).toISOString();

export function buildPurchaseSummary(purchases: CustomerPurchase[]) {
  const completed = purchases.filter((purchase) => purchase.status === "paid" || purchase.status === "completed");
  const teas = new Map<string, AdminCustomerProfile["teas"][number]>();
  for (const purchase of completed) {
    const seen = new Set<string>();
    for (const line of purchase.lines) {
      if (!line.isTea) continue;
      const key = line.productId === null ? `name:${line.name.toLowerCase()}` : `product:${line.productId}`;
      const tea = teas.get(key) || { key, name: line.name, grams: 0, purchases: 0, lastAt: purchase.createdAt };
      if (line.unit === "gram") tea.grams += line.quantity;
      if (!seen.has(key)) tea.purchases++;
      seen.add(key);
      if (purchase.createdAt > tea.lastAt) tea.lastAt = purchase.createdAt;
      teas.set(key, tea);
    }
  }
  return {
    summary: { purchaseCount: completed.length, totalCents: completed.reduce((sum, purchase) => sum + purchase.totalCents, 0), lastPurchaseAt: completed.map((purchase) => purchase.createdAt).sort().at(-1) || null },
    teas: Array.from(teas.values()).sort((a, b) => b.purchases - a.purchases || b.grams - a.grams),
  };
}

export async function registerAdminCustomer(app: Express, auth: RequestHandler, pool: any = defaultPool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS admin_customer_xp_adjustments (
    request_id UUID PRIMARY KEY, user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor TEXT NOT NULL, amount INTEGER NOT NULL, before_xp INTEGER NOT NULL, after_xp INTEGER NOT NULL,
    description TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  app.get("/api/admin/customer-profile", auth, async (req, res) => {
    const parsed = targetSchema.safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: "Укажите клиента и корректную страницу" }); return; }
    try {
      const { userId, contactId, offset, xpOffset } = parsed.data;
      const contact = (await pool.query(`SELECT c.id,c.user_id,c.name,c.phone,c.email,c.source,c.notes,a.name AS owner_name FROM crm_contacts c LEFT JOIN crm_admins a ON a.id=c.owner_id WHERE ${userId ? "c.user_id=$1" : "c.id=$1"}`, [userId || contactId])).rows[0];
      const id = userId || contact?.user_id;
      const user = id ? (await pool.query("SELECT id,name,phone,email,xp,custom_discount,source FROM users WHERE id=$1", [id])).rows[0] : null;
      if (!user && !contact) { res.status(404).json({ error: "Клиент не найден" }); return; }
      const result: AdminCustomerProfile = {
        customer: { id: user?.id || null, contactId: contact?.id || null, name: user?.name || contact?.name || "Без имени", phone: user?.phone || contact?.phone || null, email: user?.email || contact?.email || null, source: user?.source || contact?.source || null, ownerName: contact?.owner_name || null, notes: contact?.notes || null },
        loyalty: null, summary: { purchaseCount: 0, totalCents: 0, lastPurchaseAt: null }, teas: [], purchases: [], purchaseCount: 0, xpHistory: [], xpCount: 0,
      };
      if (user) {
        const settings = (await pool.query("SELECT * FROM site_settings LIMIT 1")).rows[0] || {};
        const loyaltyDiscount = getLoyaltyDiscountFromSettings(user.xp, {
          loyaltyLevel2MinXP: settings.loyalty_level2_min_xp, loyaltyLevel2Discount: settings.loyalty_level2_discount,
          loyaltyLevel3MinXP: settings.loyalty_level3_min_xp, loyaltyLevel3Discount: settings.loyalty_level3_discount,
          loyaltyLevel4MinXP: settings.loyalty_level4_min_xp, loyaltyLevel4Discount: settings.loyalty_level4_discount,
        });
        const levelName = user.xp >= (settings.loyalty_level4_min_xp ?? 15000) ? "Чайный Гуру" : user.xp >= (settings.loyalty_level3_min_xp ?? 7000) ? "Чайный мастер" : user.xp >= (settings.loyalty_level2_min_xp ?? 3000) ? "Ценитель" : "Новичок";
        result.loyalty = { xp: user.xp, levelName, discountPercent: user.custom_discount ?? loyaltyDiscount, loyaltyDiscountPercent: loyaltyDiscount, customDiscount: user.custom_discount };
        const sales = (await pool.query("SELECT id,created_at,status,total_cents,lines,comment FROM inventory_sales WHERE user_id=$1 ORDER BY created_at DESC,id DESC", [user.id])).rows;
        const orders = (await pool.query("SELECT id,created_at,status,total,items,comment FROM orders WHERE user_id=$1 ORDER BY created_at DESC,id DESC", [user.id])).rows;
        // Do not count unknown website products as tea: they may have been teaware.
        const productIds = Array.from(new Set(orders.flatMap((order: any) => parseItems(order.items).map((item: any) => Number(item.id))).filter((id: number) => Number.isSafeInteger(id) && id > 0)));
        const products = productIds.length ? (await pool.query("SELECT id,category,pricing_unit FROM products WHERE id=ANY($1::int[])", [productIds])).rows : [];
        const byId = new Map<number, any>(products.map((product: any) => [product.id, product]));
        const purchases: CustomerPurchase[] = [
          ...sales.map((sale: any): CustomerPurchase => ({ id: sale.id, source: "inventory", createdAt: dateString(sale.created_at), status: sale.status, totalCents: sale.total_cents, comment: sale.comment || null,
            lines: parseItems(sale.lines).map((line) => ({ productId: line.productId || null, name: line.name, quantity: Number(line.quantity) || 0, unit: line.unit || "gram", format: line.saleFormat || "loose", isTea: line.unit !== "piece" })),
          })),
          ...orders.map((order: any): CustomerPurchase => ({ id: order.id, source: "online", createdAt: dateString(order.created_at), status: order.status, totalCents: Math.round(order.total * 100), comment: order.comment,
            lines: parseItems(order.items).map((line) => { const product = byId.get(Number(line.id)); return { productId: Number(line.id) || null, name: line.name, quantity: Number(line.quantity) || 0, unit: product?.pricing_unit || "gram", format: "online", isTea: product ? product.category === "tea" : false }; }),
          })),
        ].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
        Object.assign(result, buildPurchaseSummary(purchases));
        result.purchases = purchases.slice(offset, offset + 30); result.purchaseCount = purchases.length;
        result.xpHistory = (await pool.query('SELECT id,amount,description,created_by AS "createdBy",created_at AS "createdAt" FROM xp_transactions WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 30 OFFSET $2', [user.id, xpOffset])).rows;
        result.xpCount = Number((await pool.query("SELECT COUNT(*) AS count FROM xp_transactions WHERE user_id=$1", [user.id])).rows[0].count);
      }
      res.json(result);
    } catch (error) { console.error("Admin customer profile error", error); res.status(500).json({ error: "Не удалось загрузить профиль клиента" }); }
  });
  app.post("/api/admin/customer-profile/:userId/xp", auth, async (req, res) => {
    const parsed = adjustmentSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Укажите целое ненулевое количество XP, сотрудника и причину" }); return; }
    const { requestId, actorId, amount, description } = parsed.data;
    const failure = (status: number, message: string) => Object.assign(new Error(message), { status });
    try {
      const result = await inventoryTransaction(async (client) => {
        // Serialize retries before reading the audit row; the user row also protects parallel sales.
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [requestId]);
        const previous = (await client.query("SELECT * FROM admin_customer_xp_adjustments WHERE request_id=$1", [requestId])).rows[0];
        const actor = (await client.query("SELECT name FROM crm_admins WHERE id=$1 AND is_active=true", [actorId])).rows[0];
        if (!actor) throw failure(400, "Выберите действующего сотрудника");
        if (previous) {
          if (previous.user_id !== req.params.userId || previous.amount !== amount || previous.description !== description || previous.actor !== actor.name) throw failure(409, "Этот запрос уже использован для другой операции");
          return { xp: previous.after_xp, repeated: true };
        }
        const user = (await client.query("SELECT xp FROM users WHERE id=$1 FOR UPDATE", [req.params.userId])).rows[0];
        if (!user) throw failure(404, "Клиент не найден");
        const xp = user.xp + amount;
        if (xp < 0 || xp > 2147483647) throw failure(400, "Недостаточно XP для списания или превышен допустимый баланс");
        await client.query("UPDATE users SET xp=$2 WHERE id=$1", [req.params.userId, xp]);
        await client.query("INSERT INTO xp_transactions(user_id,amount,reason,description,created_by) VALUES($1,$2,'manual_adjustment',$3,$4)", [req.params.userId, amount, description, actor.name]);
        await client.query("INSERT INTO admin_customer_xp_adjustments(request_id,user_id,actor,amount,before_xp,after_xp,description) VALUES($1,$2,$3,$4,$5,$6,$7)", [requestId, req.params.userId, actor.name, amount, user.xp, xp, description]);
        return { xp, repeated: false };
      }, pool);
      res.json(result);
    } catch (error: any) { if (!error.status) console.error("Admin customer XP error", error); res.status(error.status || 500).json({ error: error.status ? error.message : "Не удалось изменить XP" }); }
  });
}
