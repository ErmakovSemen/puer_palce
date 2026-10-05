import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { pool as defaultPool } from "./db";
import { getLoyaltyDiscountFromSettings } from "../shared/pricing";
import { sendTelegramMessage } from "./telegram";

export const inventoryDDL = `
ALTER TABLE products ADD COLUMN IF NOT EXISTS inventory_only BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS inventory_stock (
 product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE RESTRICT,
 quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
 revision INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE inventory_stock ALTER COLUMN quantity DROP NOT NULL;
CREATE TABLE IF NOT EXISTS inventory_sales (
 id SERIAL PRIMARY KEY, request_id UUID NOT NULL UNIQUE, payload JSONB NOT NULL,
 user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
 buyer TEXT NOT NULL, actor TEXT NOT NULL, lines JSONB NOT NULL,
 total_cents INTEGER NOT NULL, xp INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'completed', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE inventory_sales ADD COLUMN IF NOT EXISTS sale_format TEXT NOT NULL DEFAULT 'loose';
ALTER TABLE inventory_sales ADD COLUMN IF NOT EXISTS subtotal_cents INTEGER;
ALTER TABLE inventory_sales ADD COLUMN IF NOT EXISTS discount_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inventory_sales ADD COLUMN IF NOT EXISTS discount_percent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inventory_sales ADD COLUMN IF NOT EXISTS extra_discount_percent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inventory_sales ADD COLUMN IF NOT EXISTS bonus_kind TEXT;
ALTER TABLE inventory_sales ADD COLUMN IF NOT EXISTS gift JSONB;
ALTER TABLE inventory_sales ADD COLUMN IF NOT EXISTS used_custom_discount BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE inventory_sales ADD COLUMN IF NOT EXISTS corrected_by INTEGER REFERENCES inventory_sales(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS offline_signup_bonus_available BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS inventory_sale_edits (
 id SERIAL PRIMARY KEY, sale_id INTEGER NOT NULL REFERENCES inventory_sales(id),
 actor TEXT NOT NULL, before_state JSONB NOT NULL, after_state JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS inventory_daily_reports (
 report_date DATE PRIMARY KEY, sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_sales_created_idx ON inventory_sales(created_at DESC);
CREATE INDEX IF NOT EXISTS inventory_sale_edits_sale_idx ON inventory_sale_edits(sale_id, created_at DESC);
CREATE TABLE IF NOT EXISTS inventory_movements (
 id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
 sale_id INTEGER REFERENCES inventory_sales(id), delta INTEGER NOT NULL,
 balance INTEGER NOT NULL, price_cents INTEGER NOT NULL, kind TEXT NOT NULL,
 reason TEXT NOT NULL, actor TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE inventory_movements ALTER COLUMN balance DROP NOT NULL;
CREATE INDEX IF NOT EXISTS inventory_movements_product_idx ON inventory_movements(product_id, id DESC);
`;

const actor = z.number().int().positive();
const quantity = z.number().int().min(0).max(10000000);
const saleFormat = z.enum(["loose", "teapot", "ceremony", "cup"]);
const lineFormat = {
  saleFormat: saleFormat.optional(),
  servicePriceCents: z.number().int().min(0).max(10000000).optional(),
};
const saleSchema = z.object({
  requestId: z.string().uuid(),
  actorId: actor,
  userId: z.string().min(1).nullable(),
  saleFormat: saleFormat.default("loose"),
  servicePriceCents: z.number().int().min(1).max(10000000).optional(),
  extraDiscountPercent: z.number().int().min(0).max(100).default(0),
  customerDiscountPercent: z.number().int().min(0).max(100).optional(),
  occurredAt: z.string().datetime({ offset: true }).optional(),
  bonusKind: z.enum(["gift", "discount"]).nullable().optional(),
  gift: z.object({ productId: z.number().int().positive(), quantity: quantity.min(1) }).nullable().optional(),
  lines: z
    .array(
      z.union([
        z.object({
          productId: z.number().int().positive(),
          quantity: quantity.min(1),
          priceCents: z.number().int().min(0).max(10000000),
          priceOverride: z.boolean().optional(),
          ...lineFormat,
        }),
        z.object({
          newTeaName: z
            .string()
            .trim()
            .min(2)
            .max(180)
            .transform((name) => name.replace(/\s+/g, " ")),
          quantity: quantity.min(1),
          priceCents: z.number().int().min(1).max(10000000),
          ...lineFormat,
        }),
      ]),
    )
    .min(1)
    .max(50),
});
const stockSchema = z.object({
  actorId: actor,
  revision: z.number().int().min(0),
  quantity,
  priceCents: z.number().int().min(0).max(10000000),
  reason: z.string().trim().min(2).max(500),
});

class InventoryError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Transactions also lock a request key, so a retry after a lost response is safe.
export async function inventoryTransaction<T>(
  work: (client: any) => Promise<T>,
  connectionPool: any = defaultPool,
): Promise<T> {
  const client = await connectionPool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
async function actorName(client: any, id: number) {
  const { rows } = await client.query(
    "SELECT name FROM crm_admins WHERE id=$1 AND is_active=true",
    [id],
  );
  if (!rows.length)
    throw new InventoryError(400, "Выберите действующего сотрудника");
  return rows[0].name;
}

function sortSaleLines(lines: z.infer<typeof saleSchema>["lines"]) {
  lines.sort((a, b) => {
    if ("productId" in a && "productId" in b) return a.productId - b.productId;
    if ("productId" in a) return -1;
    if ("productId" in b) return 1;
    return a.newTeaName.localeCompare(b.newTeaName, "ru-RU");
  });
}

export async function createInventorySale(input: unknown, connectionPool: any = defaultPool) {
  const data = saleSchema.parse(input);
  return inventoryTransaction((client) => createInventorySaleWork(data, client), connectionPool);
}

async function createInventorySaleWork(data: z.infer<typeof saleSchema>, client: any) {
  const perLinePricing = data.lines.some((line) => line.saleFormat !== undefined);
  if (perLinePricing && data.lines.some((line) => !line.saleFormat ||
    (line.saleFormat !== "loose" && line.servicePriceCents === undefined)))
    throw new InventoryError(400, "Укажите формат и цену каждой позиции");
  if (!perLinePricing && data.saleFormat !== "loose" && data.servicePriceCents === undefined)
    throw new InventoryError(400, "Укажите цену формата продажи");
  if (!perLinePricing) {
    const ids = data.lines.filter((line) => "productId" in line).map((line) => line.productId);
    if (new Set(ids).size !== ids.length)
      throw new InventoryError(400, "Объедините одинаковые позиции");
  }
  if (data.bonusKind && !data.userId)
    throw new InventoryError(400, "Бонус доступен только новому клиенту");
  if (!data.userId && data.customerDiscountPercent)
    throw new InventoryError(400, "Скидка клиента доступна только выбранному клиенту");
  if (data.bonusKind === "gift" && !data.gift)
    throw new InventoryError(400, "Выберите подарочный чай и граммовку");
  if (data.bonusKind !== "gift" && data.gift)
    throw new InventoryError(400, "Подарок не выбран");
  const newNames = data.lines
    .filter(
      (l): l is Extract<typeof l, { newTeaName: string }> => "newTeaName" in l,
    )
    .map((l) => l.newTeaName.toLocaleLowerCase("ru-RU"));
  if (new Set(newNames).size !== newNames.length)
    throw new InventoryError(400, "Объедините одинаковые новые позиции");
  sortSaleLines(data.lines);
  {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      data.requestId,
    ]);
    const prior = await client.query(
      "SELECT * FROM inventory_sales WHERE request_id=$1",
      [data.requestId],
    );
    if (prior.rows.length) {
      const existing = prior.rows[0];
      if (
        JSON.stringify(saleSchema.parse(existing.payload)) !==
        JSON.stringify(data)
      )
        throw new InventoryError(
          409,
          "Повторный запрос отличается от сохранённой продажи",
        );
      return existing;
    }
    const name = await actorName(client, data.actorId);
    let buyer = "Анонимный покупатель";
    let customer: any = null;
    if (data.userId) {
      const user = await client.query(
        "SELECT name,phone,xp,phone_verified,custom_discount,offline_signup_bonus_available,first_order_discount_used FROM users WHERE id=$1 FOR UPDATE",
        [data.userId],
      );
      if (!user.rows.length) throw new InventoryError(404, "Клиент не найден");
      customer = user.rows[0];
      buyer = [customer.name, customer.phone]
        .filter(Boolean)
        .join(" · ");
    }
    if (data.bonusKind && (!customer?.offline_signup_bonus_available || customer.first_order_discount_used))
      throw new InventoryError(409, "Бонус за регистрацию уже использован или недоступен");
    const lines = [];
    let goodsTotal = 0;
    let pricedTotal = 0;
    const reserved = new Map<number, number>();
    for (const line of data.lines) {
      const format = line.saleFormat ?? data.saleFormat;
      const lineCharge = perLinePricing && format !== "loose"
        ? line.servicePriceCents!
        : line.priceCents * line.quantity;
      if ("newTeaName" in line) {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          `inventory-tea:${line.newTeaName.toLocaleLowerCase("ru-RU")}`,
        ]);
        const duplicate = await client.query(
          "SELECT id FROM products WHERE category='tea' AND lower(name)=lower($1) LIMIT 1",
          [line.newTeaName],
        );
        if (duplicate.rows.length)
          throw new InventoryError(
            409,
            `Чай «${line.newTeaName}» уже есть в базе. Выберите его из списка`,
          );
        const created = (
          await client.query(
            "INSERT INTO products(name,category,pricing_unit,price_per_gram,description,tea_type,out_of_stock,inventory_only) VALUES($1,'tea','gram',$2,$3,'Не указан',true,true) RETURNING id",
            [
              line.newTeaName,
              line.priceCents / 100,
              "Создано при продаже в CRM. Перед публикацией заполните карточку.",
            ],
          )
        ).rows[0];
        await client.query(
          "INSERT INTO inventory_stock(product_id,quantity) VALUES($1,NULL)",
          [created.id],
        );
        goodsTotal += line.priceCents * line.quantity;
        pricedTotal += lineCharge;
        lines.push({
          productId: created.id,
          quantity: line.quantity,
          priceCents: line.priceCents,
          name: line.newTeaName,
          unit: "г",
          balance: null,
          saleFormat: format,
          servicePriceCents: format === "loose" ? null : line.servicePriceCents ?? data.servicePriceCents ?? null,
          lineTotalCents: perLinePricing ? lineCharge : null,
        });
        continue;
      }
      const product = (
        await client.query("SELECT * FROM products WHERE id=$1 FOR UPDATE", [
          line.productId,
        ])
      ).rows[0];
      if (!product) throw new InventoryError(404, "Товар не найден");
      if (format !== "loose" && product.category !== "tea")
        throw new InventoryError(400, "Для этого формата выберите чай");
      const price = Math.round(Number(product.price_per_gram) * 100);
      if (price !== line.priceCents && !line.priceOverride)
        throw new InventoryError(
          409,
          `Цена «${product.name}» изменилась. Обновите товары`,
        );
      await client.query(
        "INSERT INTO inventory_stock(product_id,quantity) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [line.productId, product.category === "tea" ? null : 0],
      );
      const stock = (
        await client.query(
          "SELECT * FROM inventory_stock WHERE product_id=$1 FOR UPDATE",
          [line.productId],
        )
      ).rows[0];
      const previouslyReserved = reserved.get(line.productId) || 0;
      if (stock.quantity !== null && stock.quantity < line.quantity + previouslyReserved)
        throw new InventoryError(
          409,
          `Недостаточно остатка «${product.name}»: ${stock.quantity - previouslyReserved}`,
        );
      reserved.set(line.productId, previouslyReserved + line.quantity);
      goodsTotal += line.priceCents * line.quantity;
      pricedTotal += lineCharge;
      lines.push({
        ...line,
        name: product.name,
        unit: product.pricing_unit === "piece" ? "шт" : "г",
        balance:
          stock.quantity === null ? null : stock.quantity - previouslyReserved - line.quantity,
        saleFormat: format,
        servicePriceCents: format === "loose" ? null : line.servicePriceCents ?? data.servicePriceCents ?? null,
        lineTotalCents: perLinePricing ? lineCharge : null,
      });
    }
    if (!Number.isSafeInteger(goodsTotal) || !Number.isSafeInteger(pricedTotal) ||
      goodsTotal > 2000000000 || pricedTotal > 2000000000)
      throw new InventoryError(400, "Слишком большая сумма продажи");
    const settings = (await client.query("SELECT * FROM site_settings LIMIT 1")).rows[0] || {};
    const multiplier = Number(settings.xp_multiplier ?? 1);
    const subtotal = perLinePricing ? pricedTotal : data.saleFormat === "loose" ? goodsTotal : data.servicePriceCents!;
    const formats = new Set(lines.map((line) => line.saleFormat));
    const receiptFormat = formats.size === 1 ? lines[0].saleFormat : "mixed";
    const loyalty = customer?.phone_verified
      ? getLoyaltyDiscountFromSettings(Number(customer.xp), {
          loyaltyLevel2MinXP: settings.loyalty_level2_min_xp,
          loyaltyLevel2Discount: settings.loyalty_level2_discount,
          loyaltyLevel3MinXP: settings.loyalty_level3_min_xp,
          loyaltyLevel3Discount: settings.loyalty_level3_discount,
          loyaltyLevel4MinXP: settings.loyalty_level4_min_xp,
          loyaltyLevel4Discount: settings.loyalty_level4_discount,
        }) : 0;
    const discountPercent = data.bonusKind === "discount" ? 20 :
      data.customerDiscountPercent ?? customer?.custom_discount ?? loyalty;
    const usedCustomDiscount = customer?.custom_discount > 0 && data.bonusKind !== "discount" &&
      (data.customerDiscountPercent === undefined || data.customerDiscountPercent === customer.custom_discount);
    const afterCustomerDiscount = Math.round(subtotal * (100 - discountPercent) / 100);
    const finalTotal = Math.round(afterCustomerDiscount * (100 - data.extraDiscountPercent) / 100);
    const discountCents = subtotal - finalTotal;
    let giftSnapshot: { productId: number; quantity: number; name: string } | null = null;
    if (data.bonusKind === "gift") {
      const giftProduct = (await client.query(
        "SELECT id,name,category FROM products WHERE id=$1 FOR UPDATE", [data.gift!.productId],
      )).rows[0];
      if (!giftProduct || giftProduct.category !== "tea")
        throw new InventoryError(400, "Подарком может быть только чай");
      await client.query("INSERT INTO inventory_stock(product_id,quantity) VALUES($1,NULL) ON CONFLICT DO NOTHING", [giftProduct.id]);
      const giftStock = (await client.query("SELECT quantity FROM inventory_stock WHERE product_id=$1 FOR UPDATE", [giftProduct.id])).rows[0];
      const soldSameTea = lines.filter((line) => line.productId === giftProduct.id).reduce((sum, line) => sum + line.quantity, 0);
      if (giftStock.quantity !== null && giftStock.quantity < data.gift!.quantity + soldSameTea)
        throw new InventoryError(409, "Недостаточно чая для подарка");
      giftSnapshot = { ...data.gift!, name: giftProduct.name };
    }
    const xp = data.userId ? Math.floor((finalTotal / 100) * multiplier) : 0;
    if (!Number.isSafeInteger(xp) || xp < 0 || xp > 2000000000)
      throw new InventoryError(400, "Некорректная сумма XP");
    const sale = (
      await client.query(
        "INSERT INTO inventory_sales(request_id,payload,user_id,buyer,actor,lines,total_cents,xp,sale_format,subtotal_cents,discount_cents,discount_percent,extra_discount_percent,bonus_kind,gift,used_custom_discount) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *",
        [
          data.requestId,
          JSON.stringify(data),
          data.userId,
          buyer,
          name,
          JSON.stringify(lines),
          finalTotal,
          xp,
          receiptFormat,
          subtotal,
          discountCents,
          discountPercent,
          data.extraDiscountPercent,
          data.bonusKind || null,
          giftSnapshot ? JSON.stringify(giftSnapshot) : null,
          usedCustomDiscount,
        ],
      )
    ).rows[0];
    if (data.occurredAt) {
      await client.query("UPDATE inventory_sales SET created_at=$2 WHERE id=$1", [sale.id, data.occurredAt]);
      sale.created_at = data.occurredAt;
    }
    for (const line of lines) {
      await client.query(
        "UPDATE inventory_stock SET quantity=$2,revision=revision+1 WHERE product_id=$1",
        [line.productId, line.balance],
      );
      await client.query(
        "INSERT INTO inventory_movements(product_id,sale_id,delta,balance,price_cents,kind,reason,actor) VALUES($1,$2,$3,$4,$5,'sale',$6,$7)",
        [
          line.productId,
          sale.id,
          -line.quantity,
          line.balance,
          line.priceCents,
          `Продажа №${sale.id}`,
          name,
        ],
      );
    }
    if (data.gift) {
      const giftStock = (await client.query(
        "UPDATE inventory_stock SET quantity=quantity-$2,revision=revision+1 WHERE product_id=$1 RETURNING quantity",
        [data.gift.productId, data.gift.quantity],
      )).rows[0];
      await client.query(
        "INSERT INTO inventory_movements(product_id,sale_id,delta,balance,price_cents,kind,reason,actor) VALUES($1,$2,$3,$4,0,'gift',$5,$6)",
        [data.gift.productId, sale.id, -data.gift.quantity, giftStock.quantity, `Подарок при продаже №${sale.id}`, name],
      );
    }
    if (data.userId) {
      await client.query("UPDATE users SET xp=xp+$2 WHERE id=$1", [
        data.userId,
        xp,
      ]);
      await client.query(
        "INSERT INTO xp_transactions(user_id,amount,reason,description,created_by) VALUES($1,$2,'offline_purchase',$3,$4)",
        [data.userId, xp, `Продажа со склада №${sale.id}`, name],
      );
      if (data.bonusKind) await client.query(
        "UPDATE users SET offline_signup_bonus_available=false,first_order_discount_used=true WHERE id=$1", [data.userId],
      );
      if (usedCustomDiscount) await client.query(
        "UPDATE users SET custom_discount=NULL WHERE id=$1", [data.userId],
      );
    }
    return sale;
  }
}

async function reverseSale(client: any, sale: any, name: string) {
  if (sale.status !== "completed") throw new InventoryError(409, "Продажа уже отменена или исправлена");
  if (sale.user_id) {
    const user = (await client.query("SELECT xp FROM users WHERE id=$1 FOR UPDATE", [sale.user_id])).rows[0];
    if (user) {
      const reversal = Math.min(user.xp, sale.xp);
      await client.query("UPDATE users SET xp=xp-$2 WHERE id=$1", [sale.user_id, reversal]);
      await client.query(
        "INSERT INTO xp_transactions(user_id,amount,reason,description,created_by) VALUES($1,$2,'manual_adjustment',$3,$4)",
        [sale.user_id, -reversal, `Исправление продажи №${sale.id}`, name],
      );
      if (sale.bonus_kind) await client.query(
        "UPDATE users SET offline_signup_bonus_available=true,first_order_discount_used=false WHERE id=$1", [sale.user_id],
      );
      if (sale.used_custom_discount) await client.query(
        "UPDATE users SET custom_discount=COALESCE(custom_discount,$2) WHERE id=$1", [sale.user_id, sale.discount_percent],
      );
    }
  }
  for (const line of [...sale.lines, ...(sale.gift ? [{ ...sale.gift, priceCents: 0 }] : [])]) {
    const stock = (await client.query(
      "UPDATE inventory_stock SET quantity=quantity+$2,revision=revision+1 WHERE product_id=$1 RETURNING quantity",
      [line.productId, line.quantity],
    )).rows[0];
    await client.query(
      "INSERT INTO inventory_movements(product_id,sale_id,delta,balance,price_cents,kind,reason,actor) VALUES($1,$2,$3,$4,$5,'return',$6,$7)",
      [line.productId, sale.id, line.quantity, stock.quantity, line.priceCents, `Исправление продажи №${sale.id}`, name],
    );
  }
}

const moscowDay = (date: Date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit",
}).format(date);

export function dueSalesReportDate(now: Date): string | null {
  const moscowTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(now);
  return moscowTime < "00:05" ? null : moscowDay(new Date(now.getTime() - 24 * 60 * 60 * 1000));
}

async function sendDailySalesReport(connectionPool: any) {
  const date = dueSalesReportDate(new Date());
  if (!date) return;
  const rows = (await connectionPool.query(
    "SELECT sale_format,COUNT(*)::int AS count,COALESCE(SUM(COALESCE(subtotal_cents,total_cents)),0)::int AS subtotal,COALESCE(SUM(discount_cents),0)::int AS discounts,COALESCE(SUM(total_cents),0)::int AS total,COUNT(*) FILTER (WHERE bonus_kind='gift')::int AS gift_count,COUNT(*) FILTER (WHERE bonus_kind='discount')::int AS bonus_discount_count FROM inventory_sales WHERE status='completed' AND (created_at AT TIME ZONE 'Europe/Moscow')::date=$1 GROUP BY sale_format ORDER BY sale_format",
    [date],
  )).rows;
  const count = rows.reduce((sum: number, row: any) => sum + row.count, 0);
  const money = (cents: number) => `${(cents / 100).toLocaleString("ru-RU")} ₽`;
  const total = rows.reduce((sum: number, row: any) => sum + row.total, 0);
  const discounts = rows.reduce((sum: number, row: any) => sum + row.discounts, 0);
  const gifts = rows.reduce((sum: number, row: any) => sum + row.gift_count, 0);
  const bonusDiscounts = rows.reduce((sum: number, row: any) => sum + row.bonus_discount_count, 0);
  const labels: Record<string, string> = { loose: "Рассыпной", teapot: "Чайник", ceremony: "Церемония", cup: "Кружка", mixed: "Смешанный чек" };
  const message = `Продажи чая за ${date}\nПродаж: ${count}\nВыручка: ${money(total)}\nСкидки: ${money(discounts)}\nБонусы новым клиентам: подарки ${gifts}, скидки ${bonusDiscounts}\n` +
    rows.map((row: any) => `${labels[row.sale_format] || row.sale_format}: ${row.count} · ${money(row.total)}`).join("\n");
  await inventoryTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`daily-sales:${date}`]);
    const existing = await client.query("SELECT 1 FROM inventory_daily_reports WHERE report_date=$1", [date]);
    if (existing.rows.length) return;
    if (!await sendTelegramMessage(message)) return;
    await client.query("INSERT INTO inventory_daily_reports(report_date) VALUES($1)", [date]);
  }, connectionPool);
}

export async function registerInventory(
  app: Express,
  auth: RequestHandler,
  connectionPool: any = defaultPool,
) {
  const pool = connectionPool;
  const transaction = <T>(work: (client: any) => Promise<T>) =>
    inventoryTransaction(work, pool);
  await pool.query(inventoryDDL);
  if (pool === defaultPool) {
    const runReport = () => void sendDailySalesReport(pool).catch((error) =>
      console.error("Daily inventory report failed", error));
    runReport();
    setInterval(runReport, 5 * 60 * 1000).unref();
  }
  const route =
    (work: (req: any) => Promise<any>): RequestHandler =>
    async (req, res) => {
      try {
        res.json(await work(req));
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({
            error:
              "Проверьте поля: целые граммы/штуки, цена и сотрудник обязательны",
          });
          return;
        }
        res.status(error instanceof InventoryError ? error.status : 500).json({
          error:
            error instanceof InventoryError
              ? error.message
              : "Не удалось сохранить складскую операцию",
        });
        if (!(error instanceof InventoryError))
          console.error("Inventory error", error);
      }
    };
  app.get(
    "/api/admin/inventory",
    auth,
    route(
      async () =>
        (
          await pool.query(
            "SELECT p.id,p.name,p.category,p.tea_type,p.pricing_unit AS unit,ROUND((p.price_per_gram*100)::numeric)::integer AS price_cents,CASE WHEN s.product_id IS NULL AND p.category='tea' THEN NULL WHEN s.product_id IS NULL THEN 0 ELSE s.quantity END AS quantity,COALESCE(s.revision,0) AS revision FROM products p LEFT JOIN inventory_stock s ON s.product_id=p.id ORDER BY p.name",
          )
        ).rows,
    ),
  );
  app.patch(
    "/api/admin/inventory/:id",
    auth,
    route(async (req) => {
      const id = z.coerce.number().int().positive().parse(req.params.id),
        data = stockSchema.parse(req.body);
      return transaction(async (client) => {
        const name = await actorName(client, data.actorId);
        const product = (
          await client.query(
            "SELECT id,category FROM products WHERE id=$1 FOR UPDATE",
            [id],
          )
        ).rows[0];
        if (!product) throw new InventoryError(404, "Товар не найден");
        await client.query(
          "INSERT INTO inventory_stock(product_id,quantity) VALUES($1,$2) ON CONFLICT DO NOTHING",
          [id, product.category === "tea" ? null : 0],
        );
        const stock = (
          await client.query(
            "SELECT * FROM inventory_stock WHERE product_id=$1 FOR UPDATE",
            [id],
          )
        ).rows[0];
        if (stock.revision !== data.revision)
          throw new InventoryError(
            409,
            "Остаток уже изменился. Обновите склад перед корректировкой",
          );
        await client.query(
          "UPDATE products SET price_per_gram=$2 WHERE id=$1",
          [id, data.priceCents / 100],
        );
        await client.query(
          "UPDATE inventory_stock SET quantity=$2,revision=revision+1 WHERE product_id=$1",
          [id, data.quantity],
        );
        await client.query(
          "INSERT INTO inventory_movements(product_id,delta,balance,price_cents,kind,reason,actor) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [
            id,
            stock.quantity === null ? 0 : data.quantity - stock.quantity,
            data.quantity,
            data.priceCents,
            stock.quantity === null ? "count" : "adjustment",
            data.reason,
            name,
          ],
        );
        return { ok: true };
      });
    }),
  );
  app.post(
    "/api/admin/inventory/sales",
    auth,
    route((req) => createInventorySale(req.body, pool)),
  );
  app.get(
    "/api/admin/inventory/sales",
    auth,
    route(async (req) => {
      const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().parse(req.query.date);
      const search = z.string().trim().max(100).optional().parse(req.query.search) || "";
      const offset = z.coerce.number().int().min(0).default(0).parse(req.query.offset);
      return (await pool.query(
        "SELECT id,request_id,user_id,buyer,actor,lines,total_cents,xp,status,created_at,sale_format,COALESCE(subtotal_cents,total_cents) AS subtotal_cents,discount_cents,discount_percent,extra_discount_percent,bonus_kind,gift,payload FROM inventory_sales WHERE ($1::date IS NULL OR (created_at AT TIME ZONE 'Europe/Moscow')::date=$1::date) AND ($2='' OR buyer ILIKE '%'||$2||'%' OR lines::text ILIKE '%'||$2||'%' OR id::text LIKE '%'||$2||'%') ORDER BY created_at DESC,id DESC LIMIT 100 OFFSET $3",
        [date || null, search, offset],
      )).rows;
    }),
  );
  app.get("/api/admin/inventory/sales/summary", auth, route(async (req) => {
    const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(req.query.date);
    const period = z.enum(["day", "week", "month"]).parse(req.query.period);
    const start = period === "day" ? "$1::date" : `date_trunc('${period}', $1::date)::date`;
    const interval = period === "day" ? "1 day" : period === "week" ? "1 week" : "1 month";
    return (await pool.query(
      `SELECT sale_format,COUNT(*)::int AS count,COALESCE(SUM(COALESCE(subtotal_cents,total_cents)),0)::int AS subtotal_cents,COALESCE(SUM(discount_cents),0)::int AS discount_cents,COALESCE(SUM(total_cents),0)::int AS total_cents,COUNT(*) FILTER (WHERE bonus_kind='gift')::int AS gift_count,COUNT(*) FILTER (WHERE bonus_kind='discount')::int AS bonus_discount_count FROM inventory_sales WHERE status='completed' AND (created_at AT TIME ZONE 'Europe/Moscow')::date >= ${start} AND (created_at AT TIME ZONE 'Europe/Moscow')::date < (${start} + INTERVAL '${interval}') GROUP BY sale_format ORDER BY sale_format`,
      [date],
    )).rows;
  }));
  app.post("/api/admin/inventory/sales/:id/correct", auth, route(async (req) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const data = saleSchema.parse(req.body);
    sortSaleLines(data.lines);
    return transaction(async (client) => {
      const name = await actorName(client, data.actorId);
      const prior = (await client.query("SELECT * FROM inventory_sales WHERE id=$1 FOR UPDATE", [id])).rows[0];
      if (!prior) throw new InventoryError(404, "Продажа не найдена");
      const retry = (await client.query("SELECT * FROM inventory_sales WHERE request_id=$1", [data.requestId])).rows[0];
      if (retry && prior.corrected_by === retry.id) {
        if (JSON.stringify(saleSchema.parse(retry.payload)) !== JSON.stringify(data))
          throw new InventoryError(409, "Повторный запрос отличается от сохранённого исправления");
        return retry;
      }
      if (retry) throw new InventoryError(409, "Ключ исправления уже использован");
      await reverseSale(client, prior, name);
      const corrected = await createInventorySaleWork(data, client);
      await client.query("UPDATE inventory_sales SET status='corrected',corrected_by=$2 WHERE id=$1", [id, corrected.id]);
      await client.query(
        "INSERT INTO inventory_sale_edits(sale_id,actor,before_state,after_state) VALUES($1,$2,$3,$4)",
        [id, name, JSON.stringify(prior), JSON.stringify(corrected)],
      );
      return corrected;
    });
  }));
  app.get(
    "/api/admin/inventory/movements",
    auth,
    route(async (req) => {
      const offset = z.coerce
        .number()
        .int()
        .min(0)
        .default(0)
        .parse(req.query.offset);
      return (
        await pool.query(
          "SELECT m.*,p.name FROM inventory_movements m JOIN products p ON p.id=m.product_id ORDER BY m.id DESC LIMIT 50 OFFSET $1",
          [offset],
        )
      ).rows;
    }),
  );
  app.post(
    "/api/admin/inventory/sales/:id/cancel",
    auth,
    route(async (req) => {
      const id = z.coerce.number().int().positive().parse(req.params.id),
        employee = actor.parse(req.body.actorId);
      return transaction(async (client) => {
        const name = await actorName(client, employee);
        const sale = (
          await client.query(
            "SELECT * FROM inventory_sales WHERE id=$1 FOR UPDATE",
            [id],
          )
        ).rows[0];
        if (!sale) throw new InventoryError(404, "Продажа не найдена");
        if (sale.status === "cancelled") return { ok: true };
        await reverseSale(client, sale, name);
        await client.query(
          "UPDATE inventory_sales SET status='cancelled' WHERE id=$1",
          [id],
        );
        await client.query(
          "INSERT INTO inventory_sale_edits(sale_id,actor,before_state,after_state) VALUES($1,$2,$3,$4)",
          [id, name, JSON.stringify(sale), JSON.stringify({ ...sale, status: "cancelled" })],
        );
        return { ok: true };
      });
    }),
  );
}
