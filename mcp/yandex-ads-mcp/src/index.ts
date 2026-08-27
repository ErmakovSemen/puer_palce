import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";

const METRICA_API = "https://api-metrika.yandex.net";
const DIRECT_API = "https://api.direct.yandex.com/json/v5";

type Json = Record<string, unknown>;

function config() {
  const token = process.env.YANDEX_OAUTH_TOKEN;
  if (!token) {
    throw new Error("Не задан YANDEX_OAUTH_TOKEN. Добавьте его только в локальное окружение MCP.");
  }

  return {
    token,
    counterId: process.env.YANDEX_METRICA_COUNTER_ID,
    clientLogin: process.env.YANDEX_DIRECT_CLIENT_LOGIN,
  };
}

function toText(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function toError(error: unknown) {
  const message = error instanceof Error ? error.message : "Неизвестная ошибка Яндекс API";
  return { content: [{ type: "text" as const, text: `Ошибка: ${message}` }], isError: true };
}

async function requestJson(
  url: string,
  init: RequestInit,
  token: string,
  authorizationScheme: "Bearer" | "OAuth" = "Bearer",
): Promise<Json> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `${authorizationScheme} ${token}`,
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    // Direct may return a TSV report; callers that need it use requestText.
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
  if (typeof body === "string") {
    throw new Error("API вернул текстовый ответ там, где ожидался JSON.");
  }
  return body as Json;
}

async function requestText(url: string, init: RequestInit, token: string): Promise<{ status: number; text: string }> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  if (!response.ok && response.status !== 201 && response.status !== 202) {
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }
  return { status: response.status, text };
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Используйте YYYY-MM-DD");

function createServer() {
  const server = new McpServer({ name: "yandex-ads-mcp", version: "0.1.0" });

  server.registerTool(
    "metrica_list_counters",
    { description: "Список доступных счётчиков Яндекс Метрики." },
    async () => {
      try {
        const { token } = config();
        return toText(await requestJson(`${METRICA_API}/management/v1/counters`, { method: "GET" }, token, "OAuth"));
      } catch (error) {
        return toError(error);
      }
    },
  );

  server.registerTool(
    "metrica_report",
    {
      description: "Отчёт Метрики за период. По умолчанию возвращает визиты, посетителей и отказы.",
      inputSchema: {
        counterId: z.string().optional().describe("ID счётчика. По умолчанию YANDEX_METRICA_COUNTER_ID."),
        dateFrom: date,
        dateTo: date,
        metrics: z.array(z.string()).min(1).default(["ym:s:visits", "ym:s:users", "ym:s:bounceRate"]),
        dimensions: z.array(z.string()).default([]),
        filters: z.string().optional(),
      },
    },
    async ({ counterId, dateFrom, dateTo, metrics, dimensions, filters }) => {
      try {
        const { token, counterId: defaultCounterId } = config();
        const ids = counterId ?? defaultCounterId;
        if (!ids) throw new Error("Укажите counterId или YANDEX_METRICA_COUNTER_ID.");

        const params = new URLSearchParams({ ids, date1: dateFrom, date2: dateTo, metrics: metrics.join(",") });
        if (dimensions.length) params.set("dimensions", dimensions.join(","));
        if (filters) params.set("filters", filters);
        return toText(await requestJson(`${METRICA_API}/stat/v1/data?${params}`, { method: "GET" }, token, "OAuth"));
      } catch (error) {
        return toError(error);
      }
    },
  );

  server.registerTool(
    "direct_list_campaigns",
    {
      description: "Список кампаний Яндекс Директа. Только чтение.",
      inputSchema: { archived: z.boolean().default(false) },
    },
    async ({ archived }) => {
      try {
        const { token, clientLogin } = config();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (clientLogin) headers["Client-Login"] = clientLogin;
        const payload = {
          method: "get",
          params: {
            SelectionCriteria: archived ? {} : { States: ["ON", "OFF", "SUSPENDED"] },
            FieldNames: ["Id", "Name", "State", "Status", "Type", "StartDate", "EndDate"],
          },
        };
        return toText(await requestJson(`${DIRECT_API}/campaigns`, { method: "POST", headers, body: JSON.stringify(payload) }, token));
      } catch (error) {
        return toError(error);
      }
    },
  );

  server.registerTool(
    "direct_report",
    {
      description: "Отчёт Директа по кампаниям или поисковым запросам. Только чтение.",
      inputSchema: {
        reportType: z.enum(["CAMPAIGN_PERFORMANCE_REPORT", "SEARCH_QUERY_PERFORMANCE_REPORT"]),
        dateFrom: date,
        dateTo: date,
        campaignIds: z.array(z.number().int().positive()).optional(),
      },
    },
    async ({ reportType, dateFrom, dateTo, campaignIds }) => {
      try {
        const { token, clientLogin } = config();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "returnMoneyInMicros": "false",
          "skipReportHeader": "true",
          "skipColumnHeader": "false",
          "returnFormat": "TSV",
          "processingMode": "auto",
        };
        if (clientLogin) headers["Client-Login"] = clientLogin;
        const fieldNames = reportType === "CAMPAIGN_PERFORMANCE_REPORT"
          ? ["Date", "CampaignId", "CampaignName", "Impressions", "Clicks", "Cost", "Conversions", "ConversionRate"]
          : ["Date", "CampaignId", "CampaignName", "Query", "Impressions", "Clicks", "Cost", "Conversions"];
        const selectionCriteria = campaignIds?.length ? { Filter: [{ Field: "CampaignId", Operator: "IN", Values: campaignIds.map(String) }] } : {};
        const payload = {
          method: "get",
          params: {
            FieldNames: fieldNames,
            ReportName: `Codex ${reportType} ${dateFrom} ${dateTo}`,
            ReportType: reportType,
            DateRangeType: "CUSTOM_DATE",
            SelectionCriteria: { ...selectionCriteria, DateFrom: dateFrom, DateTo: dateTo },
            Format: "TSV",
            IncludeVAT: "YES",
            IncludeDiscount: "NO",
          },
        };
        const response = await requestText(`${DIRECT_API}/reports`, { method: "POST", headers, body: JSON.stringify(payload) }, token);
        return toText({ status: response.status, report: response.text });
      } catch (error) {
        return toError(error);
      }
    },
  );

  return server;
}

serveStdio(createServer);
