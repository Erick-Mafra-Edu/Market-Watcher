# Service Architecture & I/O Specifications

## Overview

Market Watcher is built on a microservices architecture with 7 distinct services orchestrated via Docker Compose. This document details the input/output specifications, data contracts, and interaction patterns for each service.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     External Data Sources                            │
├─────────────────────────────────────────────────────────────────────┤
│  GNews API  │  Yahoo Finance API  │  StatusInvest Website           │
└──────┬──────┴──────────┬──────────┴──────────┬──────────────────────┘
       │                 │                     │
       ▼                 ▼                     ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ gnews-service│  │ api-handler  │  │scraping-     │
│   (Python)   │  │  (Node.js)   │  │worker (Py)   │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                  │
       │    ┌────────────┴────────┐         │
       │    │   PostgreSQL DB     │         │
       │    └────────────┬────────┘         │
       │                 │                  │
       └─────────────┬───┴──────┬───────────┘
                     ▼          ▼
              ┌──────────────────────┐
              │      RabbitMQ        │
              │  (Message Broker)    │
              └──────────┬───────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │  notifier-   │
                  │  service     │
                  └──────┬───────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
  ┌─────────┐     ┌─────────┐     ┌─────────┐
  │  SMTP   │     │ Twilio  │     │WhatsApp │
  └─────────┘     └─────────┘     └─────────┘
        │                │                │
        └────────────────┼────────────────┘
                         ▼
                    ┌─────────┐
                    │  Users  │
                    └────┬────┘
                         │
                         ▼
                  ┌──────────────┐
                  │   web-app    │
                  │  (Node.js)   │
                  └──────────────┘
```

## Service Specifications

### 1. GNews Service

**Technology:** Python 3.11  
**Primary Library:** `ranahaani/GNews`  
**Purpose:** Fetch market news from GNews API and publish to message queue

#### Input Sources
- **External API:** GNews API (https://gnews.io/)
- **Environment Variables:**
  ```env
  GNEWS_API_KEY=<api_key>
  CHECK_INTERVAL=300  # seconds
  RABBITMQ_HOST=rabbitmq
  RABBITMQ_USER=admin
  RABBITMQ_PASS=<password>
  ```

#### Processing Logic
- Polls GNews API every `CHECK_INTERVAL` seconds
- Monitors predefined market topics:
  - stock market, nasdaq, dow jones, S&P 500
  - cryptocurrency, bitcoin, ethereum
  - federal reserve, interest rates, inflation
  - market crash, market rally

#### Output Format
**RabbitMQ Exchange:** `market_news` (fanout)  
**Queue:** `news_queue`  
**Message Format (JSON):**
```json
{
  "title": "string",
  "description": "string",
  "url": "string",
  "source": "string",
  "published_at": "ISO8601 timestamp",
  "topic": "string",
  "fetched_at": "ISO8601 timestamp"
}
```

#### Dependencies
- RabbitMQ (message broker)
- GNews API (external)

#### Health Monitoring
- Logs successful API calls
- Retries RabbitMQ connection up to 5 times
- Maintains cache of processed URLs to avoid duplicates

---

### 2. API Handler

**Technology:** Node.js + TypeScript  
**Primary Library:** `yahoo-finance2`  
**Purpose:** Fetch stock data from Yahoo Finance and provide REST API

#### Input Sources
1. **External API:** Yahoo Finance
2. **Database:** PostgreSQL (reads watchlist)
3. **HTTP Requests:** REST API endpoints

#### HTTP API Endpoints

##### GET `/health`
**Response:**
```json
{
  "status": "ok",
  "service": "api-handler"
}
```

##### GET `/api/stock/:symbol`
**Request:**
- `symbol` (path parameter): Stock symbol (e.g., "AAPL")

**Response:**
```json
{
  "symbol": "string",
  "price": number,
  "changePercent": number,
  "volume": number,
  "marketCap": number,
  "name": "string"
}
```

##### GET `/api/stock/:symbol/history`
**Request:**
- `symbol` (path parameter): Stock symbol
- `period1` (query, optional): Start date (YYYY-MM-DD)
- `period2` (query, optional): End date (YYYY-MM-DD)

**Response:** Array of historical price data
```json
[
  {
    "date": "ISO8601",
    "open": number,
    "high": number,
    "low": number,
    "close": number,
    "volume": number
  }
]
```

#### Background Processing
**Frequency:** Every `CHECK_INTERVAL` seconds (default: 300)

**Database Read:**
```sql
SELECT DISTINCT s.symbol 
FROM stocks s 
INNER JOIN user_watchlist uw ON s.id = uw.stock_id
```

**Database Write:**
```sql
-- Insert/update stock
INSERT INTO stocks (symbol, name) 
VALUES ($1, $2) 
ON CONFLICT (symbol) DO UPDATE 
SET updated_at = CURRENT_TIMESTAMP

-- Insert price data
INSERT INTO stock_prices 
  (stock_id, price, change_percent, volume, market_cap) 
VALUES ($1, $2, $3, $4, $5)
```

#### Output Format
**RabbitMQ Exchange:** `stock_prices` (fanout)  
**Queue:** `price_updates`  
**Message Format (JSON):**
```json
{
  "symbol": "string",
  "price": number,
  "changePercent": number,
  "volume": number,
  "marketCap": number,
  "timestamp": "ISO8601"
}
```

#### Environment Variables
```env
NODE_ENV=production
RABBITMQ_HOST=rabbitmq
RABBITMQ_USER=admin
RABBITMQ_PASS=<password>
DATABASE_HOST=database
DATABASE_PORT=5432
DATABASE_NAME=market_watcher
DATABASE_USER=postgres
DATABASE_PASSWORD=<password>
CHECK_INTERVAL=300  # seconds
API_REQUEST_DELAY=1000  # milliseconds between API calls
```

---

### 3. Scraping Worker

**Technology:** Python 3.11  
**Libraries:** BeautifulSoup4, requests  
**Purpose:** Scrape fundamental data from StatusInvest

#### Input Sources
- **Web Scraping:** https://statusinvest.com.br/acoes/{symbol}
- **Target Stocks:** Brazilian stocks (PETR4, VALE3, ITUB4, BBDC4, ABEV3, B3SA3, WEGE3, RENT3, MGLU3, SUZB3)

#### Processing Logic
- Scrapes each stock every `CHECK_INTERVAL` seconds
- Adds 3-second delay between requests (rate limiting)
- **Note:** Currently returns mock data; production requires HTML parsing implementation

#### Output Format
**RabbitMQ Exchange:** `fundamental_data` (fanout)  
**Queue:** `fundamentals_queue`  
**Message Format (JSON):**
```json
{
  "symbol": "string",
  "dividend_yield": number,
  "p_vp": number,
  "p_l": number,
  "roe": number,
  "liquidity": number,
  "scraped_at": "ISO8601"
}
```

#### Environment Variables
```env
RABBITMQ_HOST=rabbitmq
RABBITMQ_USER=admin
RABBITMQ_PASS=<password>
CHECK_INTERVAL=300  # seconds
```

#### Implementation Status
⚠️ **Note:** Indicator extraction (`_extract_indicator`) uses mock data. Production implementation requires:
1. Inspect StatusInvest HTML structure
2. Implement CSS selectors for each indicator
3. Parse and convert values to float
4. Handle missing data gracefully

---

### 4. Notifier Service

**Technology:** Node.js + TypeScript  
**Purpose:** Correlate news/price data and send multi-channel alerts

#### Input Sources

##### RabbitMQ Consumers
1. **Queue:** `news_queue`
   - Consumes news articles
   - Stores in memory cache by topic
   - Keeps last 10 articles per topic

2. **Queue:** `price_updates`
   - Consumes stock price updates
   - Updates stock cache
   - Triggers alert condition checks

##### Database Reads
```sql
-- Get users with watchlist
SELECT DISTINCT 
  u.id, u.email, u.name, u.phone, u.whatsapp,
  s.symbol, uw.min_price_change
FROM users u
INNER JOIN user_watchlist uw ON u.id = uw.user_id
INNER JOIN stocks s ON uw.stock_id = s.id
```

#### Alert Trigger Logic

**Conditions (ALL must be met):**
1. Stock price change ≥ user's `min_price_change` threshold
2. High news activity detected (≥3 articles in relevant topics)
3. User has stock in watchlist

**Relevant News Topics:**
- stock market
- nasdaq
- dow jones
- S&P 500

#### Output Channels

##### 1. SMTP (Email)
**Format:** HTML + Text fallback  
**Provider:** Any SMTP server (Gmail, SendGrid, etc.)  
**Required Recipient Field:** `email`

**Environment Variables:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<email>
SMTP_PASS=<password>
SMTP_FROM="Market Watcher <noreply@marketwatcher.com>"
```

##### 2. Twilio (SMS)
**Format:** Plain text only  
**Provider:** Twilio API  
**Required Recipient Field:** `phone`

**Environment Variables:**
```env
TWILIO_ACCOUNT_SID=<sid>
TWILIO_AUTH_TOKEN=<token>
TWILIO_FROM_NUMBER=+1234567890
```

##### 3. WhatsApp
**Format:** Plain text with markdown  
**Provider:** utter-labs/wa-bot-api  
**Required Recipient Field:** `whatsapp`

**Environment Variables:**
```env
WHATSAPP_API_URL=http://your-api-url
WHATSAPP_API_KEY=<key>
WHATSAPP_INSTANCE_ID=<instance>
```

#### Message Content Structure

**HTML Format (Email):**
```html
<!DOCTYPE html>
<html>
  <head>
    <style>/* Inline CSS */</style>
  </head>
  <body>
    <div class="header">Market Alert: {symbol} {direction}</div>
    <div class="content">
      <p>Current Price: ${price}</p>
      <p>Change: {percent}%</p>
      <p>Volume: {volume}</p>
      <p>Market Cap: ${cap}B</p>
    </div>
  </body>
</html>
```

**Text Format (SMS/WhatsApp):**
```
Market Alert: {symbol} is {direction}

Current Price: ${price}
Change: {percent}%
Volume: {volume}
Market Cap: ${cap}B

News Activity: High market news activity detected
```

#### Database Writes
```sql
-- Save alert history
INSERT INTO alerts 
  (user_id, stock_id, alert_type, title, message, sent_at) 
VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
```

---

### 5. Web App

**Technology:** Node.js + TypeScript + Express  
**Purpose:** User-facing application for registration, watchlist, and alert management

#### HTTP API Endpoints

##### Authentication

**POST `/api/auth/register`**  
**Rate Limit:** 5 requests per 15 minutes per IP

**Request Body:**
```json
{
  "email": "string",
  "password": "string",
  "name": "string",
  "phone": "string (optional)",
  "whatsapp": "string (optional)"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": number,
    "email": "string",
    "name": "string"
  }
}
```

**POST `/api/auth/login`**  
**Rate Limit:** 5 requests per 15 minutes per IP

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "token": "JWT token",
  "user": {
    "id": number,
    "email": "string",
    "name": "string"
  }
}
```

##### Watchlist (Requires Authentication)

**GET `/api/watchlist`**  
**Rate Limit:** 100 requests per 15 minutes per IP  
**Auth:** Bearer token in Authorization header

**Response:**
```json
[
  {
    "id": number,
    "symbol": "string",
    "name": "string",
    "min_price_change": number
  }
]
```

**POST `/api/watchlist`**  
**Rate Limit:** 100 requests per 15 minutes per IP  
**Auth:** Bearer token

**Request Body:**
```json
{
  "symbol": "string",
  "min_price_change": number  // default: 5.0
}
```

**Response:**
```json
{
  "message": "Stock added to watchlist",
  "watchlistId": number
}
```

**DELETE `/api/watchlist/:symbol`**  
**Rate Limit:** 100 requests per 15 minutes per IP  
**Auth:** Bearer token

**Response:**
```json
{
  "message": "Stock removed from watchlist"
}
```

##### Alerts (Requires Authentication)

**GET `/api/alerts`**  
**Rate Limit:** 100 requests per 15 minutes per IP  
**Auth:** Bearer token

**Response:**
```json
[
  {
    "id": number,
    "symbol": "string",
    "alert_type": "string",
    "title": "string",
    "message": "string",
    "sent_at": "ISO8601",
    "read_at": "ISO8601 | null"
  }
]
```

**PATCH `/api/alerts/:alertId/read`**  
**Rate Limit:** 100 requests per 15 minutes per IP  
**Auth:** Bearer token

**Response:**
```json
{
  "message": "Alert marked as read"
}
```

##### Stock Data Proxy (Requires Authentication)

**GET `/api/stocks/:symbol`**  
**Rate Limit:** 100 requests per 15 minutes per IP  
**Auth:** Bearer token

*Proxies to API Handler service*

**GET `/api/stocks/:symbol/history`**  
**Rate Limit:** 100 requests per 15 minutes per IP  
**Auth:** Bearer token

*Proxies to API Handler service*

#### Security Features
- **JWT Authentication:** 7-day token expiration
- **Password Hashing:** Bcrypt with cost factor 10
- **Rate Limiting:** Separate limits for auth and API endpoints
- **Input Validation:** SQL injection protection via parameterized queries
- **HTML Sanitization:** For user-generated content

#### Environment Variables
```env
NODE_ENV=production
DATABASE_HOST=database
DATABASE_PORT=5432
DATABASE_NAME=market_watcher
DATABASE_USER=postgres
DATABASE_PASSWORD=<password>
RABBITMQ_HOST=rabbitmq
RABBITMQ_USER=admin
RABBITMQ_PASS=<password>
JWT_SECRET=<secure_random_string>
API_HANDLER_URL=http://api-handler:3001
```

---

### 6. Database (PostgreSQL)

**Technology:** PostgreSQL 15 Alpine  
**Purpose:** Persistent data storage

#### Schema Overview

##### Table: `users`
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  phone VARCHAR(50),
  whatsapp VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

##### Table: `stocks`
```sql
CREATE TABLE stocks (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255),
  market VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

##### Table: `user_watchlist`
```sql
CREATE TABLE user_watchlist (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  stock_id INTEGER REFERENCES stocks(id) ON DELETE CASCADE,
  min_price_change DECIMAL(10, 2) DEFAULT 5.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, stock_id)
);
```

##### Table: `news_articles`
```sql
CREATE TABLE news_articles (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT UNIQUE NOT NULL,
  source VARCHAR(255),
  published_at TIMESTAMP,
  sentiment_score DECIMAL(3, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

##### Table: `stock_news`
```sql
CREATE TABLE stock_news (
  id SERIAL PRIMARY KEY,
  stock_id INTEGER REFERENCES stocks(id) ON DELETE CASCADE,
  news_id INTEGER REFERENCES news_articles(id) ON DELETE CASCADE,
  relevance_score DECIMAL(3, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(stock_id, news_id)
);
```

##### Table: `stock_prices`
```sql
CREATE TABLE stock_prices (
  id SERIAL PRIMARY KEY,
  stock_id INTEGER REFERENCES stocks(id) ON DELETE CASCADE,
  price DECIMAL(15, 2) NOT NULL,
  change_percent DECIMAL(10, 2),
  volume BIGINT,
  market_cap BIGINT,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

##### Table: `alerts`
```sql
CREATE TABLE alerts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  stock_id INTEGER REFERENCES stocks(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP
);
```

##### Table: `status_invest_data`
```sql
CREATE TABLE status_invest_data (
  id SERIAL PRIMARY KEY,
  stock_id INTEGER REFERENCES stocks(id) ON DELETE CASCADE,
  dividend_yield DECIMAL(10, 2),
  p_vp DECIMAL(10, 2),
  p_l DECIMAL(10, 2),
  roe DECIMAL(10, 2),
  liquidity DECIMAL(10, 2),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Performance Indexes
```sql
CREATE INDEX idx_user_watchlist_user_id ON user_watchlist(user_id);
CREATE INDEX idx_stock_news_stock_id ON stock_news(stock_id);
CREATE INDEX idx_stock_news_news_id ON stock_news(news_id);
CREATE INDEX idx_stock_prices_stock_id ON stock_prices(stock_id);
CREATE INDEX idx_stock_prices_recorded_at ON stock_prices(recorded_at);
CREATE INDEX idx_alerts_user_id ON alerts(user_id);
CREATE INDEX idx_news_articles_published_at ON news_articles(published_at);
```

#### Environment Variables
```env
POSTGRES_DB=market_watcher
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<secure_password>
```

---

### 7. RabbitMQ (Message Broker)

**Technology:** RabbitMQ 3 Management Alpine  
**Purpose:** Asynchronous message passing between services

#### Exchanges

##### 1. `market_news`
- **Type:** fanout
- **Durable:** Yes
- **Publisher:** gnews-service
- **Consumers:** notifier-service

##### 2. `stock_prices`
- **Type:** fanout
- **Durable:** Yes
- **Publisher:** api-handler
- **Consumers:** notifier-service

##### 3. `fundamental_data`
- **Type:** fanout
- **Durable:** Yes
- **Publisher:** scraping-worker
- **Consumers:** None (reserved for future use)

#### Queues

##### 1. `news_queue`
- **Durable:** Yes
- **Bound to:** market_news exchange
- **Consumer:** notifier-service

##### 2. `price_updates`
- **Durable:** Yes
- **Bound to:** stock_prices exchange
- **Consumer:** notifier-service

##### 3. `fundamentals_queue`
- **Durable:** Yes
- **Bound to:** fundamental_data exchange
- **Consumer:** None (reserved for future use)

#### Management UI
- **URL:** http://localhost:15672
- **Default Credentials:** admin/admin (configured via environment)

#### Environment Variables
```env
RABBITMQ_DEFAULT_USER=admin
RABBITMQ_DEFAULT_PASS=<password>
```

---

## Data Flow Patterns

### 1. News Alert Flow
```
GNews API → gnews-service → RabbitMQ (market_news) → notifier-service
                                                              ↓
                                                       Check conditions
                                                              ↓
                                                    Send via SMTP/Twilio/WhatsApp
                                                              ↓
                                                       Database (alerts)
```

### 2. Price Alert Flow
```
Yahoo Finance → api-handler → PostgreSQL (stock_prices)
                    ↓
           RabbitMQ (stock_prices)
                    ↓
              notifier-service
                    ↓
             Check conditions
                    ↓
      Send via SMTP/Twilio/WhatsApp
                    ↓
          Database (alerts)
```

### 3. User Registration Flow
```
User → web-app (/api/auth/register) → PostgreSQL (users)
                                            ↓
                                     Return JWT token
```

### 4. Watchlist Management Flow
```
User → web-app (/api/watchlist) → PostgreSQL (user_watchlist, stocks)
                                            ↓
                                   Trigger api-handler monitoring
```

### 5. Stock Data Query Flow
```
User → web-app (/api/stocks/:symbol) → api-handler (/api/stock/:symbol)
                                             ↓
                                     Yahoo Finance API
                                             ↓
                                       Return quote data
```

---

## Service Communication Matrix

| Service | Talks To | Protocol | Purpose |
|---------|----------|----------|---------|
| gnews-service | RabbitMQ | AMQP | Publish news |
| api-handler | RabbitMQ | AMQP | Publish prices |
| api-handler | PostgreSQL | TCP/SQL | Store/query data |
| api-handler | External | HTTP | Yahoo Finance API |
| scraping-worker | RabbitMQ | AMQP | Publish fundamentals |
| scraping-worker | External | HTTP | StatusInvest scraping |
| notifier-service | RabbitMQ | AMQP | Consume news/prices |
| notifier-service | PostgreSQL | TCP/SQL | Query watchlist, save alerts |
| notifier-service | External | HTTP/SMTP | Send notifications |
| web-app | PostgreSQL | TCP/SQL | User/watchlist/alerts CRUD |
| web-app | api-handler | HTTP | Proxy stock data |
| User | web-app | HTTP | API requests |

---

## Service Dependencies

### Startup Order
1. **PostgreSQL** - Must start first (healthcheck: `pg_isready`)
2. **RabbitMQ** - Must start second (healthcheck: `rabbitmq-diagnostics ping`)
3. **gnews-service** - Depends on RabbitMQ
4. **scraping-worker** - Depends on RabbitMQ
5. **api-handler** - Depends on PostgreSQL + RabbitMQ
6. **notifier-service** - Depends on PostgreSQL + RabbitMQ
7. **web-app** - Depends on PostgreSQL + api-handler

### Runtime Dependencies
- All services can recover from temporary connection failures
- Services implement retry logic (typically 5 attempts with 5s delay)
- RabbitMQ ensures message persistence during service restarts

---

## Environment Configuration Summary

### Required for All Services
- Database credentials
- RabbitMQ credentials

### Optional Services
- **SMTP:** Required for email notifications
- **Twilio:** Optional for SMS notifications
- **WhatsApp:** Optional for WhatsApp notifications
- **GNews API:** Required for news service to fetch live data

See `.env.example` for complete configuration template.
