# Feature Gaps (MVP-Focused)

| Missing capability | Why it matters | Evidence (file path) | MVP priority |
|---|---|---|---|
| Real StatusInvest fundamentals extraction (no mock) | Fundamental filters and alert quality depend on real `p/l`, `p/vp`, `roe`, liquidity values. | `scraping-worker/src/main.py` (`_extract_indicator` uses hardcoded mock data + TODO) | **P0** |
| End-to-end SMS/WhatsApp delivery for users | Multi-channel alerting is incomplete if recipient phone/WhatsApp is not passed to providers. | `notifier-service/src/index.ts` (watchlist query selects only `u.id,u.email,u.name`; recipient object sets only `email`), `notifier-service/src/messaging/twilio.ts`, `notifier-service/src/messaging/whatsapp.ts` (require `recipient.phone/whatsapp`) | **P0** |
| User-configurable news topics for alerts | Product docs state custom topics, but implementation is fixed-topic/global; users cannot manage topic preferences. | `gnews-service/src/main.py` (`MARKET_TOPICS` hardcoded), `database/init.sql` (no user-topic table), `web-app/src/index.ts` (no topic management endpoints), `web-app/frontend/src/services/api.ts` (no topic APIs) | **P1** |
| Use configured GNews API key in runtime | Reliability/rate-limit behavior depends on using configured key; key is declared but not applied to client. | `gnews-service/src/main.py` (`GNEWS_API_KEY` read but never used), `.env.example`, `README.md` (documents key requirement) | **P1** |
| Stock-specific news relevance in alert trigger | Current rule can trigger alerts from generic market noise instead of symbol-relevant news. | `notifier-service/src/index.ts` (`hasRelevantNews(symbol)` ignores `symbol`, checks only topic volume) | **P2** |

## Suggested MVP sequence
1. **P0**: Replace fundamentals mock parser + complete phone/WhatsApp recipient plumbing.
2. **P1**: Add user topic preferences (DB + API + UI) and wire GNews key usage.
3. **P2**: Tighten alert trigger to require symbol-level news relevance.
