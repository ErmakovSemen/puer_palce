#!/usr/bin/env node
/**
 * Быстрая проверка файлов аналитики (без сети и БД)
 * Запуск: npm run verify:analytics:files
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const required = [
  "client/src/lib/analytics.ts",
  "server/analytics.ts",
  "analytics/migrations/001_analytics_tables.sql",
  "analytics/migrations/002_etl_functions.sql",
  "analytics/migrations/004_bi_views.sql",
];

let failed = 0;
for (const f of required) {
  const full = path.join(root, f);
  if (fs.existsSync(full)) {
    console.log(`✓ ${f}`);
  } else {
    console.log(`✗ ${f} - не найден`);
    failed++;
  }
}

const mainContent = fs.readFileSync(path.join(root, "client/src/main.tsx"), "utf-8");
if (mainContent.includes("initAnalytics")) {
  console.log("✓ client/main.tsx - initAnalytics подключен");
} else {
  console.log("✗ client/main.tsx - initAnalytics не найден");
  failed++;
}

console.log(failed === 0 ? "\n✓ Все проверки пройдены" : `\n✗ Ошибок: ${failed}`);
process.exit(failed);