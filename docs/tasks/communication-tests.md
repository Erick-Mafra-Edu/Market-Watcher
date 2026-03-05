# Communication Tests Backlog (P0/P1/P2)

Source inputs:
- `docs/agents/results/gap-tests.md`
- `docs/tasks/communication.md`

## P0 — Critical communication safety

1. **RabbitMQ payload contract tests (all active channels)**
   - Validate required fields/types for:
     - `market_news`: `title, description, url, source, published_at, topic`
     - `stock_prices`: `symbol, price, changePercent, volume, marketCap, timestamp`
     - `fundamental_data`: `symbol, dividend_yield, p_vp, p_l, roe, liquidity, scraped_at`
   - Concrete test files:
     - `notifier-service/src/index.communication.test.ts` (consumer-side contract validation)
     - `gnews-service/tests/test_rabbitmq_contract.py` (producer payload contract)
     - `scraping-worker/tests/test_rabbitmq_contract.py` (producer payload contract)
     - `api-handler/src/index.communication.test.ts` (producer payload contract)

2. **Notifier consumer ack/nack behavior**
   - For `news_queue`, `price_updates`, `fundamentals_queue`:
     - valid payload -> handler success -> `ack`
     - invalid payload or handler error -> `nack(requeue=false)`
     - malformed JSON -> `nack(requeue=false)`
   - Concrete test files:
     - `notifier-service/src/index.communication.test.ts`

3. **Cross-service integration: message -> persistence**
   - Publish representative messages and assert persistence side effects:
     - news into `news_articles`/`stock_news`
     - fundamentals into `status_invest_data`
   - Concrete test files:
     - `notifier-service/src/integration/messaging-persistence.integration.test.ts`

## P1 — Reliability and boundary integration

1. **RabbitMQ retry/reconnect semantics**
   - Verify reconnect/retry flow for connection setup and failure surfacing.
   - Concrete test files:
     - `api-handler/src/index.communication.test.ts`
     - `notifier-service/src/index.communication.test.ts`
     - `gnews-service/tests/test_rabbitmq_retry.py`
     - `scraping-worker/tests/test_rabbitmq_retry.py`

2. **HTTP proxy contract: web-app -> api-handler**
   - Cover success and upstream failure for:
     - `GET /api/stocks/:symbol`
     - `GET /api/stocks/:symbol/history`
   - Concrete test files:
     - `web-app/src/integration/stocks-proxy.integration.test.ts`

3. **Alert-chain integration (fundamentals gate)**
   - Feed news + price + fundamentals and assert alert outcome changes with thresholds.
   - Concrete test files:
     - `notifier-service/src/integration/alert-chain.integration.test.ts`

## P2 — Hardening and regression prevention

1. **Duplicate/Idempotency behavior**
   - Re-delivery of the same message should not create inconsistent persisted state.
   - Concrete test files:
     - `notifier-service/src/integration/message-idempotency.integration.test.ts`

2. **Consumer throughput/backpressure smoke**
   - Burst message batches and verify stable processing and deterministic ack/nack handling.
   - Concrete test files:
     - `notifier-service/src/integration/consumer-throughput.integration.test.ts`

3. **Documentation consistency guard**
   - Keep producer/consumer matrix and queue contracts aligned with implementation changes.
   - Concrete test files:
      - `web-app/src/integration/communication-matrix-sync.integration.test.ts`

## Definition of Done

- Backlog is prioritized as P0/P1/P2 and mapped to concrete test files.
- P0 tests are written first and fail before implementation changes (test-first gate).
- Each active communication path has explicit validation:
  - RabbitMQ contracts (`market_news`, `stock_prices`, `fundamental_data`)
  - Notifier ack/nack behavior for all three queues
  - `web-app` -> `api-handler` proxy routes
  - Persistence side effects in `news_articles`, `stock_news`, `status_invest_data`, `alerts`
- All new/updated tests pass in their respective service test suites.
- `docs/tasks/communication.md` matrix and this backlog remain consistent after test delivery.
