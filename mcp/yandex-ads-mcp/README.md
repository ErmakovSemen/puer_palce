# Yandex Ads MCP

Локальный MCP для чтения данных из Яндекс Директа и Метрики. Он не содержит инструментов изменения ставок, бюджетов или кампаний.

## Доступные инструменты

- `metrica_list_counters` — доступные счётчики Метрики.
- `metrica_report` — визиты, посетители, цели и любые метрики Метрики за период.
- `direct_list_campaigns` — кампании Директа.
- `direct_report` — расходы, клики, конверсии по кампаниям или поисковым запросам.

## Подключение

1. Создайте OAuth-токен Яндекса с доступом к Метрике и Директу.
2. Скопируйте `.env.example` в `.env` и задайте `YANDEX_OAUTH_TOKEN`.
3. Установите зависимости: `npm install`.
4. Добавьте сервер в конфигурацию Codex:

```toml
[mcp_servers.yandex_ads]
command = "node"
args = ["/Users/Semen.Ermakov/Documents/ChatGPT/чайная/puer_palce/mcp/yandex-ads-mcp/dist/index.js"]

[mcp_servers.yandex_ads.env]
YANDEX_OAUTH_TOKEN = "..."
YANDEX_METRICA_COUNTER_ID = "111989121"
YANDEX_DIRECT_CLIENT_LOGIN = ""
```

Токен храните только в локальной конфигурации Codex или в менеджере секретов. Не добавляйте его в Git, Replit или фронтенд.
