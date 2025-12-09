# Technology Stack Documentation

## Overview

Market Watcher is built using a modern, production-ready technology stack optimized for scalability, maintainability, and developer productivity. This document explains the rationale behind each technology choice and provides alternatives for different use cases.

---

## Stack Summary

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Containerization** | Docker + Docker Compose | 20.10+ / 2.0+ | Service orchestration |
| **Backend Services** | Node.js + TypeScript | 18 LTS | API Handler, Notifier, Web App |
| **Workers** | Python | 3.11 | GNews Service, Scraping Worker |
| **Database** | PostgreSQL | 15 Alpine | Data persistence |
| **Message Broker** | RabbitMQ | 3 Management | Async communication |
| **News API** | GNews (ranahaani/GNews) | Latest | Market news aggregation |
| **Stock API** | Yahoo Finance 2 | Latest | Real-time stock data |
| **Notifications** | SMTP, Twilio, WhatsApp | - | Multi-channel alerts |

---

## Infrastructure Layer

### Docker & Docker Compose

**Chosen Technology:** Docker 20.10+, Docker Compose 2.0+

**Why Docker?**
- ✅ **Consistency:** "Works on my machine" → "Works everywhere"
- ✅ **Isolation:** Each service has its own environment
- ✅ **Portability:** Deploy anywhere (local, cloud, on-premise)
- ✅ **Scalability:** Easy horizontal scaling with `docker compose scale`
- ✅ **Development Speed:** No manual dependency installation

**Why Docker Compose?**
- ✅ **Multi-container orchestration:** Define all services in one file
- ✅ **Service discovery:** Containers communicate by service name
- ✅ **Volume management:** Persistent data handling
- ✅ **Network isolation:** Security through container networks
- ✅ **Health checks:** Automated service dependency management

**Alternatives Considered:**
- **Kubernetes:** Too complex for this scale; overkill for PoC
- **Docker Swarm:** Less ecosystem support than Compose
- **VM-based deployment:** Higher resource usage, slower startup

**Production Recommendation:**
- **Small scale (1-10 users):** Docker Compose ✅
- **Medium scale (10-100 users):** Docker Swarm or AWS ECS
- **Large scale (100+ users):** Kubernetes

---

## Backend Services

### Node.js + TypeScript

**Chosen Technology:** Node.js 18 LTS + TypeScript 5.x

**Services Using This Stack:**
- api-handler (Yahoo Finance integration)
- notifier-service (Multi-channel messaging)
- web-app (REST API + Authentication)

**Why Node.js?**
- ✅ **Non-blocking I/O:** Perfect for API calls and I/O operations
- ✅ **Fast development:** Large ecosystem, quick prototyping
- ✅ **Single language:** JavaScript/TypeScript across frontend/backend
- ✅ **Package ecosystem:** npm has libraries for everything
- ✅ **Real-time capabilities:** Native support for WebSockets (future feature)

**Why TypeScript?**
- ✅ **Type safety:** Catch errors at compile-time
- ✅ **Better IDE support:** Autocomplete, refactoring
- ✅ **Maintainability:** Self-documenting code
- ✅ **Scalability:** Easier to refactor as project grows
- ✅ **Team productivity:** Reduces bugs in production

**Key Libraries:**

#### Express.js (Web Framework)
```typescript
import express from 'express';
const app = express();
```
- **Why?** Most popular Node.js framework, well-documented
- **Alternatives:** Fastify (faster), Koa (modern), NestJS (enterprise)

#### yahoo-finance2 (Stock Data)
```typescript
import yahooFinance from 'yahoo-finance2';
const quote = await yahooFinance.quote('AAPL');
```
- **Why?** Free, reliable, no API key required
- **Alternatives:** Alpha Vantage (requires key), IEX Cloud (paid), Finnhub (freemium)

#### pg (PostgreSQL Client)
```typescript
import { Pool } from 'pg';
const pool = new Pool({ ... });
```
- **Why?** Native driver, connection pooling, parameterized queries
- **Alternatives:** TypeORM (ORM), Prisma (modern ORM), Knex (query builder)

#### amqplib (RabbitMQ Client)
```typescript
import amqp from 'amqplib';
const connection = await amqp.connect(url);
```
- **Why?** Official RabbitMQ client, robust
- **Alternatives:** rabbitmq-client (simpler), bull (Redis-based queue)

#### express-rate-limit (Rate Limiting)
```typescript
import rateLimit from 'express-rate-limit';
const limiter = rateLimit({ ... });
```
- **Why?** Prevents abuse, DDoS protection
- **Alternatives:** express-slow-down, rate-limiter-flexible

**Alternatives to Node.js:**
- **Python + FastAPI:** Great for data science, but slower I/O
- **Go:** Faster, but smaller ecosystem and harder learning curve
- **Java + Spring Boot:** Enterprise-ready, but verbose and heavier
- **.NET Core:** Excellent performance, but Windows-centric ecosystem

---

## Worker Services

### Python

**Chosen Technology:** Python 3.11

**Services Using This Stack:**
- gnews-service (News aggregation)
- scraping-worker (StatusInvest scraping)

**Why Python for Workers?**
- ✅ **Data processing:** Best ecosystem for scraping and data manipulation
- ✅ **Libraries:** BeautifulSoup, requests, pandas, etc.
- ✅ **GNews library:** `ranahaani/GNews` is Python-native
- ✅ **Rapid development:** Quick prototyping for scrapers
- ✅ **AI/ML ready:** Future sentiment analysis, predictions

**Key Libraries:**

#### gnews (News Aggregation)
```python
from gnews import GNews
gnews = GNews()
articles = gnews.get_news('stock market')
```
- **Why?** Simple API, Google News aggregation
- **Alternatives:** NewsAPI (freemium), MediaStack (paid), custom RSS feeds

#### BeautifulSoup4 (Web Scraping)
```python
from bs4 import BeautifulSoup
soup = BeautifulSoup(html, 'html.parser')
```
- **Why?** Easy HTML parsing, robust
- **Alternatives:** Scrapy (full framework), lxml (faster), Selenium (JS-heavy sites)

#### requests (HTTP Client)
```python
import requests
response = requests.get(url)
```
- **Why?** Simple, reliable, most popular
- **Alternatives:** httpx (async), aiohttp (async), urllib3 (low-level)

#### pika (RabbitMQ Client)
```python
import pika
connection = pika.BlockingConnection(parameters)
```
- **Why?** Official Python RabbitMQ client
- **Alternatives:** kombu (Celery backend), py-amqp

**Alternatives to Python:**
- **Node.js:** Could use cheerio for scraping, but Python is better for data
- **Go:** Faster, but less mature scraping libraries
- **Ruby:** Good for scraping, but smaller community

---

## Database

### PostgreSQL

**Chosen Technology:** PostgreSQL 15 Alpine

**Why PostgreSQL?**
- ✅ **ACID compliance:** Data integrity guaranteed
- ✅ **Relational model:** Perfect for user-stock-alert relationships
- ✅ **JSON support:** Can store unstructured data if needed
- ✅ **Full-text search:** Future news search feature
- ✅ **Scalability:** Handles millions of rows efficiently
- ✅ **Open source:** No licensing costs

**Schema Design Highlights:**
- **Normalized structure:** Reduces data redundancy
- **Foreign keys:** Referential integrity
- **Indexes:** Optimized query performance
- **Triggers:** Automatic `updated_at` timestamp

**Alternatives Considered:**

#### MongoDB (NoSQL)
- ❌ Less structured data
- ❌ Harder to maintain relationships
- ✅ Better for unstructured data
- ✅ Horizontal scaling easier
- **Verdict:** Not suitable for this use case

#### MySQL
- ✅ Similar to PostgreSQL
- ❌ Less advanced features
- ❌ No built-in JSON support (older versions)
- **Verdict:** PostgreSQL is more feature-rich

#### SQLite
- ✅ Simple, no server required
- ❌ Not suitable for concurrent writes
- ❌ No user management
- **Verdict:** Only for prototyping

**Production Recommendations:**
- **<1000 users:** PostgreSQL on single server
- **1000-10000 users:** PostgreSQL with read replicas
- **10000+ users:** PostgreSQL with sharding or migrate to TimescaleDB

---

## Message Broker

### RabbitMQ

**Chosen Technology:** RabbitMQ 3 Management Alpine

**Why RabbitMQ?**
- ✅ **Reliability:** Message persistence, acknowledgments
- ✅ **Flexibility:** Multiple exchange types (fanout, direct, topic)
- ✅ **Management UI:** Easy monitoring and debugging
- ✅ **Mature:** Battle-tested in production
- ✅ **Multi-language support:** Works with Python and Node.js

**Use Cases in Market Watcher:**
1. **News Distribution:** gnews-service → notifier-service
2. **Price Updates:** api-handler → notifier-service
3. **Fundamental Data:** scraping-worker → (future consumers)

**Message Patterns Used:**
- **Fanout Exchange:** Broadcast to all subscribers
- **Durable Queues:** Messages survive broker restart
- **Message Persistence:** Individual messages saved to disk

**Alternatives Considered:**

#### Redis + Bull
- ✅ Simpler setup
- ✅ Faster (in-memory)
- ❌ Less reliable (data loss possible)
- ❌ No management UI
- **Verdict:** Not suitable for critical alerts

#### Apache Kafka
- ✅ High throughput
- ✅ Event streaming
- ❌ Complex setup
- ❌ Overkill for this scale
- **Verdict:** Use for >100k messages/sec

#### AWS SQS/SNS
- ✅ Managed service
- ✅ No maintenance
- ❌ Vendor lock-in
- ❌ Costs money
- **Verdict:** Consider for cloud deployment

**Production Recommendations:**
- **Self-hosted:** RabbitMQ ✅
- **AWS:** Amazon MQ (managed RabbitMQ) or SQS/SNS
- **High throughput:** Kafka

---

## External APIs

### GNews API

**Chosen Technology:** GNews API (https://gnews.io/)

**Why GNews?**
- ✅ **Free tier:** 100 requests/day
- ✅ **Global coverage:** Multiple countries and languages
- ✅ **Google News source:** Aggregates from Google News
- ✅ **Simple API:** Easy to integrate
- ✅ **No credit card required:** For development

**Limitations:**
- ❌ 100 requests/day (free tier)
- ❌ 10 articles per request max

**Alternatives:**

#### NewsAPI (newsapi.org)
- ✅ More sources (80,000+)
- ✅ 100 requests/day (free tier)
- ❌ No commercial use on free tier
- **Cost:** $449/month (business)

#### MediaStack (mediastack.com)
- ✅ 500 requests/month (free)
- ✅ Historical data
- ❌ Less sources
- **Cost:** $9.99/month (basic)

#### Custom RSS Feeds
- ✅ Free
- ✅ No rate limits
- ❌ Need to aggregate manually
- **Example:** Yahoo Finance RSS, Google News RSS

**Recommendation:** Start with GNews, migrate to NewsAPI or RSS for production

### Yahoo Finance API

**Chosen Technology:** yahoo-finance2 (unofficial library)

**Why Yahoo Finance?**
- ✅ **Free:** No API key required
- ✅ **Real-time data:** Current prices (15-min delay)
- ✅ **Historical data:** Years of historical prices
- ✅ **Global coverage:** NYSE, NASDAQ, crypto, forex
- ✅ **Reliable:** Used by millions of developers

**Limitations:**
- ⚠️ Unofficial API (can change without notice)
- ⚠️ No guaranteed uptime
- ⚠️ Rate limiting (soft limits)

**Alternatives:**

#### Alpha Vantage
- ✅ Official API
- ✅ Free tier (5 API calls/min, 500/day)
- ❌ Requires API key
- **Cost:** $49.99/month (premium)

#### IEX Cloud
- ✅ Professional-grade API
- ✅ Real-time data
- ❌ Expensive ($9/month + per-call fees)
- **Cost:** Starts at $9/month

#### Finnhub
- ✅ Free tier (60 API calls/min)
- ✅ Real-time data
- ❌ Limited stocks on free tier
- **Cost:** $49/month (starter)

**Recommendation:**
- **Development:** Yahoo Finance ✅
- **Production (<1000 calls/day):** Alpha Vantage
- **Production (>1000 calls/day):** IEX Cloud or paid tier

---

## Notification Channels

### Multi-Channel Architecture

**Design Pattern:** Parent-child provider system

```typescript
BaseMessagingProvider (Abstract)
├── SMTPProvider (Email)
├── TwilioProvider (SMS)
└── WhatsAppProvider (WhatsApp)
```

### SMTP (Email)

**Technology:** nodemailer

**Why SMTP?**
- ✅ **Universal:** Everyone has email
- ✅ **Rich content:** HTML formatting, images
- ✅ **Free:** Use Gmail, Outlook, etc.
- ✅ **Reliable:** Mature protocol

**Supported Providers:**
- Gmail (with App Password)
- SendGrid (transactional email)
- Mailgun (developer-friendly)
- Amazon SES (AWS)

**Recommendation:** Gmail for dev, SendGrid for production

### Twilio (SMS)

**Technology:** Twilio API

**Why Twilio?**
- ✅ **Market leader:** Most reliable SMS API
- ✅ **Global coverage:** 180+ countries
- ✅ **Free trial:** $15 credit
- ✅ **Simple API:** Easy integration

**Alternatives:**
- **Vonage (Nexmo):** Similar features, slightly cheaper
- **AWS SNS:** Good if already on AWS
- **MessageBird:** European alternative

**Recommendation:** Twilio ✅

### WhatsApp

**Technology:** utter-labs/wa-bot-api

**Why WhatsApp?**
- ✅ **High engagement:** 98% open rate
- ✅ **Global reach:** 2 billion users
- ✅ **Rich media:** Images, buttons (future)

**Implementation:** Requires separate wa-bot-api instance

**Alternatives:**
- **Twilio WhatsApp API:** Paid, requires approval
- **WhatsApp Business API:** Direct, requires approval
- **Unofficial libraries:** Use at your own risk

**Recommendation:** Start without WhatsApp, add later if needed

---

## Development Tools

### TypeScript Configuration

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

**Why these settings?**
- `strict: true` - Catch more errors at compile-time
- `ES2020` - Modern JavaScript features
- `commonjs` - Node.js compatibility

### Package Management

**Chosen:** npm (default with Node.js)

**Alternatives:**
- **Yarn:** Faster, better lockfile
- **pnpm:** Disk space efficient

**Recommendation:** npm is fine for this project

---

## Production Considerations

### Scaling Strategy

#### Vertical Scaling (Scale Up)
- Add more CPU/RAM to existing servers
- Good for: 1-1000 users
- Cost: Low to medium

#### Horizontal Scaling (Scale Out)
```bash
# Run multiple instances
docker compose up -d --scale gnews-service=3
docker compose up -d --scale api-handler=2
```
- Good for: 1000+ users
- Cost: Medium to high

### Monitoring Stack (Future Enhancement)

**Recommended:**
- **Prometheus:** Metrics collection
- **Grafana:** Visualization
- **Loki:** Log aggregation
- **Alertmanager:** Alert routing

**Implementation:**
```yaml
# Add to docker-compose.yml
prometheus:
  image: prom/prometheus
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml

grafana:
  image: grafana/grafana
  ports:
    - "3002:3000"
```

### Security Stack

**Already Implemented:**
- ✅ JWT authentication
- ✅ Bcrypt password hashing
- ✅ Rate limiting
- ✅ SQL injection protection
- ✅ HTML sanitization

**Future Enhancements:**
- 🔄 HTTPS (via nginx)
- 🔄 CSRF protection
- 🔄 Input validation middleware
- 🔄 API key rotation

---

## Cost Analysis

### Development (Free Tier)

| Service | Cost | Limit |
|---------|------|-------|
| GNews API | $0 | 100 req/day |
| Yahoo Finance | $0 | Soft limits |
| Gmail SMTP | $0 | 500 emails/day |
| Twilio Trial | $15 credit | Trial account |
| Server | $0 | Local Docker |
| **Total** | **$0** | - |

### Production (Small Scale, <1000 users)

| Service | Cost/Month | Notes |
|---------|------------|-------|
| VPS (DigitalOcean) | $12 | 2GB RAM |
| GNews API | $9 | Pro plan |
| SMTP (SendGrid) | $15 | 40k emails |
| Twilio SMS | ~$50 | $0.0075/SMS |
| Domain + SSL | $1 | Let's Encrypt |
| **Total** | **~$87/mo** | |

### Production (Medium Scale, 1000-10000 users)

| Service | Cost/Month | Notes |
|---------|------------|-------|
| VPS (DigitalOcean) | $48 | 8GB RAM |
| Database (Managed) | $15 | PostgreSQL |
| GNews API | $29 | Business |
| SMTP (SendGrid) | $90 | 300k emails |
| Twilio SMS | ~$500 | Variable |
| CDN + SSL | $5 | Cloudflare |
| **Total** | **~$687/mo** | |

---

## Summary & Recommendations

### ✅ Production-Ready Components
- Docker + Docker Compose orchestration
- PostgreSQL database with proper schema
- RabbitMQ message broker
- Node.js + TypeScript services
- Multi-channel notification system
- Security measures (auth, rate limiting)

### ⚠️ Needs Enhancement for Production
- Replace StatusInvest mock scraper with real HTML parsing
- Add HTTPS (nginx reverse proxy)
- Implement comprehensive monitoring (Prometheus + Grafana)
- Add automated backups
- Implement proper CI/CD pipeline

### 🚀 Future Enhancements
- WebSocket for real-time updates
- Machine learning for sentiment analysis
- Mobile app (React Native)
- Advanced charting (TradingView integration)
- Portfolio tracking
- Paper trading simulator

---

## Alternative Stack Suggestions

### For Minimal PoC (1 weekend)
- **Backend:** Python Flask + SQLite
- **Queue:** In-memory queue (no RabbitMQ)
- **Frontend:** HTML + Vanilla JS
- **Deploy:** Single Heroku dyno

### For Enterprise
- **Backend:** Java Spring Boot + Kotlin
- **Database:** PostgreSQL with TimescaleDB
- **Queue:** Apache Kafka
- **Cache:** Redis
- **Search:** Elasticsearch
- **Monitoring:** Datadog
- **Deploy:** Kubernetes on AWS EKS

### For Serverless
- **Backend:** AWS Lambda (Python/Node.js)
- **Database:** DynamoDB
- **Queue:** SQS/SNS
- **API:** API Gateway
- **Frontend:** S3 + CloudFront
- **Auth:** Cognito

---

**Conclusion:** The current stack is well-suited for a production-ready PoC with room to scale. It balances modern technologies, developer productivity, and operational simplicity.
