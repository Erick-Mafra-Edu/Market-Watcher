# Reconciliação de Documentação vs Implementação (2026-03-05)

## Escopo comparado
- `DECISOES_DE_ARQUITETURA.md`
- `STATUS_ENTREGAS_E_TESTES_FUTUROS.md`
- `SERVICE_ARCHITECTURE.md`
- Implementação atual em `docker-compose.yml`, `api-handler/`, `notifier-service/`, `scraping-worker/`, `web-app/`, `database/init.sql`

## 1) Divergências em `DECISOES_DE_ARQUITETURA.md`

1. **ADR-002 (observação sobre fundamentals) está desatualizado**
   - **Doc atual:** diz que `notifier-service` não consome `fundamentals_queue`.
   - **Código atual:** consome `fundamentals_queue` e processa fundamentos em `notifier-service/src/index.ts` (`setupQueues`, `handleFundamentalsUpdate`).
   - **Sugestão de update:** trocar status para “implementado” (não “parcial”) e atualizar observação para refletir consumo ativo.

2. **Pendência arquitetural “uso de dados fundamentalistas” está desatualizada**
   - **Doc atual:** marca como pendente.
   - **Código atual:** fundamentos são persistidos em `status_invest_data` e usados em regra de alerta (`passesFundamentalRules`).
   - **Sugestão de update:** remover da lista de pendências ou reescrever como “implementado com regras simples; evoluir calibragem”.

3. **Pendência “correlação notícia ↔ ativo” parcialmente desatualizada**
   - **Doc atual:** sugere ausência de preenchimento da relação.
   - **Código atual:** existe preenchimento de `stock_news` (`linkNewsToMentionedStocks`), mas o gatilho principal ainda usa atividade por tópico (`hasRelevantNews`) e não `stock_news`.
   - **Sugestão de update:** ajustar texto para “relação já é preenchida; falta usar correlação por ativo no gatilho final”.

4. **Pendência “anti-duplicidade/cooldown” está desatualizada**
   - **Doc atual:** falta política explícita.
   - **Código atual:** existe cooldown (`isInCooldown`) com `ALERT_COOLDOWN_MINUTES`.
   - **Sugestão de update:** mover para “implementado (básico)” e deixar como melhoria apenas granularidade/estratégia.

## 2) Divergências em `STATUS_ENTREGAS_E_TESTES_FUTUROS.md`

1. **Infraestrutura: quantidade de serviços**
   - **Doc atual:** “Docker Compose com 7 serviços”.
   - **Código atual:** `docker-compose.yml` possui 8 serviços (`mailhog` adicional).
   - **Sugestão de update:** atualizar para 8 serviços e citar `mailhog` como serviço de apoio dev/e2e.

2. **Notifier + fundamentos**
   - **Doc atual:** “uso de dados fundamentalistas no gatilho” = não entregue; `fundamentals_queue` não consumida.
   - **Código atual:** `fundamentals_queue` é consumida; dados persistidos e usados nas regras.
   - **Sugestão de update:** alterar para **Entregue (MVP)** ou **Parcial** (se quiser destacar calibração de thresholds).

3. **“Próxima tarefa definida” está obsoleta**
   - **Doc atual:** recomenda implementar consumo de `fundamentals_queue`.
   - **Código atual:** já implementado.
   - **Sugestão de update:** substituir por próximo gap real (ex.: usar `stock_news` no gatilho, contratos de mensagem, testes de integração do notifier).

4. **Contagem de testes está desatualizada**
   - **Doc atual:** `api-handler/src/index.test.ts` com 3 testes; `portfolio.controller.test.ts` com 8.
   - **Código atual:** `api-handler/src/index.test.ts` possui 8 `it(...)`; `portfolio.controller.test.ts` possui 12 `it(...)`.
   - **Sugestão de update:** corrigir as contagens e registrar data de medição.

5. **“Gráficos históricos/indicadores técnicos” como não entregue está parcialmente desatualizado**
   - **Doc atual:** não entregue.
   - **Código atual:** frontend React possui aba de gráficos (`web-app/frontend/src/components/tabs/ChartsTab.tsx`) consumindo `/api/stocks/:symbol/history`.
   - **Sugestão de update:** marcar como **Parcial** (gráfico histórico básico entregue; indicadores técnicos avançados ainda pendentes).

## 3) Divergências em `SERVICE_ARCHITECTURE.md`

1. **Overview de serviços desatualizado**
   - **Doc atual:** 7 serviços.
   - **Código atual:** 8 serviços em `docker-compose.yml` (inclui `mailhog`).
   - **Sugestão de update:** ajustar diagrama e seção de overview para incluir `mailhog`.

2. **API Handler: fonte de dados desatualizada**
   - **Doc atual:** “Primary Library: yahoo-finance2” e foco em Yahoo.
   - **Código atual:** `BrapiProvider` primário + `YahooFinanceProvider` fallback.
   - **Sugestão de update:** atualizar seção para estratégia BRAPI primário / Yahoo fallback, incluindo `BRAPI_TOKEN`.

3. **RabbitMQ/consumidores de fundamentos desatualizado**
   - **Doc atual:** `fundamental_data` e `fundamentals_queue` sem consumidores.
   - **Código atual:** `notifier-service` consome `fundamentals_queue`.
   - **Sugestão de update:** atualizar tabela de exchanges/queues, matriz de comunicação e seção do notifier.

4. **Fluxo de preço e matriz de comunicação desatualizados**
   - **Doc atual:** fluxo mostra apenas Yahoo Finance.
   - **Código atual:** fluxo real inclui tentativa BRAPI e fallback Yahoo.
   - **Sugestão de update:** atualizar “Price Alert Flow” e “Service Communication Matrix”.

5. **Security feature “HTML Sanitization” não refletida no código**
   - **Doc atual:** afirma sanitização HTML no web-app.
   - **Código atual:** não há evidência de sanitização dedicada em `web-app/src`.
   - **Sugestão de update:** remover essa afirmação ou implementar de fato e então manter.

## Atualizações recomendadas (ordem prática)

1. Corrigir primeiro itens objetivamente incorretos (fundamentals, BRAPI fallback, quantidade de serviços, contagem de testes).
2. Reclassificar status de funcionalidades parcialmente entregues (gráficos e correlação notícia↔ativo).
3. Revisar seção de segurança do `SERVICE_ARCHITECTURE.md` para evitar claims não implementadas.
4. Atualizar “próxima tarefa recomendada” para um gap real atual.
