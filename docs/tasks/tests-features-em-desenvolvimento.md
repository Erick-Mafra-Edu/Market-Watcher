# Testes Implementados para Features Ainda em Desenvolvimento

## Objetivo

Registrar testes que ja existem no repositorio, mas cujo valor final depende de funcionalidades ainda parciais ou nao concluidas no fluxo completo.

## Resumo rapido

- Existem testes unitarios novos que validam partes de features P0.
- Ainda faltam testes de contrato/integracao para fechar o ciclo de comunicacao e entrega E2E.
- Este documento evita falsa percepcao de cobertura completa.

## Matriz de prontidao

### 1) Roteamento de canais no notifier (parcialmente pronto)

- **Teste implementado:** `notifier-service/src/index.future-features.test.ts`
- **O que valida hoje:**
  - `MessageRecipient` inclui `email`, `phone` e `whatsapp` conforme disponibilidade dos dados do usuario.
  - Cobertura de cenarios: email-only, email+phone, email+whatsapp.
- **Lacuna de funcionalidade para validacao completa:**
  - Falta comprovar fluxo E2E com filas + banco + envio real por provider (SMTP/Twilio/WhatsApp) no caminho completo de alerta.
  - Falta cobertura de regras de elegibilidade por canal em modo `multi` com dados reais no banco.
- **Status:** **Parcial** (unitario pronto, integracao pendente).

### 2) Parser de fundamentos StatusInvest (parcialmente pronto)

- **Teste implementado:** `scraping-worker/tests/test_status_invest_parser.py`
- **O que valida hoje:**
  - Normalizacao numerica (percentual, milhares/decimais, sufixos `K/M/B`).
  - Extracao por HTML sintetico para `dividend_yield`, `p_vp`, `p_l`, `roe`, `liquidity`.
  - Comportamento com indicador ausente (`None`).
- **Lacuna de funcionalidade para validacao completa:**
  - Falta fixture de HTML real versionada para robustez contra mudancas da pagina.
  - Falta teste de integracao de ponta a ponta: scraping -> publicacao RabbitMQ -> consumo notifier -> persistencia `status_invest_data`.
- **Status:** **Parcial** (parser unitario pronto, resiliencia/integracao pendentes).

## Features futuras sem teste implementado ainda

As features abaixo continuam sem suite propria no estado atual:

- Top Movers no dashboard
- WebSocket para atualizacoes em tempo real
- Fixtures HTML reais versionadas para regressao do parser StatusInvest
- Retry/Reconnect do RabbitMQ (todos os servicos)
- Idempotencia de mensagens (reentrega sem duplicata no banco)
- Fluxo E2E de alerta multi-canal (SMS/WhatsApp com dados reais)

**Nota:** Os itens `Contratos RabbitMQ (producers/consumers)`, `Ack/Nack por fila no notifier` e
`Integracao message -> persistence` foram implementados como parte da iteracao P0/P1.
Consultar `docs/tasks/tests-implementados-e-features-pendentes.md` para o inventario completo.

## Backlog recomendado (proxima iteracao)

1. Criar fixtures HTML reais para `scraping-worker` e adicionar testes de regressao por snapshot.
2. Estender `notifier-service/src/integration/alert-chain.integration.test.ts` para fluxo multi-canal.
3. Criar `scraping-worker/tests/test_rabbitmq_retry.py` e `gnews-service/tests/test_rabbitmq_retry.py`.
4. Criar `notifier-service/src/integration/message-idempotency.integration.test.ts`.

## Definicao de pronto (para remover este documento como pendencia)

1. Testes unitarios atuais continuam verdes.
2. Testes de contrato e integracao P0 implementados e verdes.
3. Fluxo de notificacao multi-canal validado com dados reais de contato.
4. Fluxo de fundamentos validado ponta a ponta sem dependencia de mock.