import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import express from "express";
import { PGlite } from "@electric-sql/pglite";

// No real database connection is opened; all queries use the injected test pool.
process.env.DATABASE_URL ||= "postgresql://test:test@localhost/test";

test("warehouse, anonymous/customer sales, retries, rollback and cancellation", async () => {
  const { registerInventory } = await import("./inventory");
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE products(id serial PRIMARY KEY,name text,category text,pricing_unit text,price_per_gram real,description text,tea_type text,out_of_stock boolean DEFAULT false);
    CREATE TABLE users(id varchar PRIMARY KEY,name text,phone text,xp integer NOT NULL DEFAULT 0);
    CREATE TABLE crm_admins(id serial PRIMARY KEY,name text,is_active boolean);
    CREATE TABLE settings(xp_multiplier integer);
    INSERT INTO settings VALUES(1);
    CREATE TABLE xp_transactions(id serial PRIMARY KEY,user_id varchar,amount integer,reason text,description text,created_by text);
    INSERT INTO crm_admins VALUES(1,'Test admin',true);
    INSERT INTO users VALUES('customer','Test customer','000',10);
    INSERT INTO products(id,name,category,pricing_unit,price_per_gram) VALUES(1,'Tea','tea','gram',5.25),(2,'Cup','teaware','piece',300),(3,'Uncounted tea','tea','gram',6.5);
    SELECT setval(pg_get_serial_sequence('products','id'),3);
    -- PGlite is single-connection: this suite tests SQL/rollback, not PostgreSQL lock concurrency.
    CREATE FUNCTION pg_advisory_xact_lock(integer) RETURNS void LANGUAGE SQL AS 'SELECT NULL::void';
  `);
  const pool = {
    query: (sql: string, args?: any[]) =>
      args ? db.query(sql, args) : db.exec(sql),
    connect: async () => ({
      query: (sql: string, args?: any[]) => db.query(sql, args),
      release() {},
    }),
  };
  // SELECT endpoints need a pg-style result; DDL can use exec for multiple statements.
  pool.query = (sql: string, args?: any[]) =>
    sql.includes("CREATE TABLE") ? db.exec(sql) : db.query(sql, args);
  const app = express();
  app.use(express.json());
  await registerInventory(app, (_req, _res, next) => next(), pool);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/admin/inventory`;
  const call = async (
    path: string,
    method = "GET",
    body?: any,
    status = 200,
  ) => {
    const res = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = await res.json();
    assert.equal(res.status, status, JSON.stringify(result));
    return result;
  };
  const scalar = async (sql: string) =>
    Object.values((await db.query(sql)).rows[0] as any)[0];
  try {
    await call("/1", "PATCH", {
      actorId: 1,
      revision: 0,
      quantity: 100,
      priceCents: 525,
      reason: "Initial receipt",
    });
    await call("/2", "PATCH", {
      actorId: 1,
      revision: 0,
      quantity: 2,
      priceCents: 30000,
      reason: "Initial receipt",
    });
    await call(
      "/1",
      "PATCH",
      {
        actorId: 1,
        revision: 0,
        quantity: 999,
        priceCents: 525,
        reason: "Stale edit",
      },
      409,
    );
    const payload = {
      requestId: crypto.randomUUID(),
      actorId: 1,
      userId: "customer",
      lines: [
        { productId: 1, quantity: 10, priceCents: 525 },
        { productId: 2, quantity: 1, priceCents: 30000 },
      ],
    };
    const sale = await call("/sales", "POST", payload);
    assert.equal(sale.total_cents, 35250);
    assert.equal(sale.xp, 352);
    assert.equal(await scalar("SELECT xp FROM users WHERE id='customer'"), 362);
    assert.equal((await call("/sales", "POST", payload)).id, sale.id);
    assert.equal(await scalar("SELECT count(*) FROM xp_transactions"), 1);
    await call("/sales", "POST", { ...payload, userId: null }, 409);
    const guest = await call("/sales", "POST", {
      ...payload,
      requestId: crypto.randomUUID(),
      userId: null,
      lines: [{ productId: 1, quantity: 5, priceCents: 525 }],
    });
    assert.equal(guest.xp, 0);
    assert.equal(guest.user_id, null);
    assert.equal(
      await scalar("SELECT quantity FROM inventory_stock WHERE product_id=1"),
      85,
    );
    await call(
      "/sales",
      "POST",
      {
        ...payload,
        requestId: crypto.randomUUID(),
        lines: [
          { productId: 1, quantity: 1, priceCents: 525 },
          { productId: 2, quantity: 2, priceCents: 30000 },
        ],
      },
      409,
    );
    assert.equal(
      await scalar("SELECT quantity FROM inventory_stock WHERE product_id=1"),
      85,
    );
    await call(
      "/sales",
      "POST",
      {
        ...payload,
        requestId: crypto.randomUUID(),
        lines: [{ productId: 1, quantity: 1, priceCents: 500 }],
      },
      409,
    );
    await call(
      "/sales",
      "POST",
      {
        ...payload,
        requestId: crypto.randomUUID(),
        lines: [payload.lines[0], payload.lines[0]],
      },
      400,
    );
    // Force a failure after stock mutations: no partial sale or stock change may survive.
    await db.exec(
      `ALTER TABLE xp_transactions ADD CONSTRAINT reject_extra CHECK (amount <= 352);`,
    );
    await call(
      "/sales",
      "POST",
      {
        ...payload,
        requestId: crypto.randomUUID(),
        lines: [{ productId: 1, quantity: 80, priceCents: 525 }],
      },
      500,
    );
    assert.equal(
      await scalar("SELECT quantity FROM inventory_stock WHERE product_id=1"),
      85,
    );
    assert.equal(await scalar("SELECT count(*) FROM inventory_sales"), 2);
    assert.equal(await scalar("SELECT xp FROM users WHERE id='customer'"), 362);
    await call(`/sales/${sale.id}/cancel`, "POST", { actorId: 1 });
    await call(`/sales/${sale.id}/cancel`, "POST", { actorId: 1 });
    assert.equal(
      await scalar("SELECT quantity FROM inventory_stock WHERE product_id=1"),
      95,
    );
    assert.equal(
      await scalar("SELECT quantity FROM inventory_stock WHERE product_id=2"),
      2,
    );
    assert.equal(await scalar("SELECT xp FROM users WHERE id='customer'"), 10);
    assert.equal(await scalar("SELECT count(*) FROM xp_transactions"), 2);
    assert.equal((await call("/movements")).length, 7);
    assert.equal(
      (await call("")).find((p: any) => p.id === 1).price_cents,
      525,
    );
    await db.exec("UPDATE settings SET xp_multiplier=2");
    const bonusSale = await call("/sales", "POST", {
      ...payload,
      requestId: crypto.randomUUID(),
      lines: [{ productId: 1, quantity: 10, priceCents: 525 }],
    });
    assert.equal(bonusSale.xp, 105);
    assert.equal((await call("")).find((p: any) => p.id === 3).quantity, null);
    const uncountedSale = await call("/sales", "POST", {
      ...payload,
      requestId: crypto.randomUUID(),
      userId: null,
      lines: [{ productId: 3, quantity: 50, priceCents: 650 }],
    });
    assert.equal(uncountedSale.lines[0].balance, null);
    await call(`/sales/${uncountedSale.id}/cancel`, "POST", { actorId: 1 });
    await call("/3", "PATCH", {
      actorId: 1,
      revision: 2,
      quantity: 0,
      priceCents: 650,
      reason: "Counted empty",
    });
    await call(
      "/sales",
      "POST",
      {
        ...payload,
        requestId: crypto.randomUUID(),
        userId: null,
        lines: [{ productId: 3, quantity: 1, priceCents: 650 }],
      },
      409,
    );
    await call(
      "/sales",
      "POST",
      {
        ...payload,
        requestId: crypto.randomUUID(),
        lines: [{ newTeaName: "New oolong", quantity: 100, priceCents: 1000 }],
      },
      500,
    );
    assert.equal(
      await scalar("SELECT count(*) FROM products WHERE name='New oolong'"),
      0,
    );
    const quickPayload = {
      ...payload,
      requestId: crypto.randomUUID(),
      userId: null,
      lines: [{ newTeaName: "New oolong", quantity: 10, priceCents: 750 }],
    };
    const quickSale = await call("/sales", "POST", quickPayload);
    assert.equal(quickSale.total_cents, 7500);
    assert.equal(quickSale.xp, 0);
    assert.equal((await call("/sales", "POST", quickPayload)).id, quickSale.id);
    const newId = quickSale.lines[0].productId;
    assert.equal(
      await scalar(
        `SELECT quantity FROM inventory_stock WHERE product_id=${newId}`,
      ),
      null,
    );
    assert.equal(
      await scalar(`SELECT inventory_only FROM products WHERE id=${newId}`),
      true,
    );
    await call(
      "/sales",
      "POST",
      {
        ...payload,
        requestId: crypto.randomUUID(),
        userId: null,
        lines: [{ newTeaName: "New oolong", quantity: 1, priceCents: 750 }],
      },
      409,
    );
    const extraSale = await call("/sales", "POST", {
      ...payload,
      requestId: crypto.randomUUID(),
      userId: null,
      lines: [{ productId: newId, quantity: 1000, priceCents: 750 }],
    });
    assert.equal(extraSale.lines[0].balance, null);
    await call(`/sales/${extraSale.id}/cancel`, "POST", { actorId: 1 });
    assert.equal(
      await scalar(
        `SELECT quantity FROM inventory_stock WHERE product_id=${newId}`,
      ),
      null,
    );
    await call(`/${newId}`, "PATCH", {
      actorId: 1,
      revision: 3,
      quantity: 120,
      priceCents: 750,
      reason: "Counted stock",
    });
    assert.equal(
      await scalar(
        `SELECT quantity FROM inventory_stock WHERE product_id=${newId}`,
      ),
      120,
    );
    const customerQuickSale = await call("/sales", "POST", {
      ...payload,
      requestId: crypto.randomUUID(),
      lines: [{ newTeaName: "Gaba tea", quantity: 5, priceCents: 1000 }],
    });
    assert.equal(customerQuickSale.xp, 100);
    assert.equal(await scalar("SELECT xp FROM users WHERE id='customer'"), 215);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.close();
  }
});
