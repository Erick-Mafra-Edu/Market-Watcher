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

### Totais por serviço

| Serviço | Testes antes | Novos testes | Total atual |
|---|---|---|---|
| `notifier-service` | 18 | +28 | **46** |
| `api-handler` | 8 | +8 | **16** |
| `web-app` | 21 | +10 | **31** |
| `scraping-worker` | 5 | +12 | **17** |
| `gnews-service` | 0 | +12 | **12** |
| **Total** | **52** | **+70** | **122** |

---

## 2. Features Ainda Pendentes (sem cobertura completa)

As features abaixo têm **testes implementados** para partes unitárias, mas **faltam implementação ou cobertura de integração E2E** para ser consideradas entregues.

### 2.1 Parser real de fundamentos StatusInvest (P0-A1)

**Contexto:** O `scraping-worker` usa um extrator baseado em aliases e regex para parsear HTML do StatusInvest. Os testes unitários do parser (`test_status_invest_parser.py`) e os testes de contrato de payload (`test_rabbitmq_contract.py`) já cobrem a lógica de normalização e extração a partir de HTML sintético.

**O que falta:**
- Fixture de HTML real versionada do StatusInvest para teste de regressão por snapshot — garante que mudanças na estrutura da página não passem despercebidas.
- Teste de integração E2E: `scraping-worker` scraping → publicação no RabbitMQ → consumo pelo `notifier-service` → persistência em `status_invest_data`.

**Arquivo sugerido:** `scraping-worker/tests/test_status_invest_html_fixture.py`

---

### 2.2 Roteamento de canais SMS/WhatsApp no notifier (P0-B1/B2)

**Contexto:** `AlertUser` já possui campos opcionais `phone` e `whatsapp`. A query de watchlist em `checkAlertConditions()` já seleciona `u.phone` e `u.whatsapp`. `sendAlert()` já mapeia esses campos para `MessageRecipient`. Os testes unitários em `index.future-features.test.ts` validam o mapeamento de recipient para os cenários email-only, email+phone e email+whatsapp.

**O que falta:**
- Cobertura de regras de elegibilidade por canal em modo `multi` com dados reais no banco.
- Fluxo E2E: fila → banco → envio real por provider (SMTP/Twilio/WhatsApp) com dados de contato reais.
- Teste de integração: `MessagingManager.send()` recebe `phone`/`whatsapp` e aciona os providers corretos quando disponíveis.

**Arquivo sugerido:** `notifier-service/src/integration/alert-chain.integration.test.ts`

---

### 2.3 Relevância de notícias por símbolo no trigger de alerta (P1)

**Contexto:** `hasRelevantNews()` atualmente verifica apenas se há atividade alta em tópicos genéricos de mercado (ex.: `"stock market"`, `"nasdaq"`). Não filtra notícias pelo símbolo específico do ativo monitorado.

**O que falta:**
- Implementação de filtragem de notícias por símbolo usando `stock_news` (tabela de associação já existente).
- Testes unitários para a nova lógica de relevância por símbolo.
- Testes de integração: fundamentos + preço + notícia relevante ao símbolo → alerta disparado; notícia irrelevante → alerta não disparado.

**Arquivo sugerido:** `notifier-service/src/integration/alert-chain.integration.test.ts`

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

### 2.6 Idempotência de mensagens (P2)

**Contexto:** Reentrega da mesma mensagem (ex.: requeue acidental) pode criar registros duplicados.

**O que falta:**
- Validação de que mensagens duplicadas não criam estado inconsistente no banco.
- Testes explícitos de idempotência para `news_articles` (já tem `ON CONFLICT`) e `status_invest_data`.

**Arquivo sugerido:** `notifier-service/src/integration/message-idempotency.integration.test.ts`

---

### 2.7 Retry/Reconnect do RabbitMQ (P1)

**Contexto:** Os serviços implementam lógica de reconexão com retry (`max_retries = 5`), mas esse comportamento não tem cobertura de teste.

**O que falta:**
- Testes que simulam falha de conexão e verificam que a reconexão é tentada o número correto de vezes.
- Verificação de que após esgotar retries o erro é propagado corretamente.

**Arquivos sugeridos:**
- `api-handler/src/index.communication.test.ts` (estender)
- `notifier-service/src/index.communication.test.ts` (estender)
- `gnews-service/tests/test_rabbitmq_retry.py`
- `scraping-worker/tests/test_rabbitmq_retry.py`

---

## 3. Definição de Pronto (checklist)

- [x] Testes unitários de contrato de payload para todos os producers: `gnews-service`, `scraping-worker`, `api-handler`
- [x] Testes de contrato consumer-side + ack/nack para as três filas do `notifier-service`
- [x] Testes de integração mensagem → persistência no banco (`news_articles`, `status_invest_data`)
- [x] Testes de contrato HTTP proxy `web-app` → `api-handler`
- [ ] Fixture HTML real versionada para regressão do parser StatusInvest
- [ ] Fluxo E2E de notificação multi-canal validado com dados reais de contato
- [ ] Relevância de notícias por símbolo implementada e testada
- [ ] Top Movers implementado e testado
- [ ] WebSocket para atualizações em tempo real
- [ ] Testes de idempotência de mensagens
- [ ] Testes de retry/reconnect RabbitMQ
