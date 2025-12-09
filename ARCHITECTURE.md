# Architecture Documentation

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Market Watcher System                        │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  GNews API   │         │ Yahoo Finance│         │StatusInvest  │
│   (External) │         │   (External) │         │  (External)  │
└──────┬───────┘         └──────┬───────┘         └──────┬───────┘
       │                        │                        │
       ▼                        ▼                        ▼
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│ gnews-service│         │ api-handler  │         │scraping-     │
│   (Python)   │         │  (Node.js)   │         │worker (Py)   │
└──────┬───────┘         └──────┬───────┘         └──────┬───────┘
       │                        │                        │
       │                        ▼                        │
       │                 ┌─────────────┐                │
       │                 │  PostgreSQL │                │
       │                 │  (Database) │                │
       │                 └─────────────┘                │
       │                        ▲                        │
       │                        │                        │
       └────────────┬───────────┴───────────┬───────────┘
                    ▼                       ▼
             ┌─────────────────────────────────┐
             │          RabbitMQ               │
             │      (Message Broker)           │
             └──────────────┬──────────────────┘
                            ▼
                    ┌───────────────┐
                    │  notifier-    │
                    │  service      │
                    │  (Node.js)    │
                    └───────┬───────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
    ┌──────────┐      ┌──────────┐     ┌──────────┐
    │   SMTP   │      │  Twilio  │     │ WhatsApp │
    │  (Email) │      │   (SMS)  │     │ (wa-bot) │
    └──────────┘      └──────────┘     └──────────┘
          │                 │                 │
          └─────────────────┼─────────────────┘
                            ▼
                       ┌─────────┐
                       │  Users  │
                       └─────────┘

                            ▲
                            │
                    ┌───────────────┐
                    │   web-app     │
                    │   (Node.js)   │
                    └───────────────┘
```

## Data Flow

### 1. Data Collection
- **GNews Service**: Polls GNews API every 5 minutes for market news
- **API Handler**: Monitors Yahoo Finance for stock prices
- **Scraping Worker**: Scrapes StatusInvest for fundamental data

### 2. Data Processing
- All services publish data to RabbitMQ exchanges
- Data is stored in PostgreSQL database
- Notifier service subscribes to relevant queues

### 3. Alert Generation
- Notifier correlates news and price data
- Checks user watchlists for matching conditions
- Triggers when: High news activity AND significant price change

### 4. Multi-Channel Delivery
- **Parent Interface**: BaseMessagingProvider
- **Children**:
  - SMTP (HTML/Text)
  - Twilio (Text only)
  - WhatsApp via wa-bot-api (Text only)
- Automatic fallback between providers

## Message Queues

### Exchanges
- `market_news` (fanout) - News articles
- `stock_prices` (fanout) - Stock price updates
- `fundamental_data` (fanout) - StatusInvest data

### Queues
- `news_queue` - Consumed by notifier
- `price_updates` - Consumed by notifier
- `fundamentals_queue` - Future use

## Database Schema

### Core Tables
- `users` - User accounts (email, phone, whatsapp)
- `stocks` - Stock symbols and metadata
- `user_watchlist` - User's monitored stocks
- `alerts` - Notification history
- `stock_prices` - Historical price data
- `news_articles` - Scraped news
- `stock_news` - Stock-news relationships
- `status_invest_data` - Fundamental metrics

## Messaging System Architecture

### Interface Hierarchy
```
BaseMessagingProvider (Abstract)
    │
    ├── SMTPProvider
    │   └── Supports: HTML, Text
    │
    ├── TwilioProvider
    │   └── Supports: Text (auto-converts HTML)
    │
    └── WhatsAppProvider
        └── Supports: Text with markdown
```

### Format Conversion
- HTML messages automatically converted to text for SMS/WhatsApp
- Text messages work across all providers
- Email can send both HTML and text fallback

## Security

### Authentication
- JWT tokens for web app authentication
- 7-day token expiration
- Bcrypt password hashing (cost factor 10)

### API Keys
- GNews API key for news access
- Twilio credentials for SMS
- WhatsApp API integration
- SMTP credentials for email

### Network Security
- All services in isolated Docker network
- No external exposure except web app (port 3000)
- RabbitMQ management on localhost only

## Scalability Considerations

### Horizontal Scaling
- All services are stateless (except database)
- Can run multiple instances behind load balancer
- RabbitMQ ensures message distribution

### Vertical Scaling
- Database can be upgraded independently
- RabbitMQ memory can be increased
- Service resource limits configurable

## Monitoring Endpoints

- `/health` - All Node.js services
- RabbitMQ Management UI - Port 15672
- Database - Port 5432 (internal)

## Configuration

All services configured via environment variables:
- Database credentials
- API keys and tokens
- Check intervals
- Message broker settings
- SMTP/Twilio/WhatsApp configs
