# P0 Features — Implementation-Ready Tasks (MVP First)

Source: `docs/agents/results/gap-features.md`

## Scope (only P0 from gaps)
1. Real StatusInvest fundamentals extraction (remove mock parser).
2. End-to-end SMS/WhatsApp delivery (recipient phone/whatsapp plumbing).

## Execution order (MVP-first)
1. **Track A (can start now):** P0-A1 + P0-A2 (StatusInvest extraction + parser tests).
2. **Track B (can start now):** P0-B1 + P0-B2 (recipient data plumbing + notifier tests).
3. **Final checkpoint:** P0-C1 integration verification in docker/e2e flow.

---

## P0-A1 — Replace mock fundamentals extraction with real parser
**Goal:** Parse real `dividend_yield`, `p_vp`, `p_l`, `roe`, `liquidity` values from StatusInvest HTML.

**Implementation tasks**
- Add robust numeric normalization for Brazilian formats (e.g., `1.234,56`, `%`, `K/M/B` if present).
- Replace `_extract_indicator` mock map + warning with selector-based extraction from real HTML nodes.
- Keep `None` for missing indicators (do not default to fake numeric values).
- Keep current logging/error behavior; log indicator-level parse failures with indicator name.

**Touched files**
- `scraping-worker/src/main.py`

**Acceptance criteria**
- No mock data dictionary remains in `_extract_indicator`.
- For a real StatusInvest page snapshot, parser returns numeric values (or `None` when missing) for all five indicators.
- Published payload keeps the same schema (`symbol`, five indicators, `scraped_at`) and does not break consumer contract.

---

## P0-A2 — Add scraping parser regression tests
**Goal:** Prevent parser regressions when StatusInvest HTML changes.

**Implementation tasks**
- Add unit tests for numeric normalization and indicator extraction from representative HTML snippets.
- Cover at least: percentage parsing, decimal/thousand parsing, missing indicator behavior.

**Touched files**
- `scraping-worker/src/` (new test file, aligned with project test pattern)
- `scraping-worker/requirements*.txt` or test config files (only if needed to run tests)

**Acceptance criteria**
- Tests fail with old mock behavior and pass with real parser.
- Tests are deterministic (no live HTTP dependency).

---

## P0-B1 — Include phone/whatsapp in watchlist user query and recipient mapping
**Goal:** Ensure notifier can route alerts to SMS/WhatsApp providers when configured.

**Implementation tasks**
- Extend `AlertUser` with optional `phone` and `whatsapp`.
- Update watchlist query in `checkAlertConditions()` to select `u.phone` and `u.whatsapp`.
- Map `phone` and `whatsapp` into `MessageRecipient` in `sendAlert()`.
- Keep email flow unchanged; multi-channel should remain optional via existing mode flag.

**Touched files**
- `notifier-service/src/index.ts`

**Acceptance criteria**
- Query rows include phone/whatsapp fields when present in DB.
- `MessageRecipient` passed to `MessagingManager.send()` includes `phone`/`whatsapp`.
- In `multi` mode, SMS/WhatsApp providers are eligible when user has corresponding contact fields.

---

## P0-B2 — Add notifier coverage for recipient channel routing
**Goal:** Guard against regressions where phone/whatsapp is dropped before provider dispatch.

**Implementation tasks**
- Add or extend notifier unit tests to assert recipient payload includes email/phone/whatsapp.
- Validate behavior for:
  - user with email only
  - user with email + phone
  - user with email + whatsapp

**Touched files**
- `notifier-service/src/*.test.ts` (existing test files) or new notifier tests near `src/index.ts`

**Acceptance criteria**
- Tests verify `MessagingManager.send()` receives expected recipient fields per scenario.
- Existing notifier tests continue passing.

---

## P0-C1 — Integration verification (minimal)
**Goal:** Confirm both P0 features work together in current runtime path.

**Implementation tasks**
- Run containerized flow and validate:
  - scraping worker emits non-mock fundamentals;
  - notifier reads fundamentals and user contacts;
  - at least one alert attempt reaches enabled provider(s) according to available contact fields.

**Touched files**
- No code changes expected; only scripts/config updates if strictly required for existing test flow.

**Acceptance criteria**
- Logs show real parsed fundamentals (not fixed constants).
- Logs show notifier attempts provider delivery consistent with recipient data and channel mode.
- No schema or payload contract break between scraping-worker and notifier-service.
