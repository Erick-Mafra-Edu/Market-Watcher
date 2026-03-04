# Decisões de Arquitetura (ADR Consolidado)

## Objetivo

Registrar as principais decisões arquiteturais do projeto com base no código atual e na documentação existente, deixando explícitos os trade-offs, o que está aceito e o que ainda precisa de decisão.

## Escopo analisado

- `docker-compose.yml`
- `database/init.sql`
- `web-app/src/*`
- `api-handler/src/*`
- `notifier-service/src/*`
- `gnews-service/src/main.py`
- `scraping-worker/src/main.py`

---

## ADR-001 — Arquitetura de Microserviços com Docker Compose

- **Status:** Aceita e implementada
- **Decisão:** Separar responsabilidades em serviços independentes (`web-app`, `api-handler`, `notifier-service`, `gnews-service`, `scraping-worker`, `database`, `rabbitmq`).
- **Motivação:** Isolamento de responsabilidades, deploy local simples e evolução por serviço.
- **Trade-off:** Maior complexidade operacional (rede, observabilidade, retries e debugging distribuído).

## ADR-002 — Comunicação Assíncrona via RabbitMQ (fanout)

- **Status:** Aceita e implementada parcialmente
- **Decisão:** Publicação de eventos em exchanges fanout para desacoplamento entre produtores e consumidores.
- **Implementado:**
  - `market_news` → `news_queue`
  - `stock_prices` → `price_updates`
  - `fundamental_data` → `fundamentals_queue`
- **Observação importante:** `notifier-service` consome `news_queue` e `price_updates`, mas **não** consome `fundamentals_queue` atualmente.

## ADR-003 — Persistência Relacional Centralizada em PostgreSQL

- **Status:** Aceita e implementada
- **Decisão:** Uso de PostgreSQL como fonte principal de verdade para usuários, watchlist, preços, notícias, alertas e portfólio.
- **Motivação:** Integridade referencial, queries relacionais e consistência transacional.
- **Trade-off:** Evolução de schema exige migrações cuidadosas e gestão de compatibilidade.

## ADR-004 — Stack Poliglota (Node.js/TypeScript + Python)

- **Status:** Aceita e implementada
- **Decisão:**
  - Node.js/TypeScript para APIs e lógica de integração (`web-app`, `api-handler`, `notifier-service`).
  - Python para coleta/scraping (`gnews-service`, `scraping-worker`).
- **Motivação:** Melhor fit por domínio (APIs/integração vs scraping).
- **Trade-off:** Duas toolchains, dois ecossistemas de dependências e padrões de observabilidade distintos.

## ADR-005 — Provedores de Mensageria com Abstração e Fallback

- **Status:** Aceita e implementada
- **Decisão:** Padronizar envio via `BaseMessagingProvider` + `MessagingManager` com fallback entre canais.
- **Canais:** SMTP, Twilio, WhatsApp.
- **Motivação:** Extensibilidade de canais e redução de acoplamento com provedores.

## ADR-006 — Segurança Baseada em JWT + bcrypt + Rate Limit

- **Status:** Aceita e implementada
- **Decisão:**
  - JWT para autenticação no `web-app`.
  - `bcrypt` para hash de senha.
  - `express-rate-limit` para endpoints de autenticação e APIs.
- **Trade-off:** Não há refresh token/rotação de token implementados no estado atual.

## ADR-007 — Análise de Sentimento Léxica Local

- **Status:** Aceita e implementada
- **Decisão:** `SentimentAnalyzer` baseado em dicionário (palavras positivas/negativas, modificadores e negação).
- **Motivação:** Simplicidade, baixo custo e previsibilidade para PoC.
- **Trade-off:** Menor precisão sem contexto semântico profundo.

## ADR-008 — Proxy de Mercado no `web-app` para `api-handler`

- **Status:** Aceita e implementada
- **Decisão:** `web-app` expõe endpoints de ações e encaminha chamadas para `api-handler`.
- **Motivação:** Centralizar autenticação e simplificar consumo pelo front.
- **Trade-off:** Introduz salto adicional de rede e dependência de disponibilidade entre serviços.

## ADR-013 — Estratégia de Provedor para Dados Financeiros (MVP + Evolução)

- **Status:** Aceita e implementada parcialmente
- **Data:** 2026-03-04

### Problema

Definir uma estratégia de obtenção de cotações e histórico que seja viável no MVP (baixo custo e rapidez) e, ao mesmo tempo, sustentável para uso comercial (estabilidade, previsibilidade e menor risco de bloqueio/rate limiting).

### Alternativas consideradas

1. **Bibliotecas não oficiais (scraping indireto do Yahoo Finance)**
   - Python: `yfinance`
   - Node.js/TypeScript: `yahoo-finance2`
   - Prós: gratuitas, rápidas de integrar, boas para prototipação.
   - Contras: risco de quebra por mudanças upstream e bloqueios por volume.

2. **Marketplace de APIs (ex.: RapidAPI com provedores Yahoo de terceiros)**
   - Prós: API Key, contrato HTTP mais estável, menor risco operacional que scraping indireto.
   - Contras: limites de plano gratuito e custo recorrente para escala.

3. **APIs profissionais especializadas**
   - Exemplos: Alpha Vantage, BRAPI, Financial Modeling Prep, Polygon.io.
   - Prós: maior confiabilidade, suporte e escopo mais claro por tipo de dado.
   - Contras: custo e possível lock-in de fornecedor.

### Decisão

Adotar **estratégia em camadas**:

- **MVP:** manter `yahoo-finance2` no `api-handler` pela velocidade de entrega.
- **Fallback operacional:** preparar integração com provedor de marketplace (RapidAPI) para contingência.
- **Evolução de produto:** avaliar migração progressiva para API profissional conforme volume/SLA (com preferência por BRAPI para foco B3 e alternativas como Alpha Vantage/FMP/Polygon conforme caso de uso).

### Motivo da escolha

- Preserva o princípio de **MVP First** (entrega funcional rápida).
- Reduz risco futuro com rota clara de contingência e migração.
- Mantém flexibilidade para mercados diferentes (B3, EUA, cripto) sem travar arquitetura agora.

### Consequências

- Curto prazo: menor custo e maior velocidade, com risco maior de instabilidade no provider atual.
- Médio prazo: necessidade de abstrair melhor o provider no `api-handler` (adapter por fonte).
- Operacional: incluir retry/backoff, circuit breaker e métricas por provedor para tomada de decisão de failover.
- Qualidade: criar testes de contrato por fonte de dados e monitorar erro por símbolo/endpoint.

---

## Decisões em Aberto / Pendências Arquiteturais

1. **Correlação notícia ↔ ativo**
   - Existe tabela `stock_news`, porém o fluxo atual não demonstra preenchimento dessa relação no backend.
2. **Uso de dados fundamentalistas no motor de alertas**
   - Queue `fundamentals_queue` está disponível, mas sem consumidor ativo no `notifier-service`.
3. **Estratégia anti-duplicidade de alertas**
   - Falta política explícita de deduplicação/cooldown por usuário+ativo+janela de tempo.
4. **Resiliência operacional**
   - Necessário definir padrão de retry/backoff/circuit breaker para integrações externas.
5. **Observabilidade de produção**
   - Logs existem, mas sem padrão unificado para métricas, tracing e alertas operacionais.

---

## Próximos ADRs recomendados

- ADR-009: Política de deduplicação e janela de reenvio de alertas.
- ADR-010: Contratos de evento versionados para RabbitMQ.
- ADR-011: Estratégia de observabilidade (logs estruturados, métricas e tracing).
- ADR-012: Política de segurança de tokens (refresh, revogação, rotação de segredo).
