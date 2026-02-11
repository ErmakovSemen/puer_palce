#!/usr/bin/env node
/**
 * Верификация системы аналитики
 *
 * Запуск: node scripts/verify-analytics.mjs
 * Или: npm run verify:analytics
 *
 * Переменные окружения:
 *   BASE_URL - URL приложения (default: http://localhost:5000)
 *   DATABASE_URL - URL БД (опционально, для проверки таблиц)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
const DATABASE_URL = process.env.DATABASE_URL;

const results = { passed: 0, failed: 0, skipped: 0 };

function log(msg, type = "info") {
  const prefix = type === "ok" ? "✓" : type === "fail" ? "✗" : type === "skip" ? "○" : "•";
  console.log(`${prefix} ${msg}`);
}

function passed(name) {
  results.passed++;
  log(name, "ok");
}

function failed(name, reason) {
  results.failed++;
  log(`${name}: ${reason}`, "fail");
}

function skipped(name, reason) {
  results.skipped++;
  log(`${name} (${reason})`, "skip");
}

async function testApiLogEndpoint() {
  const event = {
    event_name: "verify_test",
    source: "backend",
    properties: { test: true, timestamp: new Date().toISOString() },
  };

  try {
    const res = await fetch(`${BASE_URL}/api/analytics/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        passed("API POST /api/analytics/log - событие принято");
        return data.id;
      } else {
        failed("API POST /api/analytics/log", "response.success !== true");
      }
    } else {
      const hint = res.status === 403 ? " (сервер запущен? CORS?)" : res.status === 404 ? " (роут не найден)" : "";
      failed("API POST /api/analytics/log", `HTTP ${res.status}${hint}`);
    }
  } catch (err) {
    const hint = err.cause?.code === "ECONNREFUSED" ? " - запустите сервер (npm run dev)" : "";
    failed("API POST /api/analytics/log", err.message + hint);
  }
  return null;
}

async function testApiBatchEndpoint() {
  const events = [
    { event_name: "verify_batch_test", source: "backend", properties: { batch: 1 } },
    { event_name: "verify_batch_test", source: "backend", properties: { batch: 2 } },
  ];

  try {
    const res = await fetch(`${BASE_URL}/api/analytics/log/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.count >= 0) {
        passed(`API POST /api/analytics/log/batch - ${data.count} событий`);
        return true;
      } else {
        failed("API POST /api/analytics/log/batch", "invalid response");
      }
    } else {
      failed("API POST /api/analytics/log/batch", `HTTP ${res.status}`);
    }
  } catch (err) {
    failed("API POST /api/analytics/log/batch", err.message);
  }
  return false;
}

async function testDatabase() {
  if (!DATABASE_URL) {
    skipped("Database checks", "DATABASE_URL не задан");
    return;
  }

  const { execSync } = await import("child_process");

  try {
    // Используем psql (не требует node_modules)
    const runSql = (sql) => {
      return execSync(
        `psql "${DATABASE_URL}" -t -A -c ${JSON.stringify(sql)}` +
          (process.platform === "win32" ? "" : " 2>/dev/null"),
        { encoding: "utf-8" }
      ).trim();
    };

    // Проверка таблиц
    const tablesOut = runSql(
      `SELECT count(*) FROM information_schema.tables WHERE table_name IN ('raw_events','sessions','events_clean','daily_stats')`
    );
    const tablesCount = parseInt(tablesOut, 10) || 0;
    if (tablesCount >= 4) {
      passed(`Таблицы существуют (${tablesCount}/4)`);
    } else {
      failed("Таблицы", `найдено ${tablesCount}/4`);
    }

    // Количество событий
    const countOut = runSql("SELECT COUNT(*) FROM raw_events");
    const count = parseInt(countOut, 10) || 0;
    passed(`raw_events: ${count} записей`);

    // ETL функции
    const funcOut = runSql(
      `SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname IN ('process_sessions','process_events_clean','aggregate_daily_stats')`
    );
    const funcCount = parseInt(funcOut, 10) || 0;
    if (funcCount >= 3) passed(`ETL функции (${funcCount}/3)`);
    else failed("ETL функции", `найдено ${funcCount}/3`);

    // BI Views
    const viewOut = runSql(`SELECT count(*) FROM information_schema.views WHERE table_name LIKE 'v_analytics_%'`);
    const viewCount = parseInt(viewOut, 10) || 0;
    if (viewCount >= 5) passed(`BI Views (${viewCount})`);
    else failed("BI Views", `найдено ${viewCount}`);
  } catch (err) {
    failed("Database", err.message.includes("psql") ? "psql не найден или ошибка подключения" : err.message);
  }
}

async function testAnalyticsFilesExist() {
  const fs = await import("fs");
  const path = await import("path");
  const { fileURLToPath } = await import("url");
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const root = path.join(__dirname, "..");

  const files = [
    "client/src/lib/analytics.ts",
    "server/analytics.ts",
    "analytics/migrations/001_analytics_tables.sql",
    "analytics/migrations/004_bi_views.sql",
  ];

  let allExist = true;
  for (const f of files) {
    if (!fs.existsSync(path.join(root, f))) {
      failed(`Файл ${f}`, "не найден");
      allExist = false;
    }
  }
  if (allExist) {
    passed(`Файлы аналитики (${files.length})`);
  }
}

async function testInitAnalyticsInMain() {
  const fs = await import("fs");
  const path = await import("path");
  const { fileURLToPath } = await import("url");
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const mainPath = path.join(__dirname, "..", "client", "src", "main.tsx");

  const content = fs.readFileSync(mainPath, "utf-8");
  if (content.includes("initAnalytics") && content.includes("analytics")) {
    passed("client/main.tsx - initAnalytics подключен");
  } else {
    failed("client/main.tsx", "initAnalytics не найден");
  }
}

async function main() {
  console.log("\n=== Верификация системы аналитики ===\n");
  console.log(`BASE_URL: ${BASE_URL}`);
  console.log(`DATABASE_URL: ${DATABASE_URL ? "***задан***" : "не задан"}`);
  console.log("");

  // 1. Проверка файлов (не требует сервера)
  await testAnalyticsFilesExist();
  await testInitAnalyticsInMain();

  // 2. API тесты (требует запущенный сервер)
  console.log("\n--- API ---");
  try {
    await testApiLogEndpoint();
    await testApiBatchEndpoint();
  } catch (e) {
    failed("API тесты", e.message);
  }

  // 3. Database тесты (требует DATABASE_URL)
  console.log("\n--- Database ---");
  await testDatabase();

  console.log("\n=== Итог ===");
  console.log(`✓ Passed: ${results.passed}`);
  console.log(`✗ Failed: ${results.failed}`);
  console.log(`○ Skipped: ${results.skipped}`);
  console.log("");

  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
