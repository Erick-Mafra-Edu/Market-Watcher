# Master Execution Plan

## Scope

This plan consolidates execution for:
- `docs/tasks/p0-features.md`
- `docs/tasks/communication-tests.md`
- `docs/tasks/doc-sync.md`

---

## Parallelizable Agent Lanes

### Lane A — P0 Feature Delivery (Implementation)
Owner profile: backend/full-stack implementation.

1. Replace mocked StatusInvest fundamentals extraction with real parsing.
2. Complete recipient plumbing for SMS/WhatsApp (phone/whatsapp fields from watchlist/user query through provider calls).

Primary outputs:
- Updated scraping worker fundamentals extraction logic.
- Updated notifier recipient selection and message dispatch inputs.

### Lane B — Communication Test Backbone (Safety Net)
Owner profile: test-focused backend engineer.

1. Add RabbitMQ contract tests for:
   - `market_news`
   - `stock_prices`
   - `fundamental_data`
2. Add notifier consumer ack/nack tests for:
   - `news_queue`
   - `price_updates`
   - `fundamentals_queue`
3. Add cross-service integration test: producer message -> notifier persistence (`news_articles`, `status_invest_data`).

Primary outputs:
- Contract test suite covering payload shape and invalid cases.
- Consumer behavior tests (ack on success, nack without requeue on failures).
- Integration test proving queue-to-DB persistence path.

### Lane C — Documentation Synchronization (Code-Current)
Owner profile: documentation/architecture maintainer.

1. Reconcile architecture and status docs with implemented behavior:
   - Fundamentals queue now consumed by notifier.
   - BRAPI primary + Yahoo fallback.
   - Service count update (include Mailhog where applicable).
   - Test count refresh.
2. Update outdated “next steps” to current gaps:
   - symbol-level news relevance in trigger
   - messaging contract/integration coverage progression

Primary outputs:
- Updated architecture/status/decision docs aligned to current code.
- Removed or reworded stale statements.

---

## Dependencies and Blockers

### Hard dependencies

1. **Lane B (integration test assertions) depends on Lane A contract stability**  
   If Lane A changes fundamentals or recipient-related behavior, Lane B integration assertions should target final payload/data behavior.

2. **Lane C depends on final outcomes from Lane A and Lane B**  
   Documentation must reflect actual post-implementation behavior and delivered test coverage.

### Soft dependencies (can run in parallel with coordination)

- Lane B contract/ack-nack tests can start immediately (independent of Lane A).
- Lane C can start by fixing already-known drift, then finalize after A/B merge.

### Likely blockers

- Ambiguity in queue payload contracts not explicitly documented in one place.
- Existing doc drift may cause incorrect initial acceptance assumptions.
- Integration tests may require stable local infra fixtures for RabbitMQ/PostgreSQL orchestration.

---

## Execution Order (with Parallelization)

## Phase 1 — Parallel Start

- **A1**: Fundamentals real parser implementation.
- **B1**: RabbitMQ payload contract tests.
- **B2**: Notifier ack/nack consumer tests.
- **C1**: Pre-update docs drift corrections that are already confirmed by code.

## Phase 2 — Midpoint Convergence

- **A2**: SMS/WhatsApp recipient plumbing completion.
- **B3**: Cross-service message -> DB integration test aligned to A1/A2 outputs.
- **C2**: Update docs with validated communication matrix and current “next tasks”.

## Phase 3 — Final Hardening

- Re-run tests and adjust flaky assumptions.
- Final docs pass for accuracy and consistency.
- Publish consolidated delivery status.

---

## Checkpoints

### Checkpoint 1 — P0 Readiness Gate
Exit criteria:
- Real fundamentals extraction merged and validated.
- Recipient object includes required phone/whatsapp fields end-to-end.
- No regression on existing notifier flow.

### Checkpoint 2 — Communication Safety Gate
Exit criteria:
- Contract tests fail on malformed payloads and pass on valid payloads.
- Ack/nack behavior explicitly verified for all active queues.
- At least one producer->queue->notifier->DB integration path is green.

### Checkpoint 3 — Documentation Truth Gate
Exit criteria:
- Architecture/status docs match code-current behavior.
- Outdated statements about fundamentals queue consumption removed.
- Test coverage claims updated to current reality.

### Checkpoint 4 — Release Gate
Exit criteria:
- P0 feature scope complete.
- P0 communication tests passing in CI/local standard run.
- Documentation sync merged with no known critical drift.

---

## Suggested Handoff Protocol

1. Lane A publishes interface/contract notes after each merged PR.
2. Lane B consumes those notes before finalizing integration assertions.
3. Lane C performs final pass only after A/B checkpoints 1 and 2 are green.
