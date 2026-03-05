# Testes Implementados e Features Pendentes

> Documento gerado após a entrega da primeira iteração de testes P0/P1 descrita no `master-execution-plan.md`.

---

## 1. Testes Implementados

### 1.1 Contratos de payload RabbitMQ (producer side)

#### `gnews-service/tests/test_rabbitmq_contract.py` — 12 testes ✅
Valida que `GNewsService.process_article()` produz um payload `market_news` com todos os campos exigidos pelo consumidor.

| Grupo | O que valida |
|---|---|
| Presença de campos obrigatórios | `title`, `description`, `url`, `source`, `published_at`, `topic` todos presentes |
| Valores corretos | Cada campo reflete o artigo de entrada e o tópico passado |
| Tipos | Todos os campos obrigatórios são strings |
| Degradação graciosa | `source` default `"Unknown"`, `title` default `""`, `published_at` default ISO quando ausentes |
| Integridade de schema | Nenhum campo obrigatório pode ser removido sem quebrar o teste |

---

#### `scraping-worker/tests/test_rabbitmq_contract.py` — 12 testes ✅
Valida que `StatusInvestScraper.scrape_stock()` produz um payload `fundamental_data` com todos os campos exigidos pelo consumidor, e que `publish_data()` envia para o exchange correto.

| Grupo | O que valida |
|---|---|
| Presença de campos obrigatórios | `symbol`, `dividend_yield`, `p_vp`, `p_l`, `roe`, `liquidity`, `scraped_at` presentes |
| `symbol` | Valor espelha o símbolo de entrada |
| `scraped_at` | String ISO-8601 válida |
| Tipos numéricos | Cada indicador é `float` ou `None` |
| Indicadores ausentes | Todos os cinco são `None` quando a página não contém dados |
| Serialização | Payload é JSON-serializável (compatibilidade com broker) |
| Exchange | `publish_data()` publica no exchange `fundamental_data` |
| Corpo JSON | Corpo publicado contém todos os campos obrigatórios |

---

#### `api-handler/src/index.communication.test.ts` — 8 testes ✅
Valida que `ApiHandler.publishStockData()` produz um payload `stock_prices` conforme o contrato.

| Grupo | O que valida |
|---|---|
| Campos obrigatórios | `symbol`, `price`, `changePercent`, `volume`, `marketCap`, `timestamp` presentes |
| Dados corretos | `symbol` e valores numéricos espelham o input |
| `timestamp` | String ISO-8601 válida |
| Exchange | Publica no exchange `stock_prices` com `contentType: application/json` e `persistent: true` |
| Sem canal | Não publica (sem erro) quando `channel` é `null` |
| Edge cases | `price = 0` e `changePercent` negativo são preservados |

---

### 1.2 Contratos de consumidor + comportamento ack/nack

#### `notifier-service/src/index.communication.test.ts` — 22 testes ✅
Valida os contratos dos três canais consumidos pelo `NotifierService` e o comportamento de ack/nack para cada fila.

**Contratos de payload (consumer side)**

| Contrato | O que valida |
|---|---|
| `fundamental_data` | Aceita payload válido, aceita indicadores `null`, rejeita sem `symbol`, rejeita com `symbol` não-string |
| `market_news` | Aceita payload válido; schema contém todos os 6 campos obrigatórios |
| `stock_prices` | Aceita payload válido; schema contém todos os 6 campos obrigatórios |

**Comportamento ack/nack por fila**

| Fila | Ack em payload válido | Nack em erro do handler | Nack em JSON inválido | Nulo ignorado |
|---|---|---|---|---|
| `news_queue` | ✅ | ✅ | ✅ | ✅ |
| `price_updates` | ✅ | ✅ | ✅ | ✅ |
| `fundamentals_queue` | ✅ | ✅ + nack em `symbol` ausente | ✅ | ✅ |

---

### 1.3 Persistência mensagem → banco de dados

#### `notifier-service/src/integration/messaging-persistence.integration.test.ts` — 6 testes ✅
Valida que as mensagens recebidas via fila são persistidas nas tabelas corretas do banco de dados (sem depender de banco real).

| Caminho | O que valida |
|---|---|
| `handleNews` → `news_articles` | SQL contém `INSERT INTO news_articles` com todos os campos da notícia |
| `handleNews` → `news_articles` | `sentiment_score` está presente no INSERT |
| `handleNews` → `news_articles` | Usa `ON CONFLICT` para evitar duplicatas por URL |
| `handleFundamentalsUpdate` → `status_invest_data` | INSERT com `stock_id`, `dividend_yield`, `p_vp`, `p_l`, `roe`, `liquidity` corretos |
| `handleFundamentalsUpdate` → `status_invest_data` | Símbolo normalizado para maiúsculas antes de persistir |
| `handleFundamentalsUpdate` → `status_invest_data` | Indicadores `null` não causam exceção |

---

### 1.4 Proxy HTTP web-app → api-handler

#### `web-app/src/integration/stocks-proxy.integration.test.ts` — 10 testes ✅
Valida as rotas de proxy que encaminham requisições de dados de ações do `web-app` para o `api-handler`.

| Rota | O que valida |
|---|---|
| `GET /api/stocks/:symbol` | 401 sem token; 200 com dados; símbolo correto na URL; status do upstream repassado; 500 quando `api-handler` inacessível |
| `GET /api/stocks/:symbol/history` | 401 sem token; 200 com dados históricos; parâmetros `period1`/`period2` encaminhados; status do upstream repassado; 500 quando inacessível |

---

### 1.5 Retry/Reconnect do RabbitMQ (P1)

#### `api-handler/src/index.communication.test.ts` — 4 novos testes (total: 12) ✅
Valida o comportamento de retry/reconnect de `ApiHandler.connectRabbitMQ()`.

| Grupo | O que valida |
|---|---|
| Falha total | Lança após 5 tentativas esgotadas |
| Contagem exata | `amqp.connect` chamado exatamente 5 vezes em caso de falha total |
| Sucesso imediato | Sem retry quando primeira tentativa funciona |
| Sucesso tardio | Sucesso na terceira tentativa após duas falhas |

---

#### `notifier-service/src/index.communication.test.ts` — 4 novos testes (total: 26) ✅
Mesma cobertura para `NotifierService.connectRabbitMQ()`.

---

#### `gnews-service/tests/test_rabbitmq_retry.py` — 8 testes ✅
Valida retry/reconnect de `GNewsService.connect_rabbitmq()`.

| Grupo | O que valida |
|---|---|
| Falha total | Lança após 5 tentativas com `ConnectionRefusedError` |
| Contagem exata | `BlockingConnection` chamado exatamente 5 vezes |
| Sleep entre tentativas | `sleep()` chamado 4 vezes (não após última tentativa) |
| Erro preservado | Tipo e mensagem do erro original mantidos |
| Sucesso imediato | Sem sleep quando primeira tentativa funciona |
| Sucesso tardio | Sucesso na terceira tentativa, sleep chamado 2 vezes |
| Channel atribuído | `self.channel` preenchido após conexão bem-sucedida |
| Declares | `exchange_declare`, `queue_declare`, `queue_bind` chamados após connect |

---

#### `scraping-worker/tests/test_rabbitmq_retry.py` — 8 testes ✅
Mesma cobertura para `StatusInvestScraper.connect_rabbitmq()`.

---

### 1.6 Fixture HTML versionada para regressão do parser StatusInvest

#### `scraping-worker/tests/test_status_invest_html_fixture.py` — 24 testes ✅
Valida o parser contra snapshots HTML versionados.

| Fixture | O que valida |
|---|---|
| V1 indicator-card layout | Todos os 5 indicadores extraídos com valores exatos; `scraped_at` ISO; todos os campos obrigatórios presentes |
| V2 noisy table layout | Indicadores extraídos de HTML com nav/header/aside/footer ao redor |
| Empty fixture | Todos os indicadores são `None`; `scraped_at` sempre preenchido; símbolo preservado |

---

### 1.7 Idempotência de mensagens

#### `notifier-service/src/integration/message-idempotency.integration.test.ts` — 11 testes ✅
Valida que re-entrega da mesma mensagem não cria estado inconsistente.

| Caminho | O que valida |
|---|---|
| `handleNews` duplicado | Não lança em segunda entrega; `ON CONFLICT` presente; dois INSERTs independentes emitidos |
| Terceiro URL único | Não interfere nos anteriores |
| `handleFundamentalsUpdate` duplicado | Não lança; dois INSERTs emitidos; `null` em re-entrega não quebra; símbolo normalizado consistentemente; dois símbolos distintos + re-entrega do primeiro funciona |

---

### 1.8 Integração alert chain (multi-canal + relevância de notícias)

#### `notifier-service/src/integration/alert-chain.integration.test.ts` — 11 testes ✅

| Grupo | O que valida |
|---|---|
| Recipient routing | `email`/`phone`/`whatsapp` presentes quando disponíveis; `phone`/`whatsapp` omitidos quando ausentes |
| Email-only mode | `preferredProviders: ['SMTP']` e `fallbackEnabled: false` |
| Multi-channel mode | Sem `preferredProviders`, `fallbackEnabled: true` |
| Alerta salvo no banco | `INSERT INTO alerts` após envio bem-sucedido |
| `hasRelevantNews()` | Retorna `false` com < 3 news; `true` com ≥ 3 |
| `linkNewsToMentionedStocks` | `INSERT INTO stock_news` quando símbolo no título; ausente quando nenhum símbolo conhecido |
| Relevance score | > 0.5 quando símbolo no título |
| Sem alerta sem news | Não dispara quando preço muda mas news insuficientes |

---

### Totais por serviço (atualizado)

| Serviço | Total iteração P0/P1 | Novos testes (esta iteração) | Total atual |
|---|---|---|---|
| `notifier-service` | 46 | +24 | **70** |
| `api-handler` | 16 | +4 | **20** |
| `web-app` | 31 | 0 | **31** |
| `scraping-worker` | 17 | +32 | **49** |
| `gnews-service` | 12 | +8 | **20** |
| **Total** | **122** | **+68** | **190** |

---

## 2. Features Ainda Pendentes (sem cobertura completa)

As features abaixo têm **testes implementados** para partes unitárias/integração, mas **faltam implementação de produto ou cobertura E2E live** para ser consideradas totalmente entregues.

### 2.1 Parser real de fundamentos StatusInvest (P0-A1)

**Contexto:** O `scraping-worker` usa um extrator baseado em aliases e regex para parsear HTML do StatusInvest. Os testes unitários do parser, os testes de contrato de payload e agora os **testes de fixture HTML versionada** cobrem a lógica de normalização e extração.

**O que foi implementado:**
- `scraping-worker/tests/test_status_invest_html_fixture.py` — 24 testes de regressão por snapshot: fixture V1 (indicator-card layout), fixture V2 noisy (table layout com conteúdo ao redor) e fixture vazia (degradação graciosa).

**O que ainda falta:**
- Teste de integração E2E live: `scraping-worker` scraping → publicação no RabbitMQ → consumo pelo `notifier-service` → persistência em `status_invest_data` (requer infra Docker em execução).

---

### 2.2 Roteamento de canais SMS/WhatsApp no notifier (P0-B1/B2)

**O que foi implementado:**
- `notifier-service/src/integration/alert-chain.integration.test.ts` — testes de integração do roteamento multi-canal:
  - Recipient inclui `email`, `phone` e `whatsapp` quando disponíveis.
  - `preferredProviders: ['SMTP']` passado quando `emailOnlyMode=true`.
  - `fallbackEnabled: true` e sem `preferredProviders` quando modo `multi`.
  - Alerta salvo no banco após envio bem-sucedido.

**O que ainda falta:**
- Fluxo E2E com providers reais (SMTP/Twilio/WhatsApp) e dados de contato reais.

---

### 2.3 Relevância de notícias por símbolo no trigger de alerta (P1)

**O que foi implementado:**
- `notifier-service/src/integration/alert-chain.integration.test.ts` — testes de relevância:
  - `hasRelevantNews()` retorna `false` com < 3 news no tópico.
  - `hasRelevantNews()` retorna `true` com ≥ 3 news no tópico.
  - `linkNewsToMentionedStocks()` cria associação `stock_news` quando símbolo aparece no título.
  - Nenhuma associação criada quando nenhum símbolo conhecido aparece no texto.
  - `relevance_score` > 0.5 quando símbolo está no título.
  - Alerta não disparado quando mudança de preço atinge threshold mas não há news suficientes.

**O que ainda falta:**
- Implementação de filtragem por símbolo dentro do `hasRelevantNews()` para verificar `stock_news` (atualmente verifica tópicos genéricos). Os testes de integração já cobrem o caminho de associação existente.

---

### 2.4 Top Movers no dashboard (web-app)

**Contexto:** Feature ainda não implementada. Não há rota, controller, query ou componente frontend para exibir os ativos com maior variação do dia.

**O que falta:**
- Implementação da rota `GET /api/stocks/top-movers` no `web-app` ou `api-handler`.
- Query ao banco para ordenar por `change_percent DESC` em `stock_prices`.
- Testes unitários e de integração para a rota.
- Componente frontend de exibição.

---

### 2.5 WebSocket para atualizações em tempo real

**Contexto:** Feature ainda não implementada. O `web-app` usa polling HTTP para buscar dados de ações.

**O que falta:**
- Servidor WebSocket no `web-app` (ex.: `ws` ou `socket.io`).
- Canal de notificação quando nova mensagem de `price_updates` chega no notifier.
- Testes de integração para o fluxo de push de atualização em tempo real.

---

### 2.6 Idempotência de mensagens (P2) ✅ Testes implementados

**O que foi implementado:**
- `notifier-service/src/integration/message-idempotency.integration.test.ts` — 11 testes:
  - Segunda entrega do mesmo URL de notícia não lança exceção.
  - `ON CONFLICT` presente no INSERT de `news_articles`.
  - Cada entrega emite exatamente um INSERT independente (o banco resolve o conflito).
  - Segunda entrega de fundamentais para o mesmo símbolo não lança exceção.
  - Indicadores `null` em re-entrega não causam erro.
  - Símbolo normalizado para maiúsculas em re-entregas consecutivas.

---

### 2.7 Retry/Reconnect do RabbitMQ (P1) ✅ Testes implementados

**O que foi implementado:**
- `api-handler/src/index.communication.test.ts` (estendido) — 4 novos testes:
  - Lança após 5 tentativas esgotadas.
  - `amqp.connect` chamado exatamente 5 vezes em caso de falha total.
  - Sucesso na primeira tentativa sem retry.
  - Sucesso na terceira tentativa após duas falhas.
- `notifier-service/src/index.communication.test.ts` (estendido) — 4 novos testes (mesma cobertura).
- `gnews-service/tests/test_rabbitmq_retry.py` — 8 novos testes (Python).
- `scraping-worker/tests/test_rabbitmq_retry.py` — 8 novos testes (Python).

---

## 3. Definição de Pronto (checklist)

- [x] Testes unitários de contrato de payload para todos os producers: `gnews-service`, `scraping-worker`, `api-handler`
- [x] Testes de contrato consumer-side + ack/nack para as três filas do `notifier-service`
- [x] Testes de integração mensagem → persistência no banco (`news_articles`, `status_invest_data`)
- [x] Testes de contrato HTTP proxy `web-app` → `api-handler`
- [x] Fixture HTML versionada para regressão do parser StatusInvest (`scraping-worker/tests/test_status_invest_html_fixture.py`)
- [x] Testes de idempotência de mensagens (`notifier-service/src/integration/message-idempotency.integration.test.ts`)
- [x] Testes de retry/reconnect RabbitMQ (todos os 4 serviços)
- [x] Testes de integração do roteamento multi-canal + relevância de notícias por símbolo (`notifier-service/src/integration/alert-chain.integration.test.ts`)
- [ ] Fluxo E2E de notificação multi-canal validado com providers reais (SMTP/Twilio/WhatsApp)
- [ ] Relevância de notícias por símbolo implementada dentro de `hasRelevantNews()` usando `stock_news`
- [ ] Top Movers implementado e testado
- [ ] WebSocket para atualizações em tempo real
