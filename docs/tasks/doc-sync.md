# Task: Documentation Sync

Fonte: `docs/agents/results/docs-reconcile.md` (2026-03-05)

## P0 (corrigir fatos objetivamente incorretos)

1. **Arquivo:** `DECISOES_DE_ARQUITETURA.md`  
   **Seção:** ADR-002 (observação sobre fundamentals)  
   **Update exato:** trocar status para **implementado** e atualizar texto para indicar que o `notifier-service` **consome `fundamentals_queue`** e processa fundamentos.  
   **Owner sugerido:** Architecture owner + maintainer do `notifier-service`.

2. **Arquivo:** `DECISOES_DE_ARQUITETURA.md`  
   **Seção:** Pendências arquiteturais (uso de dados fundamentalistas)  
   **Update exato:** remover status de pendente; registrar como **implementado com regras simples**, mantendo apenas evolução de calibragem como pendência.  
   **Owner sugerido:** Architecture owner.

3. **Arquivo:** `DECISOES_DE_ARQUITETURA.md`  
   **Seção:** Pendências arquiteturais (anti-duplicidade/cooldown)  
   **Update exato:** mover de pendente para **implementado (básico)**, citando existência de cooldown com `ALERT_COOLDOWN_MINUTES`; manter melhorias de granularidade como backlog.  
   **Owner sugerido:** Architecture owner + maintainer do `notifier-service`.

4. **Arquivo:** `STATUS_ENTREGAS_E_TESTES_FUTUROS.md`  
   **Seção:** Infraestrutura / status de serviços  
   **Update exato:** atualizar de **7 para 8 serviços** no `docker-compose.yml`, incluindo `mailhog` como serviço de apoio dev/e2e.  
   **Owner sugerido:** DevOps/Platform.

5. **Arquivo:** `STATUS_ENTREGAS_E_TESTES_FUTUROS.md`  
   **Seção:** Notifier + fundamentos  
   **Update exato:** alterar status para **Entregue (MVP)** (ou **Parcial**, se quiser explicitar calibragem), removendo afirmação de que `fundamentals_queue` não é consumida.  
   **Owner sugerido:** Maintainer do `notifier-service`.

6. **Arquivo:** `STATUS_ENTREGAS_E_TESTES_FUTUROS.md`  
   **Seção:** Contagem de testes  
   **Update exato:** corrigir contagens para `api-handler/src/index.test.ts` = **8 it(...)** e `portfolio.controller.test.ts` = **12 it(...)**, registrando data da medição.  
   **Owner sugerido:** QA + maintainer do `api-handler`.

7. **Arquivo:** `SERVICE_ARCHITECTURE.md`  
   **Seção:** Overview de serviços e diagrama  
   **Update exato:** atualizar para **8 serviços**, incluindo `mailhog` no overview/diagrama.  
   **Owner sugerido:** Architecture owner + DevOps/Platform.

8. **Arquivo:** `SERVICE_ARCHITECTURE.md`  
   **Seção:** API Handler (fonte de dados)  
   **Update exato:** substituir descrição “Yahoo primário” por estratégia real: **`BrapiProvider` primário + `YahooFinanceProvider` fallback**, incluindo referência a `BRAPI_TOKEN`.  
   **Owner sugerido:** Maintainer do `api-handler`.

9. **Arquivo:** `SERVICE_ARCHITECTURE.md`  
   **Seção:** RabbitMQ / Exchanges & Queues / Notifier  
   **Update exato:** atualizar tabela/matriz para refletir que `notifier-service` **consome `fundamentals_queue`**.  
   **Owner sugerido:** Architecture owner + maintainer do `notifier-service`.

10. **Arquivo:** `SERVICE_ARCHITECTURE.md`  
    **Seção:** Price Alert Flow e Service Communication Matrix  
    **Update exato:** atualizar fluxo para tentativa **BRAPI** com fallback **Yahoo**, removendo fluxo exclusivo Yahoo.  
    **Owner sugerido:** Architecture owner + maintainer do `api-handler`.

## P1 (reclassificar entrega parcial e alinhar backlog)

11. **Arquivo:** `DECISOES_DE_ARQUITETURA.md`  
    **Seção:** Pendência “correlação notícia ↔ ativo”  
    **Update exato:** ajustar texto para “relação já é preenchida em `stock_news`; falta usar correlação por ativo no gatilho final”.  
    **Owner sugerido:** Architecture owner + maintainer do `notifier-service`.

12. **Arquivo:** `STATUS_ENTREGAS_E_TESTES_FUTUROS.md`  
    **Seção:** Gráficos históricos/indicadores técnicos  
    **Update exato:** mudar de “não entregue” para **Parcial** (gráfico histórico básico entregue via `ChartsTab` + endpoint `/api/stocks/:symbol/history`; indicadores avançados continuam pendentes).  
    **Owner sugerido:** Maintainers de frontend + `api-handler`.

13. **Arquivo:** `STATUS_ENTREGAS_E_TESTES_FUTUROS.md`  
    **Seção:** Próxima tarefa definida  
    **Update exato:** substituir recomendação obsoleta (consumo de `fundamentals_queue`) por gap real atual: uso de `stock_news` no gatilho final, contratos de mensagem e testes de integração do notifier.  
    **Owner sugerido:** Tech lead + maintainers de `notifier-service`.

## P2 (consistência de claims de segurança)

14. **Arquivo:** `SERVICE_ARCHITECTURE.md`  
    **Seção:** Security features (HTML Sanitization)  
    **Update exato:** remover claim de sanitização HTML no web-app (ou marcar explicitamente como “planejado”), já que não há evidência de implementação em `web-app/src`.  
    **Owner sugerido:** Security champion + maintainer do frontend.

## Sequência sugerida de execução

1. Executar todos os itens **P0** primeiro.  
2. Em seguida, aplicar **P1** para reclassificação de status e atualização de backlog.  
3. Finalizar com **P2** para evitar claims de segurança sem lastro em código.
