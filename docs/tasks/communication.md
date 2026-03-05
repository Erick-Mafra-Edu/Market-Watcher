# Task: Service Communication Mapping (Code-Current)

## Goal

Document the communication architecture as implemented now in code (RabbitMQ, HTTP, and shared PostgreSQL), including a producer-consumer matrix and test-first acceptance criteria.

## Current Communication Architecture (from code)

### 1) RabbitMQ (async, durable fanout + durable queues)

- **API Handler publishes stock prices**
  - Exchange `stock_prices` (fanout), queue `price_updates` asserted/bound in service startup.
  - `api-handler/src/index.ts:118-121`, `api-handler/src/index.ts:152-155`, `api-handler/src/index.ts:225-226`
- **GNews Service publishes market news**
  - Exchange `market_news` (fanout), queue `news_queue` declared/bound, then `basic_publish`.
  - `gnews-service/src/main.py:70-80`, `gnews-service/src/main.py:106-114`
- **Scraping Worker publishes fundamentals**
  - Exchange `fundamental_data` (fanout), queue `fundamentals_queue` declared/bound, then `basic_publish`.
  - `scraping-worker/src/main.py:66-76`, `scraping-worker/src/main.py:161-168`
- **Notifier consumes all three queues**
  - Consumers on `news_queue`, `price_updates`, `fundamentals_queue` with `ack` on success and `nack(msg, false, false)` on failure.
  - `notifier-service/src/index.ts:183-223`

### 2) HTTP (sync)

- **Internal service-to-service HTTP**
  - `web-app` proxies to `api-handler`:
    - `GET /api/stocks/:symbol` -> `GET /api/stock/:symbol`
    - `GET /api/stocks/:symbol/history` -> `GET /api/stock/:symbol/history`
  - `web-app/src/index.ts:131-152`
- **API Handler to external quote providers**
  - BRAPI via Axios in provider.
  - `api-handler/src/providers/BrapiProvider.ts:47-48`, `api-handler/src/providers/BrapiProvider.ts:69-70`
  - Yahoo Finance via `yahoo-finance2`.
  - `api-handler/src/providers/YahooFinanceProvider.ts:39-41`, `api-handler/src/providers/YahooFinanceProvider.ts:57`
- **Scraping Worker to external site**
  - StatusInvest fetch via `requests.Session().get(...)`.
  - `scraping-worker/src/main.py:40`, `scraping-worker/src/main.py:94-95`
- **Notifier to external WhatsApp API**
  - Axios client POST `/send-message`.
  - `notifier-service/src/messaging/whatsapp.ts:28-34`, `notifier-service/src/messaging/whatsapp.ts:62-66`

### 3) Shared PostgreSQL (data coupling channel)

- **Schema foundation**
  - Shared tables: `stocks`, `user_watchlist`, `stock_prices`, `news_articles`, `stock_news`, `status_invest_data`, `alerts`.
  - `database/init.sql:16-33`, `database/init.sql:36-90`
- **API Handler**
  - Writes `stocks` + `stock_prices`; reads watchlist symbols from `user_watchlist`.
  - `api-handler/src/index.ts:165-187`
- **Notifier Service**
  - Writes `news_articles`, `stock_news`, `status_invest_data`, `alerts`; reads `users`/`user_watchlist`/`stocks` + latest fundamentals for alert checks.
  - `notifier-service/src/index.ts:281-299`, `notifier-service/src/index.ts:341-343`, `notifier-service/src/index.ts:368-373`, `notifier-service/src/index.ts:411-423`, `notifier-service/src/index.ts:538-540`
- **Web App**
  - Reads/writes watchlist and alerts; reads news and sentiment projections.
  - `web-app/src/controllers/watchlist.controller.ts:15-63`
  - `web-app/src/controllers/alerts.controller.ts:17-41`
  - `web-app/src/controllers/news.controller.ts:22-69`, `web-app/src/controllers/news.controller.ts:93-117`

## Producer-Consumer Matrix

| Producer | Channel | Contract | Consumer | Evidence |
|---|---|---|---|---|
| `api-handler` | RabbitMQ `stock_prices` -> `price_updates` | `StockData` JSON `{symbol, price, changePercent, volume, marketCap, timestamp}` | `notifier-service` (`handleStockUpdate`) | `api-handler/src/index.ts:31-38`, `api-handler/src/index.ts:152-155`, `notifier-service/src/index.ts:199-204` |
| `gnews-service` | RabbitMQ `market_news` -> `news_queue` | News JSON `{title, description, url, source, published_at, topic}` | `notifier-service` (`handleNews`) | `gnews-service/src/main.py:121-131`, `gnews-service/src/main.py:106-114`, `notifier-service/src/index.ts:32-39`, `notifier-service/src/index.ts:184-189` |
| `scraping-worker` | RabbitMQ `fundamental_data` -> `fundamentals_queue` | Fundamentals JSON `{symbol, dividend_yield, p_vp, p_l, roe, liquidity, scraped_at}` | `notifier-service` (`handleFundamentalsUpdate`) | `scraping-worker/src/main.py:102-110`, `scraping-worker/src/main.py:161-168`, `notifier-service/src/index.ts:50-58`, `notifier-service/src/index.ts:214-219` |
| `web-app` | HTTP `GET /api/stocks/:symbol` | REST JSON proxy request/response | `api-handler` `GET /api/stock/:symbol` | `web-app/src/index.ts:133-137`, `api-handler/src/index.ts:71-79` |
| `web-app` | HTTP `GET /api/stocks/:symbol/history` | REST JSON proxy with query params `period1, period2` | `api-handler` `GET /api/stock/:symbol/history` | `web-app/src/index.ts:146-153`, `api-handler/src/index.ts:82-100` |
| `api-handler` | PostgreSQL | Inserts/upserts market price data | `web-app`, `notifier-service` read same stock domain tables | `api-handler/src/index.ts:165-175`, `database/init.sql:58-66` |
| `notifier-service` | PostgreSQL | Persists news/fundamentals/alerts | `web-app` reads alerts/news endpoints | `notifier-service/src/index.ts:341-343`, `notifier-service/src/index.ts:368-373`, `notifier-service/src/index.ts:538-540`, `web-app/src/controllers/alerts.controller.ts:17-24`, `web-app/src/controllers/news.controller.ts:22-40` |
| `web-app` | PostgreSQL | Manages `user_watchlist` | `api-handler` reads watchlist for monitoring loop | `web-app/src/controllers/watchlist.controller.ts:61-64`, `api-handler/src/index.ts:185-187` |

## Test-First Acceptance Criteria

### P0 (must be written first, fail first, then pass)

1. **RabbitMQ consumer contracts in notifier**
   - Add tests for `news_queue`, `price_updates`, `fundamentals_queue` parsing + `ack/nack` behavior in `notifier-service/src/index.ts:183-223`.
   - Suggested test file: `notifier-service/src/index.communication.test.ts`.
2. **HTTP proxy contract web-app -> api-handler**
   - Add integration tests for `/api/stocks/:symbol` and `/api/stocks/:symbol/history` proxying and error forwarding in `web-app/src/index.ts:133-159`.
   - Suggested test file: `web-app/src/integration/stocks-proxy.integration.test.ts`.
3. **DB coupling contract for watchlist-driven monitoring**
   - Add tests validating `api-handler` watchlist query + default fallback symbols from `api-handler/src/index.ts:183-206`.
   - Extend `api-handler/src/index.test.ts`.

### P1 (resilience behavior)

4. **Retry/reconnect semantics**
   - Verify RabbitMQ connect retry loops in `api-handler/src/index.ts:107-133`, `gnews-service/src/main.py:52-90`, `scraping-worker/src/main.py:48-87`, `notifier-service/src/index.ts:155-177`.
5. **Poison message handling**
   - Ensure malformed payloads are `nack(..., requeue=false)` (drop/dead-letter-ready behavior) in `notifier-service/src/index.ts:190-193`, `notifier-service/src/index.ts:205-208`, `notifier-service/src/index.ts:220-223`.

### P2 (observability and edge cases)

6. **Cross-channel alert flow integration**
   - E2E test from queue inputs to `alerts` persistence (`notifier-service/src/index.ts:399-440`, `notifier-service/src/index.ts:538-540`) and retrieval via `web-app/src/controllers/alerts.controller.ts:17-24`.
7. **News-linking quality gates**
   - Validate stock symbol extraction + `stock_news` relation writes in `notifier-service/src/index.ts:264-300`.

## Done Definition

- Communication claims are traceable to concrete files/lines above.
- Matrix includes all currently active producer/consumer paths in code.
- Test backlog is ordered by P0/P1/P2 and starts from failing tests.
