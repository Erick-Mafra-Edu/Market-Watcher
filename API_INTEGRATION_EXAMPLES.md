# Market Watcher API - Exemplos de Integração

Este arquivo contém exemplos de como integrar e consumir a API do Market Watcher.

## 📋 Índice

1. [cURL](#curl)
2. [JavaScript/TypeScript](#javascripttypescript)
3. [Python](#python)
4. [Java](#java)
5. [C#/.NET](#cnet)

---

## cURL

### Registrar Usuário

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "trader@example.com",
    "password": "SecurePass123!"
  }'
```

### Login

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "trader@example.com",
    "password": "SecurePass123!"
  }' | jq -r '.token')

echo "Token: $TOKEN"
```

### Adicionar à Watchlist

```bash
curl -X POST http://localhost:3000/api/watchlist \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"symbol": "PETR4"}'
```

### Listar Watchlist

```bash
curl -X GET http://localhost:3000/api/watchlist \
  -H "Authorization: Bearer $TOKEN"
```

### Adicionar Transação

```bash
curl -X POST http://localhost:3000/api/portfolio/transaction \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "symbol": "VALE3",
    "type": "buy",
    "quantity": 50,
    "price": 65.25,
    "transaction_date": "2026-03-05T10:00:00Z"
  }'
```

### Obter Dados de uma Ação

```bash
curl -X GET "http://localhost:3000/api/stocks/PETR4" \
  -H "Authorization: Bearer $TOKEN"
```

### Histórico de Preços

```bash
curl -X GET "http://localhost:3000/api/stocks/PETR4/history" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "period1": "2026-01-01T00:00:00Z",
    "period2": "2026-03-05T23:59:59Z"
  }'
```

---

## JavaScript/TypeScript

### Usando Fetch API (Vanilla)

```javascript
// Classe para encapsular a API
class MarketWatcherAPI {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
    this.token = null;
  }

  async register(email, password) {
    const response = await fetch(`${this.baseURL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return response.json();
  }

  async login(email, password) {
    const response = await fetch(`${this.baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    this.token = data.token;
    return data;
  }

  async getWatchlist() {
    return fetch(`${this.baseURL}/api/watchlist`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    }).then(r => r.json());
  }

  async addToWatchlist(symbol) {
    return fetch(`${this.baseURL}/api/watchlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({ symbol })
    }).then(r => r.json());
  }

  async addTransaction(symbol, type, quantity, price, transactionDate) {
    return fetch(`${this.baseURL}/api/portfolio/transaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({
        symbol,
        type,
        quantity,
        price,
        transaction_date: transactionDate
      })
    }).then(r => r.json());
  }

  async getStock(symbol) {
    return fetch(`${this.baseURL}/api/stocks/${symbol}`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    }).then(r => r.json());
  }

  async getStockHistory(symbol, period1, period2) {
    return fetch(
      `${this.baseURL}/api/stocks/${symbol}/history?period1=${period1}&period2=${period2}`,
      { headers: { 'Authorization': `Bearer ${this.token}` } }
    ).then(r => r.json());
  }

  async getPortfolio() {
    return fetch(`${this.baseURL}/api/portfolio`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    }).then(r => r.json());
  }

  async getNews() {
    return fetch(`${this.baseURL}/api/news`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    }).then(r => r.json());
  }
}

// Uso
(async () => {
  const api = new MarketWatcherAPI();

  // Registrar
  await api.register('trader@example.com', 'SecurePass123!');

  // Login
  await api.login('trader@example.com', 'SecurePass123!');

  // Adicionar à watchlist
  const watchlist = await api.addToWatchlist('PETR4');
  console.log('Added to watchlist:', watchlist);

  // Obter dados da ação
  const stock = await api.getStock('PETR4');
  console.log('Stock data:', stock);

  // Adicionar transação
  const transaction = await api.addTransaction(
    'VALE3', 'buy', 50, 65.25, new Date().toISOString()
  );
  console.log('Transaction added:', transaction);

  // Obter portfólio
  const portfolio = await api.getPortfolio();
  console.log('Portfolio:', portfolio);
})();
```

### Usando Axios

```typescript
import axios from 'axios';

class MarketWatcherClient {
  private client = axios.create({
    baseURL: 'http://localhost:3000'
  });

  private token: string | null = null;

  async register(email: string, password: string) {
    const { data } = await this.client.post('/api/auth/register', {
      email,
      password
    });
    return data;
  }

  async login(email: string, password: string) {
    const { data } = await this.client.post('/api/auth/login', {
      email,
      password
    });
    this.token = data.token;
    this.client.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
    return data;
  }

  async getWatchlist() {
    const { data } = await this.client.get('/api/watchlist');
    return data;
  }

  async addToWatchlist(symbol: string) {
    const { data } = await this.client.post('/api/watchlist', { symbol });
    return data;
  }

  async getPortfolio() {
    const { data } = await this.client.get('/api/portfolio');
    return data;
  }

  async addTransaction(
    symbol: string,
    type: 'buy' | 'sell' | 'dividend',
    quantity: number,
    price: number,
    transactionDate: string
  ) {
    const { data } = await this.client.post('/api/portfolio/transaction', {
      symbol,
      type,
      quantity,
      price,
      transaction_date: transactionDate
    });
    return data;
  }

  async getStock(symbol: string) {
    const { data } = await this.client.get(`/api/stocks/${symbol}`);
    return data;
  }

  async getNews() {
    const { data } = await this.client.get('/api/news');
    return data;
  }
}

// Uso
(async () => {
  const client = new MarketWatcherClient();

  await client.register('trader@example.com', 'SecurePass123!');
  await client.login('trader@example.com', 'SecurePass123!');

  const watchlist = await client.getWatchlist();
  console.log(watchlist);

  await client.addToWatchlist('PETR4');
  const portfolio = await client.getPortfolio();
  console.log(portfolio);
})();
```

---

## Python

### Usando Requests

```python
import requests
from datetime import datetime
import json

class MarketWatcherAPI:
    def __init__(self, base_url='http://localhost:3000'):
        self.base_url = base_url
        self.token = None
        self.session = requests.Session()

    def register(self, email, password):
        """Registrar novo usuário"""
        response = self.session.post(
            f'{self.base_url}/api/auth/register',
            json={'email': email, 'password': password}
        )
        return response.json()

    def login(self, email, password):
        """Autenticar usuário"""
        response = self.session.post(
            f'{self.base_url}/api/auth/login',
            json={'email': email, 'password': password}
        )
        data = response.json()
        self.token = data['token']
        self.session.headers.update({'Authorization': f'Bearer {self.token}'})
        return data

    def get_watchlist(self):
        """Obter watchlist"""
        response = self.session.get(f'{self.base_url}/api/watchlist')
        return response.json()

    def add_to_watchlist(self, symbol):
        """Adicionar à watchlist"""
        response = self.session.post(
            f'{self.base_url}/api/watchlist',
            json={'symbol': symbol}
        )
        return response.json()

    def get_portfolio(self):
        """Obter portfólio"""
        response = self.session.get(f'{self.base_url}/api/portfolio')
        return response.json()

    def add_transaction(self, symbol, tx_type, quantity, price, tx_date=None):
        """Adicionar transação"""
        if tx_date is None:
            tx_date = datetime.now().isoformat() + 'Z'
        
        response = self.session.post(
            f'{self.base_url}/api/portfolio/transaction',
            json={
                'symbol': symbol,
                'type': tx_type,
                'quantity': quantity,
                'price': price,
                'transaction_date': tx_date
            }
        )
        return response.json()

    def get_stock(self, symbol):
        """Obter dados de ação"""
        response = self.session.get(f'{self.base_url}/api/stocks/{symbol}')
        return response.json()

    def get_news(self, limit=50):
        """Obter notícias"""
        response = self.session.get(
            f'{self.base_url}/api/news',
            params={'limit': limit}
        )
        return response.json()

# Uso
if __name__ == '__main__':
    api = MarketWatcherAPI()

    # Registrar
    api.register('trader@example.com', 'SecurePass123!')

    # Login
    api.login('trader@example.com', 'SecurePass123!')

    # Adicionar à watchlist
    result = api.add_to_watchlist('PETR4')
    print(f"Adicionado à watchlist: {json.dumps(result, indent=2)}")

    # Obter dados da ação
    stock = api.get_stock('PETR4')
    print(f"\nDados da ação:\n {json.dumps(stock, indent=2)}")

    # Adicionar transação
    transaction = api.add_transaction('VALE3', 'buy', 50, 65.25)
    print(f"\nTransação adicionada:\n {json.dumps(transaction, indent=2)}")

    # Obter portfólio
    portfolio = api.get_portfolio()
    print(f"\nPortfólio:\n {json.dumps(portfolio, indent=2)}")

    # Obter notícias
    news = api.get_news(limit=5)
    print(f"\nNotícias:\n {json.dumps(news[:2], indent=2)}")
```

---

## Java

```java
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import com.fasterxml.jackson.databind.ObjectMapper;

public class MarketWatcherAPI {
    private final String baseURL = "http://localhost:3000";
    private final HttpClient httpClient = HttpClient.newHttpClient();
    private String token;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public void register(String email, String password) throws IOException, InterruptedException {
        String body = String.format("{\"email\": \"%s\", \"password\": \"%s\"}", email, password);
        HttpRequest request = HttpRequest.newBuilder(
            URI.create(baseURL + "/api/auth/register"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println("Register: " + response.body());
    }

    public void login(String email, String password) throws IOException, InterruptedException {
        String body = String.format("{\"email\": \"%s\", \"password\": \"%s\"}", email, password);
        HttpRequest request = HttpRequest.newBuilder(
            URI.create(baseURL + "/api/auth/login"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        var loginResponse = objectMapper.readTree(response.body());
        token = loginResponse.get("token").asText();
        System.out.println("Logged in with token: " + token);
    }

    public void getWatchlist() throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(
            URI.create(baseURL + "/api/watchlist"))
            .header("Authorization", "Bearer " + token)
            .GET()
            .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println("Watchlist: " + response.body());
    }

    public void addTransaction(String symbol, String type, double quantity, double price) throws IOException, InterruptedException {
        String body = String.format(
            "{\"symbol\": \"%s\", \"type\": \"%s\", \"quantity\": %s, \"price\": %s, \"transaction_date\": \"%s\"}",
            symbol, type, quantity, price, java.time.Instant.now().toString()
        );

        HttpRequest request = HttpRequest.newBuilder(
            URI.create(baseURL + "/api/portfolio/transaction"))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer " + token)
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println("Transaction added: " + response.body());
    }

    public static void main(String[] args) throws IOException, InterruptedException {
        MarketWatcherAPI api = new MarketWatcherAPI();
        api.register("trader@example.com", "SecurePass123!");
        api.login("trader@example.com", "SecurePass123!");
        api.getWatchlist();
        api.addTransaction("PETR4", "buy", 100, 28.50);
    }
}
```

---

## C#/.NET

```csharp
using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading.Tasks;
using Newtonsoft.Json;

public class MarketWatcherAPI
{
    private readonly string _baseUrl = "http://localhost:3000";
    private readonly HttpClient _httpClient = new HttpClient();
    private string _token;

    public async Task RegisterAsync(string email, string password)
    {
        var payload = new { email, password };
        var content = new StringContent(
            JsonConvert.SerializeObject(payload),
            System.Text.Encoding.UTF8,
            "application/json"
        );

        var response = await _httpClient.PostAsync(
            $"{_baseUrl}/api/auth/register",
            content
        );

        var result = await response.Content.ReadAsStringAsync();
        Console.WriteLine($"Register: {result}");
    }

    public async Task LoginAsync(string email, string password)
    {
        var payload = new { email, password };
        var content = new StringContent(
            JsonConvert.SerializeObject(payload),
            System.Text.Encoding.UTF8,
            "application/json"
        );

        var response = await _httpClient.PostAsync(
            $"{_baseUrl}/api/auth/login",
            content
        );

        var result = await response.Content.ReadAsStringAsync();
        dynamic loginResponse = JsonConvert.DeserializeObject(result);
        _token = loginResponse["token"];

        _httpClient.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", _token);

        Console.WriteLine($"Logged in with token: {_token}");
    }

    public async Task GetWatchlistAsync()
    {
        var response = await _httpClient.GetAsync($"{_baseUrl}/api/watchlist");
        var result = await response.Content.ReadAsStringAsync();
        Console.WriteLine($"Watchlist: {result}");
    }

    public async Task AddTransactionAsync(string symbol, string type, double quantity, double price)
    {
        var payload = new
        {
            symbol,
            type,
            quantity,
            price,
            transaction_date = DateTime.UtcNow.ToString("O")
        };

        var content = new StringContent(
            JsonConvert.SerializeObject(payload),
            System.Text.Encoding.UTF8,
            "application/json"
        );

        var response = await _httpClient.PostAsync(
            $"{_baseUrl}/api/portfolio/transaction",
            content
        );

        var result = await response.Content.ReadAsStringAsync();
        Console.WriteLine($"Transaction added: {result}");
    }

    public static async Task Main(string[] args)
    {
        var api = new MarketWatcherAPI();
        await api.RegisterAsync("trader@example.com", "SecurePass123!");
        await api.LoginAsync("trader@example.com", "SecurePass123!");
        await api.GetWatchlistAsync();
        await api.AddTransactionAsync("PETR4", "buy", 100, 28.50);
    }
}
```

---

## Importar em Ferramentas Externas

### Postman

1. Abra o Postman
2. Clique em "Import"
3. Cole a URL: `http://localhost:3000/openapi.json`
4. A collection será importada automaticamente
5. Configure a variável `token` nos testes

### Insomnia

1. Crie um novo workspace
2. Clique em "Design" → "Import from URL"
3. Cole: `http://localhost:3000/openapi.json`
4. A spec será importada e validada

### Thunder Client (VS Code)

1. Instale a extensão Thunder Client
2. Clique no ícone "OpenAPI"
3. Cole: `http://localhost:3000/openapi.json`
4. Todos os endpoints estarão disponíveis

---

**Última atualização**: 2026-03-05
