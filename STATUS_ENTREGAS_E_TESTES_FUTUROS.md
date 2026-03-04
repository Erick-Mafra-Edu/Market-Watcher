# Status de Entregas e Plano de Testes Futuros

## Objetivo

Consolidar, de forma prática, o que já está entregue no projeto, o que está parcialmente entregue ou pendente, e quais testes devem ser implementados para as próximas funcionalidades.

## Premissas desta análise

- Baseado no código atual do repositório (não apenas nos documentos).
- Classificação utilizada:
  - **Entregue**: funcionalidade implementada e integrada no fluxo principal.
  - **Parcial**: implementada, mas com lacunas relevantes.
  - **Não entregue**: documentada/planejada sem implementação funcional completa.

---

## 1) Status de funcionalidades

## 1.1 Infraestrutura e Plataforma

- **Docker Compose com 7 serviços** → **Entregue**
- **Rede e healthchecks básicos** → **Entregue**
- **Persistência PostgreSQL + schema inicial** → **Entregue**
- **Mensageria RabbitMQ com exchanges/queues** → **Entregue**

## 1.2 Coleta de dados

- **Coleta de notícias (`gnews-service`)** → **Entregue**
- **Coleta de cotações (`api-handler`)** → **Entregue**
- **Scraping de fundamentos (`scraping-worker`)** → **Parcial**
  - Motivo: extração dos indicadores está com mock em `_extract_indicator`.

## 1.3 API e Backoffice (`web-app`)

- **Auth (registro/login) com JWT** → **Entregue**
- **Watchlist CRUD** → **Entregue**
- **Alertas (listar/marcar lido)** → **Entregue**
- **Endpoints de notícias + estatísticas de sentimento** → **Entregue**
- **Portfolio (posições, transações, dividendos)** → **Entregue**
- **Proxy de ações para `api-handler`** → **Entregue**

## 1.4 Motor de notificação (`notifier-service`)

- **Consumo de notícias e preços via RabbitMQ** → **Entregue**
- **Análise de sentimento nas notícias recebidas** → **Entregue**
- **Envio multi-canal (SMTP/Twilio/WhatsApp) com fallback** → **Entregue**
- **Correlação avançada notícia↔ativo para alerta preciso** → **Parcial**
  - Motivo: relação explícita com `stock_news` não está fechando o ciclo de decisão no fluxo principal.
- **Uso de dados fundamentalistas no gatilho de alertas** → **Não entregue**
  - Motivo: `fundamentals_queue` não está consumida no `notifier-service`.

## 1.5 Recursos de produto citados como futuros

- **Top Movers no dashboard** → **Não entregue**
- **Gráficos históricos/indicadores técnicos** → **Não entregue**
- **Atualizações em tempo real via WebSocket** → **Não entregue**

---

## 2) Cobertura de testes atual

## 2.1 Testes existentes (mapeados)

- `api-handler/src/index.test.ts` → **3 testes** (health, quote, history)
- `notifier-service/src/sentiment.service.test.ts` → **15 testes** (sentimento)
- `web-app/src/controllers/news.controller.test.ts` → **5 testes**
- `web-app/src/controllers/portfolio.controller.test.ts` → **8 testes**
- `web-app/src/integration/auth.integration.test.ts` → **2 testes**
- `web-app/src/integration/watchlist.integration.test.ts` → **2 testes**

## 2.2 Lacunas de teste relevantes

- Falta teste para fluxo de mensageria do `notifier-service` (integração com providers e persistência de alertas).
- Falta teste de contrato de mensagens RabbitMQ entre produtores e consumidores.
- Falta teste para `scraping-worker` com parsing real (quando sair do mock).
- Falta cobertura para controllers sem testes diretos (`alerts.controller`, `watchlist.controller`, `auth.middleware`).
- Falta teste de cenários de falha/retry em integrações externas.

---

## 3) Plano de testes para futuras funções

## Prioridade P0 (antes de ampliar funcionalidades)

1. **Motor de alertas fim-a-fim**
   - Tipo: integração
   - Validar: notícia + variação de preço + watchlist gera alerta persistido e enviado.
2. **Deduplicação/cooldown de alertas**
   - Tipo: unitário + integração
   - Validar: não enviar múltiplos alertas idênticos em janela curta.
3. **Contratos de mensagens RabbitMQ**
   - Tipo: contrato
   - Validar schema mínimo para `market_news`, `stock_prices`, `fundamental_data`.

## Prioridade P1 (evolução funcional imediata)

4. **Scraper StatusInvest real (sem mock)**
   - Tipo: unitário com fixtures HTML + integração
   - Validar parsing robusto e fallback para campos ausentes.
5. **Uso de fundamentos no alerta**
   - Tipo: integração
   - Validar consumo de `fundamentals_queue` e regras de decisão com métricas fundamentalistas.
6. **Top Movers endpoint/serviço**
   - Tipo: unitário + integração
   - Validar ordenação, janela temporal e tratamento de dados faltantes.

## Prioridade P2 (expansão de produto)

7. **WebSocket para atualizações em tempo real**
   - Tipo: integração
   - Validar conexão, reconexão e broadcast de eventos.
8. **Gráficos e analytics de portfólio**
   - Tipo: unitário (cálculos) + integração (API)
   - Validar séries históricas, agregações e consistência de retorno.
9. **Resiliência de integrações externas**
   - Tipo: teste de falha
   - Validar timeout, retry com backoff e degradação controlada.

---

## 4) Backlog de testes recomendado (curto prazo)

1. Criar suíte de integração para `notifier-service/src/index.ts` com mocks de RabbitMQ/DB/providers.
2. Adicionar testes de `alerts.controller.ts` e `watchlist.controller.ts` cobrindo sucesso + erros + autorização.
3. Introduzir fixtures HTML reais para `scraping-worker` e remover dependência de mock data.
4. Criar validação de schema para mensagens publicadas/consumidas.
5. Definir metas mínimas de cobertura por módulo crítico (ex.: alertas e auth).

---

## 5) Conclusão objetiva

O projeto já tem uma base funcional consistente para PoC em arquitetura, autenticação, watchlist, notícias/sentimento, portfolio e notificações. As principais lacunas para evoluir com segurança são: completar o scraping real de fundamentos, fechar o ciclo de correlação de alertas com dados mais ricos e fortalecer testes de integração/contrato no fluxo assíncrono.

---

## 6) Próxima tarefa definida (recomendada)

### Tarefa

**Implementar consumo da `fundamentals_queue` no `notifier-service` e incorporar fundamentos no gatilho de alertas.**

### Justificativa

- Está marcado como **Não entregue** no status atual.
- É uma **pendência arquitetural explícita** no ADR (uso de dados fundamentalistas no motor de alertas).
- Tem alto impacto funcional com escopo controlado (evolução natural do motor já existente).

### Escopo mínimo (MVP)

1. Consumir mensagens de `fundamentals_queue` no `notifier-service`.
2. Persistir/atualizar os dados recebidos em estrutura já existente no banco.
3. Incluir regra simples de fundamentos no cálculo de decisão de alerta (ex.: bloquear alerta quando indicador crítico estiver acima de limiar configurável).
4. Publicar logs estruturados de processamento (sucesso, descarte e erro).

### Critérios de aceite

- Mensagens válidas de fundamentos são consumidas e processadas sem interromper o consumo de notícias/preços.
- Regras de alerta passam a considerar fundamentos além de preço/sentimento.
- Em caso de payload inválido, a mensagem é rejeitada com log adequado e sem derrubar o serviço.
- Fluxo coberto por testes automatizados de integração.

### Testes obrigatórios desta tarefa

- **Teste de contrato** para payload de `fundamental_data` (campos obrigatórios e tipos).
- **Teste de integração** do consumidor da `fundamentals_queue` no `notifier-service`.
- **Teste de regra** validando impacto dos fundamentos na decisão final de alerta.
