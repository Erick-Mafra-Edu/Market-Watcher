# Gap Analysis: Communication Test Coverage

## Scope and evidence

Focus: RabbitMQ contracts and service integration paths.

Primary sources:
- `gnews-service/src/main.py` (publishes `market_news` -> `news_queue`)
- `api-handler/src/index.ts` (publishes `stock_prices` -> `price_updates`)
- `scraping-worker/src/main.py` (publishes `fundamental_data` -> `fundamentals_queue`)
- `notifier-service/src/index.ts` (consumes `news_queue`, `price_updates`, `fundamentals_queue`, uses ack/nack)
- `web-app/src/index.ts` (HTTP proxy to `api-handler`)
- Current tests: `api-handler/src/index.test.ts`, `notifier-service/src/sentiment.service.test.ts`, `web-app/src/controllers/*.test.ts`, `web-app/src/integration/*.integration.test.ts`

## Current coverage snapshot (communication)

### RabbitMQ contract coverage
- `market_news` payload contract test: **missing**
- `stock_prices` payload contract test: **missing**
- `fundamental_data` payload contract test: **missing**
- Consumer ack/nack behavior tests (`notifier-service`): **missing**
- Queue/exchange declaration tests: **missing**

### Service integration coverage
- `web-app` -> `api-handler` integration (`/api/stocks*`): **missing**
- Producer -> RabbitMQ -> `notifier-service` flow: **missing**
- `notifier-service` -> DB side effects after message consume: **missing**
- Existing "integration" tests are local HTTP/controller boundaries only (`auth`, `watchlist`) and do not validate cross-service communication.

### Notable doc/code drift affecting tests
- `SERVICE_ARCHITECTURE.md` still states `fundamental_data`/`fundamentals_queue` has no consumer, but `notifier-service/src/index.ts` currently consumes it. This mismatch increases risk of outdated test assumptions.

## Backlog (P0/P1/P2)

## P0 — Critical communication safety

1. **Contract tests for all active RabbitMQ payloads**
   - Validate required fields/types for:
     - `market_news`: `title, description, url, source, published_at, topic`
     - `stock_prices`: `symbol, price, changePercent, volume, marketCap, timestamp`
     - `fundamental_data`: `symbol` (+ numeric/null indicators + `scraped_at`)
   - Expected output: failing test on schema break, including missing/invalid field cases.

2. **Notifier consumer ack/nack contract tests**
   - For each queue (`news_queue`, `price_updates`, `fundamentals_queue`):
     - valid payload -> handler called -> `ack`
     - invalid payload/handler error -> `nack(requeue=false)`
   - Cover JSON parse failure explicitly.

3. **Cross-service integration test: producer message -> notifier persistence**
   - Publish representative messages and assert DB effects:
     - news persisted in `news_articles`
     - fundamentals persisted in `status_invest_data`
   - This is the highest-value integration path for alert pipeline correctness.

## P1 — Reliability and boundary integration

1. **Retry/reconnect behavior tests for RabbitMQ connection**
   - Validate retry loop behavior in `connectRabbitMQ` for `api-handler` and `notifier-service`.
   - Ensure terminal failure surfaces errors (no silent success path).

2. **`web-app` -> `api-handler` integration tests for stock proxy routes**
   - Cover success and upstream failure propagation for:
     - `GET /api/stocks/:symbol`
     - `GET /api/stocks/:symbol/history`
   - Verify status/error mapping is preserved.

3. **Integration test for alert trigger chain with fundamentals gate**
   - Feed news + price + fundamentals and assert alert condition outcome changes with fundamentals thresholds.

## P2 — Hardening and regression prevention

1. **Idempotency/duplicate-message behavior tests**
   - Re-delivery of same message should not create inconsistent state (especially `news_articles` upsert path).

2. **Consumer throughput/backpressure smoke tests**
   - Burst message batches and verify service stability + deterministic ack/nack handling.

3. **Documentation-consistency test checklist**
   - Add lightweight validation/checklist so queue producers/consumers in docs are reviewed whenever messaging code changes.

## Suggested execution order

1. Implement P0.1 + P0.2 first (fast contract safety net).
2. Implement P0.3 next (real integration confidence).
3. Then P1.2 (HTTP boundary) and P1.1 (resilience paths).
4. Finish with P2 hardening.
