# Observabilidade com Prometheus

## Visão Geral

O Market Watcher agora possui integração completa com Prometheus para monitoramento e observabilidade de todos os serviços.

## Endpoints de Métricas

Cada serviço expõe métricas no formato Prometheus:

- **web-app**: http://localhost:3000/metrics
- **api-handler**: http://localhost:3001/metrics
- **notifier-service**: http://localhost:3002/metrics
- **gnews-service**: http://localhost:8000/metrics
- **scraping-worker**: http://localhost:8001/metrics

## Dashboard Prometheus

Acesse o Prometheus UI em: **http://localhost:9090**

## Métricas Principais

### Web App (port 3000)

#### Métricas HTTP
- `http_requests_total` - Total de requisições HTTP (labels: method, route, status_code)
- `http_request_duration_seconds` - Duração das requisições HTTP

#### Métricas de Negócio
- `auth_attempts_total` - Tentativas de autenticação (labels: type [login/register], status [success/failure])
- `active_users_total` - Número de usuários ativos
- `watchlist_items_total` - Total de itens em watchlists
- `alerts_generated_total` - Total de alertas gerados (label: type)
- `portfolio_transactions_total` - Total de transações de portfólio (label: type [buy/sell/dividend])

### API Handler (port 3001)

- `stock_quote_requests_total` - Requisições de cotação (labels: symbol, provider [brapi/yahoo], status)
- `stock_history_requests_total` - Requisições de histórico (labels: symbol, provider, status)
- `provider_response_time_seconds` - Tempo de resposta dos provedores (label: provider)
- `provider_errors_total` - Erros dos provedores (labels: provider, error_type)

### Notifier Service (port 3002)

- `notifications_sent_total` - Notificações enviadas (labels: channel [email/sms/whatsapp], status)
- `rabbitmq_messages_consumed_total` - Mensagens consumidas do RabbitMQ (label: queue)
- `sentiment_analysis_total` - Análises de sentimento realizadas (label: sentiment)
- `alerts_trigger_time_seconds` - Tempo para disparar alertas

### GNews Service (port 8000)

- `news_articles_fetched_total` - Artigos de notícias coletados (label: status)
- `news_articles_published_total` - Artigos publicados no RabbitMQ
- `news_fetch_duration_seconds` - Duração da coleta de notícias
- `news_api_errors_total` - Erros da API GNews (label: error_type)
- `news_articles_in_db` - Número de artigos no banco de dados

### Scraping Worker (port 8001)

- `scraping_requests_total` - Requisições de scraping (label: status)
- **`dividends_found_total`** - **Total de dividendos encontrados (label: symbol)** ⭐
- `fundamental_data_scraped_total` - Dados fundamentalistas coletados (labels: symbol, status)
- `scraping_duration_seconds` - Duração do scraping por símbolo
- `scraping_errors_total` - Erros de scraping (label: error_type)
- `status_invest_requests_total` - Requisições ao StatusInvest (label: status)

## Endpoint de Estatísticas

### GET /api/stats (autenticado)

Endpoint agregado de estatísticas da aplicação disponível em:
```
http://localhost:3000/api/stats
```

**Requer autenticação**: Bearer token no header `Authorization`

**Resposta exemplo**:
```json
{
  "success": true,
  "timestamp": "2026-03-06T10:30:00.000Z",
  "stats": {
    "users": {
      "total_users": "150",
      "new_users_7d": "12",
      "new_users_30d": "45"
    },
    "watchlist": {
      "total_items": "523",
      "users_with_watchlist": "98",
      "avg_items_per_user": "5.34",
      "top_watched_stocks": [
        { "symbol": "PETR4", "watchers": "45" },
        { "symbol": "VALE3", "watchers": "38" }
      ]
    },
    "alerts": {
      "total_alerts": "1234",
      "alerts_24h": "67",
      "unread_alerts": "234",
      "users_with_alerts": "87"
    },
    "news": {
      "total_articles": "5678",
      "articles_24h": "89",
      "positive_sentiment": "2345",
      "negative_sentiment": "1234",
      "neutral_sentiment": "2099",
      "avg_sentiment_score": "0.1234"
    },
    "portfolio": {
      "total_portfolios": "95",
      "total_transactions": "456",
      "buy_transactions": "234",
      "sell_transactions": "178",
      "dividend_transactions": "44",
      "total_invested": "125000.00",
      "total_divested": "45000.00"
    },
    "dividends": {
      "total_dividend_records": "234",
      "stocks_with_dividends": "67",
      "total_dividends_value": "12345.67",
      "avg_dividend_amount": "52.78",
      "upcoming_dividends": "12",
      "dividends_last_30d": "34"
    }
  }
}
```

## Queries Úteis no Prometheus

### Dividendos encontrados por símbolo (última hora)
```promql
rate(dividends_found_total[1h])
```

### Taxa de sucesso de scraping
```promql
rate(scraping_requests_total{status="success"}[5m]) / rate(scraping_requests_total[5m])
```

### Latência média de requisições HTTP (web-app)
```promql
rate(http_request_duration_seconds_sum[5m]) / rate(http_request_duration_seconds_count[5m])
```

### Total de notificações por canal (última hora)
```promql
sum by (channel) (increase(notifications_sent_total[1h]))
```

### Artigos de notícias por sentimento
```promql
sum by (sentiment) (sentiment_analysis_total)
```

## Configuração

O arquivo `prometheus.yml` define os targets de scraping:

```yaml
scrape_configs:
  - job_name: 'web-app'
    static_configs:
      - targets: ['web-app:3000']
  
  - job_name: 'api-handler'
    static_configs:
      - targets: ['api-handler:3001']
  
  # ... outros serviços
```

## Próximos Passos

Para melhorar ainda mais a observabilidade:

1. **Grafana**: Adicionar Grafana para dashboards visuais
2. **Alertmanager**: Configurar alertas automáticos baseados em métricas
3. **Logs**: Integrar com Loki para correlação de logs e métricas
4. **Tracing**: Adicionar Jaeger/Zipkin para distributed tracing
5. **Business Metrics**: Adicionar mais métricas de negócio personalizadas

## Troubleshooting

### Métricas não aparecem no Prometheus

1. Verifique se o serviço está rodando:
   ```bash
   docker-compose ps
   ```

2. Teste o endpoint de métricas diretamente:
   ```bash
   curl http://localhost:3000/metrics
   ```

3. Verifique os logs do Prometheus:
   ```bash
   docker-compose logs prometheus
   ```

### Reconstruir com métricas

Se você atualizou o código, reconstrua os containers:

```bash
docker-compose build --no-cache
docker-compose up -d
```
