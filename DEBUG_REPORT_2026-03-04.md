# Relatório de Debug - 2026-03-04

## Contexto

- Ambiente: Docker Compose local (com override E2E)
- Objetivo da análise: identificar travamentos aparentes no fluxo de testes e mapear erros reais de runtime
- Serviços analisados: `web-app`, `api-handler`, `notifier-service`, `rabbitmq`, `database`, `mailhog`

---

## Status dos serviços no momento da análise

- `web-app`: **UP**
- `api-handler`: **UP**
- `notifier-service`: **UP**
- `rabbitmq`: **UP (healthy)**
- `database`: **UP (healthy)**
- `mailhog`: **UP**

Observação: em execuções anteriores, `web-app` entrou em restart loop por `JWT_SECRET` inválido em produção. Isso foi corrigido no cenário de teste com override de compose.

---

## Erros observados em logs

## 1) web-app

### Erro/Warning
- `ValidationError: The 'X-Forwarded-For' header is set but the Express 'trust proxy' setting is false`

### Impacto
- Não derruba a aplicação, mas pode afetar identificação correta de cliente no `express-rate-limit` atrás de proxy.

### Observação adicional
- Foram vistos registros de `duplicate key value violates unique constraint "users_email_key"` durante re-registro de e-mail já existente (comportamento esperado para dado duplicado).

---

## 2) api-handler (erro crítico atual)

### Erro recorrente
- `Error fetching quote for <SYMBOL>: SyntaxError: Unexpected token T in JSON at position 0`
- `Error fetching stock: SyntaxError: Unexpected token T in JSON at position 0`

### Símbolos afetados
- `AAPL`, `GOOGL`, `MSFT`, `AMZN`, `TSLA`, `BTC-USD`, `ETH-USD`

### Impacto
- Endpoint direto do serviço retorna 500:
  - `GET /api/stock/AAPL` -> `500 Internal Server Error`
  - Body: `{"error":"Unexpected token T in JSON at position 0"}`
- Proxy no `web-app` também retorna 500:
  - `GET /api/stocks/AAPL` -> `500 Internal Server Error`

### Hipótese técnica
- Resposta inesperada da fonte externa (não-JSON) sendo parseada como JSON.
- Pode envolver bloqueio/alteração de resposta upstream (Yahoo Finance) ou falha na camada de parsing da lib utilizada.

---

## 3) notifier-service

### Estado
- Sem erro crítico observado nos logs durante a janela analisada.

### Logs de boot esperados
- `Successfully connected to RabbitMQ`
- `Queue consumers set up`
- `Notifier Service started successfully`

---

## 4) rabbitmq

### Warnings observados
- Rebuild de índice de message store no boot.
- Aviso de depreciação de feature (`management_metrics_collection`).

### Impacto
- Sem impacto funcional imediato no fluxo MVP analisado.

---

## Retornos HTTP validados

## Endpoints web-app (com token válido)

- `GET /health` -> `200 OK`
- `POST /api/auth/register` -> `201 Created` (retorna token)
- `POST /api/auth/login` -> `200 OK` (retorna token)
- `POST /api/watchlist` -> `201 Created`
- `GET /api/watchlist` -> `200 OK`
- `GET /api/alerts` -> `200 OK` (lista vazia no teste)
- `GET /api/news?limit=5` -> `200 OK` (`{"success":true,"count":0,"news":[]}`)

## Endpoints de cotações

- `GET /api/stock/AAPL` (api-handler) -> `500`
- `GET /api/stocks/AAPL` (proxy web-app) -> `500`

Conclusão: fluxo de autenticação/watchlist está operacional; falha principal está concentrada na obtenção de cotações.

---

## Incidentes de execução dos testes E2E

## Incidente A - Espera infinita aparente

### Sintoma
- Script parava em: `Waiting for RabbitMQ and Web App...`

### Causa identificada
- Verificação de RabbitMQ sem autenticação (`/api/overview`), retornando 401 e mantendo loop de espera.

### Correção aplicada
- Wait autenticado para API do RabbitMQ.

## Incidente B - Conflito de containers

### Sintoma
- `Conflict. The container name "/market-watcher-db" is already in use`

### Causa
- Reuso de nomes fixos de container com stack anterior ativa.

### Correção aplicada
- Limpeza prévia de containers nomeados no script E2E antes de subir ambiente.

## Incidente C - web-app reiniciando em produção

### Sintoma
- Loop de restart com erro de `JWT_SECRET`.

### Causa
- `JWT_SECRET` padrão inseguro em `NODE_ENV=production`.

### Correção aplicada
- Override E2E para forçar `JWT_SECRET` válido.

## Incidente D - 401 no passo de watchlist no E2E

### Sintoma
- `curl: (22) ... 401`

### Causa
- Token vazio por bug de parsing JSON no script Bash/Python.

### Correção aplicada
- Ajuste no parsing de JSON para extração de token/contagem.

---

## Prioridade de correção (próximos passos)

1. **Alta**: robustecer `api-handler` contra resposta não-JSON upstream (fallback, retry controlado, erro de domínio mais explícito).
2. **Média**: ajustar `trust proxy` no `web-app` (ou revisar headers de entrada) para remover warning de rate-limit.
3. **Média**: tornar E2E totalmente determinístico para geração de alerta (reduzir dependência de timing).
4. **Baixa**: revisar warning de depreciação do RabbitMQ em janela de manutenção.

---

## Comandos úteis para repetir o diagnóstico

- Estado dos serviços:
  - `docker compose -f docker-compose.yml -f docker-compose.e2e.yml ps`

- Logs por serviço:
  - `docker logs --tail 200 market-watcher-web`
  - `docker logs --tail 240 market-watcher-api-handler`
  - `docker logs --tail 240 market-watcher-notifier`
  - `docker logs --tail 120 market-watcher-rabbitmq`

- Verificação rápida de endpoints:
  - `curl -i http://localhost:3000/health`
  - `curl -i http://localhost:3001/api/stock/AAPL`

---

## Conclusão

O servidor não está travando de forma geral. O principal erro operacional atual está concentrado no `api-handler` ao processar retorno de cotações externas, causando `500` em cadeia no proxy do `web-app`. O restante do núcleo do MVP (auth, watchlist, notifier e infraestrutura) está funcional dentro do cenário analisado.
