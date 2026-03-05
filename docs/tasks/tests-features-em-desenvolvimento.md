# Testes Implementados para Features Ainda em Desenvolvimento

## Objetivo

Registrar testes que existem no repositório, mas cujo valor final depende de
funcionalidades ainda parciais ou não concluídas no fluxo completo.

## Resumo rápido

- Os itens P0/P1 de comunicação (contratos, ack/nack, persistência, proxy HTTP)
  foram entregues na primeira iteração.
- Os itens de retry/reconnect, idempotência, fixture HTML e alert chain foram
  entregues nesta iteração.
- Ainda faltam: E2E live multi-canal, implementação de `hasRelevantNews` por
  símbolo, Top Movers e WebSocket.

## Matriz de prontidão

### 1) Roteamento de canais no notifier — ✅ Testes de integração implementados

- **Testes implementados:**
  - `notifier-service/src/index.future-features.test.ts` — recipient email-only, email+phone, email+whatsapp.
  - `notifier-service/src/integration/alert-chain.integration.test.ts` — roteamento multi-canal, opções de provider, alerta salvo no banco.
- **O que valida hoje:**
  - `MessageRecipient` inclui `email`, `phone` e `whatsapp` conforme disponibilidade.
  - `preferredProviders: ['SMTP']` em email-only mode, `fallbackEnabled: true` em multi.
  - `INSERT INTO alerts` após envio bem-sucedido.
- **Lacuna remanescente:**
  - Fluxo E2E com providers reais (SMTP/Twilio/WhatsApp) e dados de contato reais.
- **Status:** **Integração pronta**, E2E live pendente.

### 2) Parser de fundamentos StatusInvest — ✅ Fixture HTML implementada

- **Testes implementados:**
  - `scraping-worker/tests/test_status_invest_parser.py` — parser unitário.
  - `scraping-worker/tests/test_status_invest_html_fixture.py` — 24 testes de regressão por snapshot (fixture V1, V2 noisy, vazia).
- **O que valida hoje:**
  - Parser extrai corretamente todos os 5 indicadores de layouts realistas.
  - Degradação graciosa (todos `None`) quando página sem dados.
  - `scraped_at` sempre preenchido.
- **Lacuna remanescente:**
  - Teste de integração E2E ponta a ponta (requer Docker em execução).
- **Status:** **Parser + fixture pronto**, E2E live pendente.

### 3) Retry/Reconnect do RabbitMQ — ✅ Implementado

- **Testes implementados:**
  - `api-handler/src/index.communication.test.ts` — 4 testes de retry.
  - `notifier-service/src/index.communication.test.ts` — 4 testes de retry.
  - `gnews-service/tests/test_rabbitmq_retry.py` — 8 testes de retry.
  - `scraping-worker/tests/test_rabbitmq_retry.py` — 8 testes de retry.
- **Status:** ✅ **Completo**.

### 4) Idempotência de mensagens — ✅ Implementado

- **Testes implementados:**
  - `notifier-service/src/integration/message-idempotency.integration.test.ts` — 11 testes.
- **Status:** ✅ **Completo**.

### 5) Relevância de notícias por símbolo — Parcialmente coberta

- **Testes implementados:**
  - `notifier-service/src/integration/alert-chain.integration.test.ts` — cobre `linkNewsToMentionedStocks` e `hasRelevantNews` com contagem de tópicos.
- **Lacuna remanescente:**
  - `hasRelevantNews()` ainda usa contagem de tópicos genéricos; não consulta `stock_news` para verificar notícias específicas do símbolo. A implementação dessa lógica + testes adicionais está pendente.
- **Status:** **Parcial** (caminho de associação coberto, lógica de filtragem por símbolo pendente).

## Features sem suite própria ainda

As features abaixo continuam sem implementação e sem testes:

- **Top Movers no dashboard** — sem rota, query ou componente.
- **WebSocket para atualizações em tempo real** — sem servidor WS nem canal de push.
- **Fluxo E2E multi-canal com providers reais** — requer ambiente completo.
- **`hasRelevantNews()` baseado em `stock_news`** — implementação pendente.

## Backlog recomendado (próxima iteração)

1. Implementar `hasRelevantNews()` consultando `stock_news` pelo `stock_id` e adicionar testes de unidade.
2. Implementar rota `GET /api/stocks/top-movers` no `api-handler` com testes unitários e de integração.
3. Adicionar servidor WebSocket no `web-app` e testes de integração.
4. Validar fluxo E2E multi-canal em ambiente Docker com Mailhog + providers mock.

## Definição de pronto (atualizada)

1. ✅ Testes unitários de contrato de payload (producers/consumers).
2. ✅ Testes de ack/nack para as três filas do notifier.
3. ✅ Testes de integração mensagem → persistência no banco.
4. ✅ Testes HTTP proxy web-app → api-handler.
5. ✅ Fixture HTML versionada para regressão do parser StatusInvest.
6. ✅ Testes de idempotência de mensagens.
7. ✅ Testes de retry/reconnect RabbitMQ (todos os 4 serviços).
8. ✅ Testes de integração do roteamento multi-canal e relevância de notícias.
9. [ ] `hasRelevantNews()` baseado em `stock_news` implementado e testado.
10. [ ] Top Movers implementado e testado.
11. [ ] WebSocket implementado e testado.
12. [ ] Fluxo E2E multi-canal validado com dados reais de contato.