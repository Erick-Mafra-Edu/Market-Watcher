# CORS Configuration Guide - Market Watcher

## 📋 Visão Geral

A aplicação Market Watcher possui configuração dinâmica de CORS baseada no ambiente.

## 🔄 Comportamento por Ambiente

### Development (`NODE_ENV=development`)

```bash
CORS Origin: * (Allow all)
Credentials: false
Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
Headers: Content-Type, Authorization, X-Requested-With
```

**Ideal para:**
- 🛠️ Desenvolvimento local
- 🧪 Testes com Swagger UI, Postman, etc
- 📱 Testes cross-origin
- 🔧 Ferramentas de debugging

**Configuração:**
```env
NODE_ENV=development
```

### Production (`NODE_ENV=production`)

```bash
CORS Origin: [Específicas - veja CORS_ORIGINS]
Credentials: true
Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
Headers: Content-Type, Authorization, X-Requested-With
```

**Configuração:**
```env
NODE_ENV=production
CORS_ORIGINS=https://app.example.com,https://api.example.com,https://admin.example.com
```

---

## ⚙️ Configuração

### Desenvolvimento (Docker Compose)

O docker-compose.yml já vem configurado para desenvolvimento:

```yaml
web-app:
  environment:
    NODE_ENV: development
    CORS_ORIGINS: http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000
```

✅ Em desenvolvimento, `NODE_ENV=development` faz CORS aceitar `*` (todas as origens)

### Produção

Para produção, configure as variáveis de ambiente:

```bash
# .env
NODE_ENV=production
CORS_ORIGINS=https://marketwatcher.com,https://app.marketwatcher.com
```

Ou via Docker:

```yaml
web-app:
  environment:
    NODE_ENV: production
    CORS_ORIGINS: https://marketwatcher.com,https://app.marketwatcher.com
```

---

## 🔍 Verificando a Configuração

### 1. Verificar logs ao iniciar

```bash
docker logs market-watcher-web | grep CORS
```

**Saída esperada:**
```
✓ CORS: Allow all origins (Development mode)
```

### 2. Testar endpoint OpenAPI

```bash
curl -v http://localhost:3000/openapi.json 2>&1 | grep -i "access-control"
```

**Em Development:**
```
< access-control-allow-origin: *
< access-control-allow-methods: GET, OPTIONS
< access-control-allow-headers: Content-Type, Authorization
```

### 3. Teste via cURL com Origin header

```bash
curl -H "Origin: http://example.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS http://localhost:3000/api/auth/login -v
```

**Em Development esperado:**
```
< access-control-allow-origin: *
```

---

## 🆘 Problemas Comuns

### ❌ "Failed to fetch" no Swagger UI

**Causa:** CORS não configurado corretamente

**Solução:**
```bash
# Verificar NODE_ENV
docker exec market-watcher-web env | grep NODE_ENV

# Deve ser "development" ou "production"
```

### ❌ CORS bloqueando para frontend

**Em Desenvolvimento:**
```bash
# Já funciona com NODE_ENV=development
# Swagger UI e Postman funcionam automaticamente
```

**Em Produção:**
```bash
# Adicionar origem do frontend a CORS_ORIGINS
CORS_ORIGINS=https://seu-dominio.com,https://outro-dominio.com
```

### ❌ Token não sendo enviado

**Causa:** Credentials não ativado

**Solução:** Em produção com credenciais:
```javascript
// JavaScript
fetch('/api/protected', {
  headers: { 'Authorization': 'Bearer TOKEN' },
  credentials: 'include'  // Importante para cookies
})
```

---

## 📝 Código de Referência

### Configuração em `src/index.ts`

```typescript
const corsOptions = {
  origin: isDevelopment 
    ? '*' // Allow all origins in development
    : (process.env.CORS_ORIGINS?.split(',') || [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000'
      ]),
  credentials: !isDevelopment,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
```

### Arquivo de Configuração: `src/config/cors.config.ts`

Define todas as opções de CORS por ambiente.

---

## 🚀 Migração: Desenvolvimento → Produção

### Passo 1: Definir novo domínio

```env
NODE_ENV=production
CORS_ORIGINS=https://app-producao.exemplo.com
JWT_SECRET=seu-secret-seguro
```

### Passo 2: Reconstruir imagem Docker

```bash
docker-compose build --no-cache web-app
docker-compose up -d web-app
```

### Passo 3: Verificar configuração

```bash
docker logs market-watcher-web | grep CORS
```

Deve mostrar:
```
✓ CORS: Allowed origins: https://app-producao.exemplo.com
```

### Passo 4: Testar acesso

```bash
curl -H "Origin: https://app-producao.exemplo.com" \
     http://localhost:3000/health
```

---

## 📊 Resumo Rápido

| Aspecto | Development | Production |
|---------|-------------|-----------|
| **Origem** | `*` (Todas) | Específicas |
| **Credenciais** | Desabilitado | Habilitado |
| **Debug** | Fácil | Restrito |
| **Segurança** | Baixa | Alta |
| **NODE_ENV** | `development` | `production` |

---

## 🔐 Boas Práticas

### ✅ Fazer

- ✓ Usar `development` para testes e debug
- ✓ Especificar origens exatas em produção
- ✓ Usar HTTPS em produção
- ✓ Monitorar logs de CORS
- ✓ Testar antes de fazer deploy

### ❌ Evitar

- ✗ Usar `*` em produção
- ✗ Deixar credenciais em desenvolvimento
- ✗ Esquecer de atualizar CORS_ORIGINS ao migrare domínios
- ✗ Ignores erros de CORS

---

## 📚 Links Úteis

- [MDN - CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Express CORS Package](https://github.com/expressjs/cors)
- [CORS Tester](https://www.test-cors.org/)

---

**Última atualização:** 2026-03-05
