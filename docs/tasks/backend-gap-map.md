# Backend Gap Map (handoff)

Data: 2026-03-05
Objetivo: mapear funcionalidades de backend ausentes/incompletas para suportar as features ja implementadas no frontend.

## Escopo analisado

- `web-app/src/controllers/portfolio.controller.ts`
- `web-app/src/controllers/news.controller.ts`
- `web-app/src/index.ts`
- `notifier-service/src/index.ts`
- `gnews-service/src/main.py`
- `scraping-worker/src/main.py`

## Resumo executivo

Existe base funcional para portfolio, noticias e alertas.
Os principais gaps estao em: pipeline de dividendos, contratos de API para filtros/paginacao, cobertura de noticias por ativo e consistencia de moeda no payload de portfolio.

## Mapa de gaps priorizado

## P0 - Necessario para consolidar as novas telas

### 1) Ingestao de eventos de dividendos (dividend_history)
Status atual:
- A API de carteira consome `dividend_history` em `GET /api/portfolio/dividends`.
- Nao foi identificado produtor/consumer dedicado para popular `dividend_history` (ex-date, payment-date, dividend-amount) de forma continua.

Evidencias:
- `web-app/src/controllers/portfolio.controller.ts:597`
- `scraping-worker/src/main.py:105` (publica apenas indicadores fundamentalistas)

Gap:
- Falta pipeline de coleta + persistencia de calendario de dividendos por ativo.

Entrega sugerida:
- Worker/consumer dedicado para dividendos.
- UPSERT em `dividend_history` com chave natural (ex.: `stock_id + ex_date + dividend_type`).
- Metadado de `source` e `updated_at` para rastreabilidade.

### 2) Endpoint de dividendos orientado a "proximos pagamentos"
Status atual:
- Query atual usa `dh.ex_date IS NOT NULL`, `ORDER BY dh.ex_date DESC`, `LIMIT 50`.

Evidencias:
- `web-app/src/controllers/portfolio.controller.ts:623`
- `web-app/src/controllers/portfolio.controller.ts:626`
- `web-app/src/controllers/portfolio.controller.ts:627`

Gap:
- Nao ha filtros de periodo/futuro nem paginacao robusta para a aba de dividendos.

Entrega sugerida:
- Evoluir `GET /api/portfolio/dividends` com:
  - `onlyUpcoming=true|false`
  - `fromDate`, `toDate`
  - `symbol`
  - `limit`, `offset` (ou cursor)
  - `sort=ex_date|payment_date` + `order=asc|desc`

## P1 - Importante para qualidade dos dados

### 3) Noticias por ativo com maior cobertura e relevancia
Status atual:
- Correlacao `stock_news` existe no notifier via extraçao heuristica de simbolos.
- Coleta principal de noticias e por topicos de mercado genericos.

Evidencias:
- `notifier-service/src/index.ts:274`
- `notifier-service/src/index.ts:297`
- `notifier-service/src/index.ts:379`
- `gnews-service/src/main.py:28`

Gap:
- Cobertura por ticker pode ser baixa para ativos especificos da carteira.

Entrega sugerida:
- Pipeline complementar de noticias por simbolo/empresa (watchlist/portfolio-driven).
- Melhorar matching (alias de empresa, ticker local/internacional, normalizacao `.SA`).

### 4) Contrato de `GET /api/news/stock/:symbol` sem filtros de relevancia/tempo
Status atual:
- Endpoint ordena por data e aplica apenas `limit`.

Evidencias:
- `web-app/src/controllers/news.controller.ts:88`
- `web-app/src/controllers/news.controller.ts:112`
- `web-app/src/controllers/news.controller.ts:113`

Gap:
- Sem `minRelevance`, `since`, paginacao e sort por relevancia.

Entrega sugerida:
- Parametros:
  - `minRelevance`
  - `since`
  - `limit`, `offset`
  - `sort=published_at|relevance_score`

## P2 - Melhoria de eficiencia e consistencia

### 5) Moeda no payload de portfolio
Status atual:
- `fetchLiveQuote` busca apenas `price` e `changePercent`.
- Frontend hoje precisa resolver moeda em chamadas extras para alguns fluxos.

Evidencias:
- `web-app/src/controllers/portfolio.controller.ts:19`
- `web-app/src/controllers/portfolio.controller.ts:149`

Gap:
- `/api/portfolio` nao explicita `currency` por posiçao.

Entrega sugerida:
- Incluir `currency` em cada position retornada por `/api/portfolio`.
- Definir fallback padrao quando provider nao informar moeda.

### 6) Deduplicacao de alerta por evento (idempotencia)
Status atual:
- Ja existe cooldown temporal por usuario+ativo.

Evidencias:
- `notifier-service/src/index.ts:462`
- `notifier-service/src/index.ts:469`

Gap:
- Falta chave de idempotencia por evento/regra para evitar alertas repetidos em burst.

Entrega sugerida:
- Definir `alert_fingerprint` (user + symbol + trigger + janela).
- Persistir e bloquear reenvio dentro da janela.

## Observaçoes para alinhamento de documentaçao

Ha itens em `DECISOES_DE_ARQUITETURA.md` que parecem desatualizados frente ao codigo atual:
- Correlacao noticia <-> ativo: hoje existe inserçao em `stock_news` no notifier.
- Consumo de `fundamentals_queue`: hoje existe `assertQueue` + `consume` + `handleFundamentalsUpdate`.

Recomendaçao:
- Abrir tarefa de doc-sync para atualizar pendencias arquiteturais e evitar retrabalho de planejamento.

## Backlog de implementaçao (sugestao direta)

1. P0: Criar pipeline de ingestao de `dividend_history` + testes de contrato.
2. P0: Evoluir endpoint de dividendos com filtros de "proximos" + paginacao.
3. P1: Melhorar pipeline de news por ticker e relevancia.
4. P1: Evoluir endpoint de stock-news com filtros e ordenaçao por relevancia.
5. P2: Adicionar `currency` no response de `/api/portfolio`.
6. P2: Implementar idempotencia de alertas por fingerprint.
