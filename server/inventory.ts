import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { pool as defaultPool } from "./db";

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
const saleSchema = z.object({
  requestId: z.string().uuid(),
  actorId: actor,
  userId: z.string().min(1).nullable(),
  lines: z
    .array(
      z.union([
        z.object({
          productId: z.number().int().positive(),
          quantity: quantity.min(1),
          priceCents: z.number().int().min(0).max(10000000),
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

export async function createInventorySale(
  input: unknown,
  connectionPool: any = defaultPool,
) {
  const data = saleSchema.parse(input);
  const existingIds = data.lines
    .filter(
      (l): l is Extract<typeof l, { productId: number }> => "productId" in l,
    )
    .map((l) => l.productId);
  if (new Set(existingIds).size !== existingIds.length)
    throw new InventoryError(400, "Объедините повторяющиеся позиции");
  const newNames = data.lines
    .filter(
      (l): l is Extract<typeof l, { newTeaName: string }> => "newTeaName" in l,
    )
    .map((l) => l.newTeaName.toLocaleLowerCase("ru-RU"));
  if (new Set(newNames).size !== newNames.length)
    throw new InventoryError(400, "Объедините одинаковые новые позиции");
  data.lines.sort((a, b) => {
    if ("productId" in a && "productId" in b) return a.productId - b.productId;
    if ("productId" in a) return -1;
    if ("productId" in b) return 1;
    return a.newTeaName.localeCompare(b.newTeaName, "ru-RU");
  });
  return inventoryTransaction(async (client) => {
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
    if (data.userId) {
      const user = await client.query(
        "SELECT name,phone FROM users WHERE id=$1 FOR UPDATE",
        [data.userId],
      );
      if (!user.rows.length) throw new InventoryError(404, "Клиент не найден");
      buyer = [user.rows[0].name, user.rows[0].phone]
        .filter(Boolean)
        .join(" · ");
    }
    const lines = [];
    let total = 0;
    for (const line of data.lines) {
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
        total += line.priceCents * line.quantity;
        lines.push({
          productId: created.id,
          quantity: line.quantity,
          priceCents: line.priceCents,
          name: line.newTeaName,
          unit: "г",
          balance: null,
        });
        continue;
      }
      const product = (
        await client.query("SELECT * FROM products WHERE id=$1 FOR UPDATE", [
          line.productId,
        ])
      ).rows[0];
      if (!product) throw new InventoryError(404, "Товар не найден");
      const price = Math.round(Number(product.price_per_gram) * 100);
      if (price !== line.priceCents)
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
      if (stock.quantity !== null && stock.quantity < line.quantity)
        throw new InventoryError(
          409,
          `Недостаточно остатка «${product.name}»: ${stock.quantity}`,
        );
      total += price * line.quantity;
      lines.push({
        ...line,
        name: product.name,
        unit: product.pricing_unit === "piece" ? "шт" : "г",
        balance:
          stock.quantity === null ? null : stock.quantity - line.quantity,
      });
    }
    if (!Number.isSafeInteger(total) || total > 2000000000)
      throw new InventoryError(400, "Слишком большая сумма продажи");
    const multiplier = Number(
      (await client.query("SELECT xp_multiplier FROM settings LIMIT 1")).rows[0]
        ?.xp_multiplier ?? 1,
    );
    const xp = data.userId ? Math.floor((total / 100) * multiplier) : 0;
    if (!Number.isSafeInteger(xp) || xp < 0 || xp > 2000000000)
      throw new InventoryError(400, "Некорректная сумма XP");
    const sale = (
      await client.query(
        "INSERT INTO inventory_sales(request_id,payload,user_id,buyer,actor,lines,total_cents,xp) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
        [
          data.requestId,
          JSON.stringify(data),
          data.userId,
          buyer,
          name,
          JSON.stringify(lines),
          total,
          xp,
        ],
      )
    ).rows[0];
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
    if (data.userId) {
      await client.query("UPDATE users SET xp=xp+$2 WHERE id=$1", [
        data.userId,
        xp,
      ]);
      await client.query(
        "INSERT INTO xp_transactions(user_id,amount,reason,description,created_by) VALUES($1,$2,'offline_purchase',$3,$4)",
        [data.userId, xp, `Продажа со склада №${sale.id}`, name],
      );
    }
    return sale;
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
            "SELECT p.id,p.name,p.category,p.pricing_unit AS unit,ROUND((p.price_per_gram*100)::numeric)::integer AS price_cents,CASE WHEN s.product_id IS NULL AND p.category='tea' THEN NULL WHEN s.product_id IS NULL THEN 0 ELSE s.quantity END AS quantity,COALESCE(s.revision,0) AS revision FROM products p LEFT JOIN inventory_stock s ON s.product_id=p.id ORDER BY p.name",
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
    route(
      async () =>
        (
          await pool.query(
            "SELECT id,buyer,actor,lines,total_cents,xp,status,created_at FROM inventory_sales ORDER BY id DESC LIMIT 100",
          )
        ).rows,
    ),
  );
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
        if (sale.user_id) {
          const user = (
            await client.query("SELECT xp FROM users WHERE id=$1 FOR UPDATE", [
              sale.user_id,
            ])
          ).rows[0];
          const reversal = Math.min(user.xp, sale.xp);
          await client.query("UPDATE users SET xp=xp-$2 WHERE id=$1", [
            sale.user_id,
            reversal,
          ]);
          await client.query(
            "INSERT INTO xp_transactions(user_id,amount,reason,description,created_by) VALUES($1,$2,'manual_adjustment',$3,$4)",
            [sale.user_id, -reversal, `Отмена продажи №${id}`, name],
          );
        }
        for (const line of sale.lines) {
          const stock = (
            await client.query(
              "UPDATE inventory_stock SET quantity=quantity+$2,revision=revision+1 WHERE product_id=$1 RETURNING quantity",
              [line.productId, line.quantity],
            )
          ).rows[0];
          await client.query(
            "INSERT INTO inventory_movements(product_id,sale_id,delta,balance,price_cents,kind,reason,actor) VALUES($1,$2,$3,$4,$5,'return',$6,$7)",
            [
              line.productId,
              id,
              line.quantity,
              stock.quantity,
              line.priceCents,
              `Отмена продажи №${id}`,
              name,
            ],
          );
        }
        await client.query(
          "UPDATE inventory_sales SET status='cancelled' WHERE id=$1",
          [id],
        );
        return { ok: true };
      });
    }),
  );
}
