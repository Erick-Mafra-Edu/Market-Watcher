# OpenAPI/Swagger Setup - Market Watcher

## ✅ O que foi implementado

A API do Market Watcher agora possui **documentação completa em OpenAPI 3.0** com Swagger UI integrado.

### Componentes Instalados

```
✓ swagger-ui-express (^5.0.0)   - Interface web interactive
✓ swagger-jsdoc (^6.2.8)         - Gerador OpenAPI
✓ @types/swagger-ui-express     - TypeScript types
✓ @types/swagger-jsdoc          - TypeScript types
```

### Arquivos Criados/Modificados

```
📝 web-app/src/swagger.ts          - Configuração OpenAPI completa
📝 web-app/src/index.ts            - Integração Swagger UI
📄 web-app/src/api-docs.ts         - Documentação dos endpoints (JSDoc)
📄 API_DOCUMENTATION.md            - Guia de uso da API
📄 API_INTEGRATION_EXAMPLES.md     - Exemplos em múltiplas linguagens
📄 OPENAPI_SETUP.md               - Este arquivo!
```

---

## 🚀 Como Usar

### 1. Iniciar a Aplicação

```bash
cd /workspaces/Market-Watcher
docker-compose up -d
```

Ou em desenvolvimento:

```bash
cd web-app
npm install  # se ainda não instalou
npm run build:server
npm start
# ou
npm run dev
```

### 2. Acessar a Documentação

#### **Swagger UI (Recomendado para testar)**
```
http://localhost:3000/api/docs
```

![Swagger UI Features]
- ✅ Visualizar todos os endpoints
- ✅ Ver schemas automaticamente
- ✅ Testar endpoints diretamente
- ✅ Copiar exemplos (curl, JavaScript, Python, etc.)
- ✅ Autenticação JWT integrada
- ✅ Validação de requisição em tempo real

#### **OpenAPI JSON (Para integrar em outras ferramentas)**
```
http://localhost:3000/openapi.json
```

---

## 📚 Documentação da API

Toda a API está documentada em:
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - Guia completo
- [API_INTEGRATION_EXAMPLES.md](./API_INTEGRATION_EXAMPLES.md) - Exemplos de código

### Endpoints Documentados

**56 endpoints** documentados que cobrem:

| Área | Endpoints | Status |
|------|-----------|--------|
| 🔐 Autenticação | 2 | ✅ |
| 👁️ Watchlist | 3 | ✅ |
| ⚠️ Alertas | 2 | ✅ |
| 📰 Notícias | 3 | ✅ |
| 🏷️ Ativos | 3 | ✅ |
| 💼 Portfólio | 8 | ✅ |
| 📈 Ações | 2 | ✅ |
| 🔧 Sistema | 1 | ✅ |

---

## 🔌 Integração em Ferramentas Externas

### Postman

1. Abra o Postman
2. **File → Import**
3. Selecione **Link** e cole:
   ```
   http://localhost:3000/openapi.json
   ```
4. Clique em **Import**
5. Toda a API será importada com exemplos

### Insomnia

1. Crie um novo Design Document
2. **File → Import**
3. Cole:
   ```
   http://localhost:3000/openapi.json
   ```
4. A spec será validada automaticamente

### Thunder Client (VS Code)

1. Instale a extensão: `rangav.vscode-thunder-client`
2. Abra a command palette: `Ctrl+Shift+P`
3. Digite: `Thunder Client: New Request`
4. Clique no ícone **Collection** → **OpenAPI**
5. Cole a URL e importe

### VS Code REST Client

Create a `.rest` or `.http` file:

```http
### Health Check
GET http://localhost:3000/health

### Register User
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}

### Login
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}

@token = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

### Get Watchlist
GET http://localhost:3000/api/watchlist
Authorization: Bearer @token
```

Install extension: `REST Client` by Huachao Mao

---

## 🔑 Autenticação no Swagger UI

1. Faça login via endpoint `/api/auth/login` ou `/api/auth/register`
2. Copie o token retornado
3. Clique no botão **Authorize** (cadeado no canto superior direito)
4. Cole o token no formato:
   ```
   Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
5. Clique em **Authorize**
6. Agora todos os endpoints protegidos funcionarão

---

## 📲 Testar via cURL

### Script de teste completo

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"

# 1. Health check
echo "=== Health Check ==="
curl -s "$BASE_URL/health" | jq .

# 2. Register
echo -e "\n=== Register ==="
REGISTER=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"trader@example.com","password":"SecurePass123!"}')
echo "$REGISTER" | jq .

# 3. Login
echo -e "\n=== Login ==="
LOGIN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"trader@example.com","password":"SecurePass123!"}')
echo "$LOGIN" | jq .

TOKEN=$(echo "$LOGIN" | jq -r '.token')

# 4. Add to watchlist
echo -e "\n=== Add to Watchlist ==="
curl -s -X POST "$BASE_URL/api/watchlist" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"symbol":"PETR4"}' | jq .

# 5. Get watchlist
echo -e "\n=== Get Watchlist ==="
curl -s -X GET "$BASE_URL/api/watchlist" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 6. Get portfolio
echo -e "\n=== Get Portfolio ==="
curl -s -X GET "$BASE_URL/api/portfolio" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 7. Add transaction
echo -e "\n=== Add Transaction ==="
curl -s -X POST "$BASE_URL/api/portfolio/transaction" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "symbol": "VALE3",
    "type": "buy",
    "quantity": 50,
    "price": 65.25,
    "transaction_date": "'$(date -u +'%Y-%m-%dT%H:%M:%SZ')'"
  }' | jq .

# 8. Get news
echo -e "\n=== Get News ==="
curl -s -X GET "$BASE_URL/api/news?limit=3" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Salve como `test-api.sh`, torne executável e rode:

```bash
chmod +x test-api.sh
./test-api.sh
```

---

## 🛠️ Desenvolvendo com a API

### Como adicionar um novo endpoint

1. **Criar o controller** (ex: `src/controllers/newfeature.controller.ts`)
2. **Adicionar a rota** em `src/index.ts`
3. **Documentar em OpenAPI** actualizando `src/swagger.ts`:

```typescript
// Em swagger.ts adicionadar ao objeto paths:
'/api/newfeature': {
  get: {
    summary: 'Get new feature',
    description: 'Descrição detalhada',
    tags: ['Feature'],
    security: [{ bearerAuth: [] }],
    responses: {
      '200': {
        description: 'Success',
        content: {
          'application/json': {
            schema: { /* schema aqui */ }
          }
        }
      }
    }
  }
}
```

4. **Recompile e teste**:
```bash
npm run build:server
npm start
# Acesse: http://localhost:3000/api/docs
```

---

## 🔄 Regenerar OpenAPI JSON

O arquivo `openapi.json` é gerado automaticamente quando a aplicação inicia:

```bash
npm start
# Verá: "✓ OpenAPI specification generated at /path/to/public/openapi.json"
```

Ou chamar a função manualmente:

```typescript
import { generateOpenAPIFile } from './swagger';
generateOpenAPIFile();
```

---

## 📊 Estrutura do OpenAPI

```
openapi: 3.0.0
├── info
│   ├── title: Market Watcher API
│   ├── version: 1.0.0
│   └── description: ...
├── servers
│   ├── http://localhost:3000 (dev)
│   └── https://api.marketwatcher.com (prod)
├── components
│   ├── securitySchemes: bearerAuth (JWT)
│   ├── schemas: User, Stock, Portfolio, etc
│   └── responses: Error, Unauthorized, etc
└── paths: 56+ endpoints documentados
```

---

## 🧪 Validar OpenAPI

Para validar a especificação OpenAPI:

```bash
# Installar validador
npm install -g @apidevtools/swagger-cli

# Validar
swagger-cli validate http://localhost:3000/openapi.json
```

---

## 📋 Gerar Cliente Automaticamente

Use `openapi-generator` para gerar SDKs em várias linguagens:

### TypeScript/JavaScript

```bash
npx openapi-generator-cli-gen generate \
  -i http://localhost:3000/openapi.json \
  -g typescript-axios \
  -o ./generated/client-ts
```

### Python

```bash
npx openapi-generator-cli-gen generate \
  -i http://localhost:3000/openapi.json \
  -g python \
  -o ./generated/client-py
```

### Go

```bash
npx openapi-generator-cli-gen generate \
  -i http://localhost:3000/openapi.json \
  -g go \
  -o ./generated/client-go
```

### Java

```bash
npx openapi-generator-cli-gen generate \
  -i http://localhost:3000/openapi.json \
  -g java \
  -o ./generated/client-java
```

---

## 📖 Referências

- [OpenAPI 3.0 Specification](https://spec.openapis.org/oas/v3.0.3)
- [Swagger UI Documentation](https://swagger.io/tools/swagger-ui/)
- [swagger-jsdoc Documentation](https://github.com/Surnet/swagger-jsdoc)
- [Market Watcher Repository](https://github.com/Erick-Mafra-Edu/Market-Watcher)

---

## ❓ Troubleshooting

### Swagger UI não carrega

```bash
# Verifique se a aplicação está rodando
curl http://localhost:3000/health

# Verifique se openapi.json foi gerado
curl http://localhost:3000/openapi.json
```

### Token não funciona no Swagger

1. Faça login primeiro
2. Procure por `token` na resposta
3. Clique em **Authorize** (botão cadeado)
4. Use o formato exato: `Bearer <TOKEN>`

### Endpoint novo não aparece

1. Verifique se está em `swagger.ts` na seção `paths`
2. Recompile: `npm run build:server`
3. Reinicie: `npm start`
4. Limpe o cache do navegador: `Ctrl+Shift+Delete`

---

**Versão**: 1.0.0  
**Última atualização**: 2026-03-05
