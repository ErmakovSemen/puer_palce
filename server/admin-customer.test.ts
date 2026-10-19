import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import express from "express";
import { PGlite } from "@electric-sql/pglite";

process.env.DATABASE_URL ||= "postgresql://test:test@localhost/test";

test("admin customer profile combines purchases and safely adjusts XP", async () => {
  const { registerAdminCustomer } = await import("./admin-customer");
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE users(id varchar PRIMARY KEY,name text,phone text,email text,xp integer NOT NULL,custom_discount integer,source text);
    CREATE TABLE crm_admins(id integer PRIMARY KEY,name text,is_active boolean);
    CREATE TABLE crm_contacts(id integer PRIMARY KEY,user_id varchar,name text,phone text,email text,source text,notes text,owner_id integer);
    CREATE TABLE site_settings(loyalty_level2_min_xp integer,loyalty_level2_discount integer,loyalty_level3_min_xp integer,loyalty_level3_discount integer,loyalty_level4_min_xp integer,loyalty_level4_discount integer);
    CREATE TABLE products(id integer PRIMARY KEY,category text,pricing_unit text);
    CREATE TABLE inventory_sales(id serial PRIMARY KEY,user_id varchar,created_at timestamptz,status text,total_cents integer,lines jsonb,comment text);
    CREATE TABLE orders(id serial PRIMARY KEY,user_id varchar,created_at text,status text,total real,items text,comment text);
    CREATE TABLE xp_transactions(id serial PRIMARY KEY,user_id varchar,amount integer,reason text,description text,created_by text,created_at timestamptz DEFAULT now());
    CREATE FUNCTION pg_advisory_xact_lock(integer) RETURNS void LANGUAGE SQL AS 'SELECT NULL::void';
    INSERT INTO users VALUES('client','Клиент','+79000000000',null,200,0,'friend'),('empty','Без покупок','+79000000001',null,0,null,null);
    INSERT INTO crm_admins VALUES(1,'Мастер',true),(2,'Бывший сотрудник',false);
    INSERT INTO crm_contacts VALUES(1,'client','CRM имя','+79000000000',null,'manual','Любит улун',1),(2,null,'Лид',null,null,'TargetHunter',null,null);
    INSERT INTO site_settings VALUES(100,7,500,11,1000,17);
    INSERT INTO products VALUES(1,'tea','gram'),(2,'teaware','piece');
    INSERT INTO inventory_sales(user_id,created_at,status,total_cents,lines,comment) VALUES
      ('client','2026-10-17T12:00:00Z','completed',45000,'[{"productId":1,"name":"Улун","quantity":5,"unit":"gram","saleFormat":"teapot"},{"productId":1,"name":"Улун","quantity":3,"unit":"gram","saleFormat":"cup"},{"productId":2,"name":"Пиала","quantity":1,"unit":"piece"}]','Заметка'),
      ('client','2026-10-16T12:00:00Z','cancelled',90000,'[{"productId":1,"name":"Улун","quantity":100,"unit":"gram"}]',null),
      (null,'2026-10-18T12:00:00Z','completed',99999,'[]',null);
    INSERT INTO orders(user_id,created_at,status,total,items,comment) VALUES
      ('client','2026-10-18T12:00:00Z','paid',123.45,'[{"id":1,"name":"Улун","quantity":10},{"id":2,"name":"Пиала","quantity":1}]',null),
      ('client','2026-10-15T12:00:00Z','pending',500,'[{"id":1,"name":"Улун","quantity":30}]',null);
  `);
  const pool = { query: (sql: string, args?: any[]) => db.query(sql, args), connect: async () => ({ query: (sql: string, args?: any[]) => db.query(sql, args), release() {} }) };
  const app = express(); app.use(express.json());
  await registerAdminCustomer(app, (req, res, next) => { if (req.headers["x-test-admin"] !== "yes") { res.sendStatus(401); return; } next(); }, pool);
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/admin/customer-profile`;
  const get = async (query: string, expected = 200) => {
    const response = await fetch(`${base}?${query}`, { headers: { "x-test-admin": "yes" } });
    const value = await response.json(); assert.equal(response.status, expected, JSON.stringify(value)); return value;
  };
  const post = async (body: any, expected = 200, user = "client") => {
    const response = await fetch(`${base}/${user}/xp`, { method: "POST", headers: { "x-test-admin": "yes", "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const value = await response.json(); assert.equal(response.status, expected, JSON.stringify(value)); return value;
  };
  try {
    assert.equal((await fetch(`${base}?userId=client`)).status, 401);
    const profile = await get("userId=client");
    assert.equal(profile.customer.id, "client"); assert.equal(profile.customer.contactId, 1);
    assert.equal(profile.customer.ownerName, "Мастер"); assert.equal(profile.customer.notes, "Любит улун");
    assert.equal(profile.loyalty.discountPercent, 0); assert.equal(profile.loyalty.loyaltyDiscountPercent, 7);
    assert.equal(profile.loyalty.levelName, "Ценитель");
    assert.equal(profile.purchaseCount, 4); assert.equal(profile.summary.purchaseCount, 2);
    assert.equal(profile.summary.totalCents, 57345); assert.equal(profile.purchases[0].source, "online");
    assert.equal(profile.teas.length, 1); assert.equal(profile.teas[0].grams, 18); assert.equal(profile.teas[0].purchases, 2);
    assert.equal((await get("contactId=1")).customer.id, "client");
    const lead = await get("contactId=2"); assert.equal(lead.loyalty, null); assert.equal(lead.customer.id, null);
    const empty = await get("userId=empty"); assert.equal(empty.purchaseCount, 0); assert.equal(empty.teas.length, 0);
    await get("userId=missing", 404); await get("contactId=999", 404); await get("", 400);
    await get("userId=client&contactId=1", 400); await get("userId=client&offset=-1", 400);
    const body = { requestId: crypto.randomUUID(), actorId: 1, amount: 50, description: "Подарок клиенту" };
    const changed = await post(body); assert.equal(changed.xp, 250);
    assert.equal((await post(body)).repeated, true);
    assert.equal((await get("userId=client")).xpCount, 1);
    await post({ ...body, amount: 51 }, 409);
    await post({ ...body, requestId: crypto.randomUUID(), amount: -300 }, 400);
    await post({ ...body, requestId: crypto.randomUUID(), amount: 0 }, 400);
    await post({ ...body, requestId: crypto.randomUUID(), amount: 1.5 }, 400);
    await post({ ...body, requestId: crypto.randomUUID(), actorId: 2 }, 400);
    await post({ ...body, requestId: crypto.randomUUID() }, 404, "missing");
    await post({ ...body, requestId: crypto.randomUUID(), amount: -100, description: "Исправление бонуса" });
    assert.equal((await get("userId=client")).loyalty.xp, 150);
    await db.exec("ALTER TABLE xp_transactions ADD CONSTRAINT reject_large CHECK(amount < 500)");
    await post({ ...body, requestId: crypto.randomUUID(), amount: 600 }, 500);
    const after = await get("userId=client"); assert.equal(after.loyalty.xp, 150); assert.equal(after.xpCount, 2);
    assert.equal(after.xpHistory[0].amount, -100); assert.equal(after.xpHistory[0].createdBy, "Мастер");
    assert.equal(Number((await db.query("SELECT COUNT(*) AS count FROM admin_customer_xp_adjustments")).rows[0].count), 2);
    await db.exec("INSERT INTO xp_transactions(user_id,amount,reason,description) SELECT 'client',1,'bonus','History' FROM generate_series(1,35)");
    assert.equal((await get("userId=client")).xpHistory.length, 30);
    assert.equal((await get("userId=client&xpOffset=30")).xpHistory.length, 7);
    await db.exec("INSERT INTO orders(user_id,created_at,status,total,items) VALUES('client','2026-10-19T12:00:00Z','pending',0,'broken json')");
    assert.equal((await get("userId=client")).purchaseCount, 5);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); await db.close(); }
});
