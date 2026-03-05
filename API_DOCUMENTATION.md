# API Documentation - Market Watcher

## Overview

A documentação completa da API do Market Watcher está disponível em **OpenAPI 3.0** e pode ser acessada através do **Swagger UI** de forma interativa.

## Acessando a Documentação

### 1. **Swagger UI (Interface Interativa)**
Acesse a documentação interativa em:
```
http://localhost:3000/api/docs
```

No Swagger UI você pode:
- ✅ Visualizar todos os endpoints
- ✅ Ver schemas e modelos de dados
- ✅ Testar endpoints diretamente
- ✅ Copiar exemplos de requisição (`curl`, `JavaScript`, etc.)
- ✅ Ver códigos de resposta esperados

### 2. **OpenAPI JSON Specification**
A especificação completa em formato JSON:
```
http://localhost:3000/openapi.json
```

Use esta URL para:
- Importar em ferramentas como Postman, Insomnia, Thunder Client
- Gerar SDKs automaticamente
- Integrar em ferramentas de CI/CD
- Documentação externa

## Estrutura da API

### Autenticação
- **Tipo**: JWT (JSON Web Token)
- **Header**: `Authorization: Bearer <token>`
- **Endpoints públicos**: `/health`, `/api/auth/register`, `/api/auth/login`

### Tags de Endpoints

#### 🔐 Authentication
- `POST /api/auth/register` - Registrar novo usuário
- `POST /api/auth/login` - Autenticar usuário

#### 👁️ Watchlist
- `GET /api/watchlist` - Listar ações acompanhadas
- `POST /api/watchlist` - Adicionar ação
- `DELETE /api/watchlist/{symbol}` - Remover ação

#### ⚠️ Alerts
- `GET /api/alerts` - Listar alertas
- `PATCH /api/alerts/{alertId}/read` - Marcar como lido

#### 📰 News
- `GET /api/news` - Listar notícias
- `GET /api/news/stats` - Estatísticas de sentimento
- `GET /api/news/stock/{symbol}` - Notícias de uma ação

#### 🏷️ Assets
- `GET /api/assets` - Listar ativos
- `POST /api/assets` - Adicionar ativo
- `DELETE /api/assets/{symbol}` - Remover ativo

#### 💼 Portfolio
- `GET /api/portfolio` - Resumo do portfólio
- `POST /api/portfolio/transaction` - Adicionar transação
- `PUT /api/portfolio/transaction/{id}` - Atualizar transação
- `DELETE /api/portfolio/transaction/{id}` - Deletar transação
- `GET /api/portfolio/transactions` - Listar transações
- `DELETE /api/portfolio/position/{symbol}` - Deletar posição
- `GET /api/portfolio/performance` - Performance
- `GET /api/portfolio/dividends` - Dividendos

#### 📈 Stocks
- `GET /api/stocks/{symbol}` - Dados da ação
- `GET /api/stocks/{symbol}/history` - Histórico de preços

## Exemplos de Uso

### 1. Registrar Novo Usuário

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }'
```

**Response (201):**
```json
{
  "id": "user-123",
  "email": "user@example.com",
  "message": "User registered successfully"
}
```

### 2. Fazer Login

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }'
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-123",
    "email": "user@example.com"
  }
}
```

### 3. Adicionar Ação à Watchlist

**Request:**
```bash
curl -X POST http://localhost:3000/api/watchlist \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "symbol": "PETR4"
  }'
```

**Response (201):**
```json
{
  "id": "watchlist-456",
  "user_id": "user-123",
  "symbol": "PETR4",
  "added_at": "2026-03-05T10:30:00Z"
}
```

### 4. Adicionar Transação ao Portfólio

**Request:**
```bash
curl -X POST http://localhost:3000/api/portfolio/transaction \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "symbol": "PETR4",
    "type": "buy",
    "quantity": 100,
    "price": 28.50,
    "transaction_date": "2026-03-05T10:00:00Z"
  }'
```

**Response (201):**
```json
{
  "id": "txn-789",
  "portfolio_id": "portfolio-123",
  "symbol": "PETR4",
  "type": "buy",
  "quantity": 100,
  "price": 28.50,
  "total_amount": 2850.00,
  "transaction_date": "2026-03-05T10:00:00Z"
}
```

## Ferramentas Recomendadas

### Para Testar Endpoints

1. **Swagger UI** (Built-in)
   - Interface web interativa
   - Teste direto dos endpoints
   - URL: `http://localhost:3000/api/docs`

2. **Postman**
   - Importe a URL: `http://localhost:3000/openapi.json`
   - Crie variáveis de ambiente para o token

3. **Insomnia**
   - Suporta OpenAPI natively
   - Similar ao Postman

4. **Thunder Client** (VS Code Extension)
   - Importar spec OpenAPI
   - Lightweight

### Para Gerar Clientes

Use ferramentas como `openapi-generator` ou `swagger-codegen`:

```bash
# Gerar cliente JavaScript/TypeScript
npx openapi-generator-cli-gen generate \
  -i http://localhost:3000/openapi.json \
  -g typescript-axios \
  -o ./generated-client
```

## Rate Limiting

A API implementa rate limiting para proteção:

- **Endpoints de Autenticação**: 5 requisições por 15 minutos por IP
- **Endpoints de API**: 100 requisições por 15 minutos por IP

Quando o limite é excedido, você receberá:
```json
{
  "error": "Too many requests, please try again later",
  "statusCode": 429
}
```

## Segurança

- ✅ Todos os endpoints protegidos requerem JWT
- ✅ Senhas são hasheadas com bcrypt
- ✅ Rate limiting ativado
- ✅ CORS configurado
- ✅ Validação de entrada em todos os endpoints

## Códigos de Status HTTP

| Código | Descrição |
|--------|-----------|
| 200 | OK - Requisição bem-sucedida |
| 201 | Created - Recurso criado |
| 204 | No Content - Sucesso sem conteúdo |
| 400 | Bad Request - Entrada inválida |
| 401 | Unauthorized - Token inválido/ausente |
| 404 | Not Found - Recurso não encontrado |
| 429 | Too Many Requests - Rate limit |
| 500 | Internal Server Error |

## Schemas Principais

### Stock
```json
{
  "symbol": "PETR4",
  "name": "Petrobras",
  "price": 28.50,
  "change": 0.50,
  "changePercent": 1.79,
  "high52Week": 35.00,
  "low52Week": 15.00,
  "marketCap": "250B",
  "volume": 50000000,
  "lastUpdate": "2026-03-05T16:30:00Z"
}
```

### Transaction
```json
{
  "id": "txn-789",
  "symbol": "PETR4",
  "type": "buy",
  "quantity": 100,
  "price": 28.50,
  "total_amount": 2850.00,
  "transaction_date": "2026-03-05T10:00:00Z"
}
```

## Suporte

Para problemas:
1. Verifique o [OpenAPI Spec](http://localhost:3000/openapi.json)
2. Teste via [Swagger UI](http://localhost:3000/api/docs)
3. Consulte os logs da aplicação

---

**Versão API**: 1.0.0  
**Última atualização**: 2026-03-05
