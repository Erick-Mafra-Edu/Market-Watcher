# Market-Watcher 📊

**Investment Alert System via Docker Compose**

A comprehensive multi-service investment alert system that monitors market news and stock prices, notifying users through multiple channels (Email, SMS, WhatsApp) when significant market events occur.

## 🎯 Overview

Market Watcher monitors real-time market data from multiple sources and sends intelligent alerts when news trends are high AND stock values show significant movement. The system uses a microservices architecture with Docker Compose orchestration.

## 🏗️ Architecture

### Services

1. **GNews Service** (Python)
   - Scrapes market news using ranahaani/GNews library
   - Monitors topics: stock market, cryptocurrency, major indices
   - Publishes news to RabbitMQ message queue

2. **API Handler** (Node.js/TypeScript)
   - Integrates with Yahoo Finance API
   - Monitors stock prices and market data
   - Provides REST API for stock information
   - Stores data in PostgreSQL

3. **Scraping Worker** (Python)
   - Scrapes fundamental data from StatusInvest
   - Monitors Brazilian stocks (PETR4, VALE3, ITUB4, etc.)
   - Publishes fundamental data to message queue

4. **Notifier Service** (Node.js/TypeScript)
   - **Multi-channel messaging system with parent-child architecture**
   - Supports HTML and plain text formats
   - Integrated providers:
     - **SMTP** - Email notifications (HTML/Text)
     - **Twilio** - SMS notifications (Text)
     - **WhatsApp** - Via utter-labs/wa-bot-api integration (Text)
   - Correlates news and price data
   - Sends alerts when conditions are met

5. **Web App** (Node.js/TypeScript)
   - User registration and authentication (JWT)
   - Watchlist management
   - Alert history and visualization
   - Responsive web interface

6. **Database** (PostgreSQL)
   - Stores users, stocks, watchlists, alerts
   - Maintains historical price and news data

7. **Message Queue** (RabbitMQ)
   - Coordinates communication between services
   - Ensures reliable message delivery

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- At least 4GB RAM available
- Internet connection

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Erick-Mafra-Edu/Market-Watcher.git
cd Market-Watcher
```

2. Copy environment configuration:
```bash
cp .env.example .env
```

3. Edit `.env` with your credentials:
```bash
# Database
POSTGRES_PASSWORD=your_secure_password

# RabbitMQ
RABBITMQ_PASS=your_rabbitmq_password

# GNews API (get key from https://gnews.io/)
GNEWS_API_KEY=your_gnews_api_key

# SMTP (Gmail example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM="Market Watcher <noreply@marketwatcher.com>"

# Twilio (optional - for SMS)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_FROM_NUMBER=+1234567890

# WhatsApp via utter-labs/wa-bot-api (optional)
WHATSAPP_API_URL=http://your-whatsapp-api-url
WHATSAPP_API_KEY=your_api_key
WHATSAPP_INSTANCE_ID=your_instance_id

# JWT Secret
JWT_SECRET=generate_a_secure_random_string_here
```

4. Start all services:
```bash
docker-compose up -d
```

5. Check service status:
```bash
docker-compose ps
```

6. Access the web interface:
```
http://localhost:3000
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Watchlist (Authenticated)
- `GET /api/watchlist` - Get user's watchlist
- `POST /api/watchlist` - Add stock to watchlist
- `DELETE /api/watchlist/:symbol` - Remove stock from watchlist

### Alerts (Authenticated)
- `GET /api/alerts` - Get user's alerts
- `PATCH /api/alerts/:alertId/read` - Mark alert as read

### Stocks (Authenticated)
- `GET /api/stocks/:symbol` - Get stock quote
- `GET /api/stocks/:symbol/history` - Get historical data

## 🔔 Messaging System

The notifier service implements a sophisticated multi-channel messaging architecture:

### Base Messaging Interface
- **Parent Class**: `BaseMessagingProvider`
- **Supported Formats**: HTML and Plain Text
- **Automatic Format Conversion**: HTML to text when provider doesn't support HTML

### Provider Implementation

#### SMTP Provider
```typescript
// Supports both HTML and plain text
// Automatically includes text fallback for HTML emails
const smtpProvider = new SMTPProvider({
  host: 'smtp.gmail.com',
  port: 587,
  auth: { user: 'email', pass: 'password' },
  from: 'sender@example.com'
});
```

#### Twilio SMS Provider
```typescript
// Text-only, automatically converts HTML to text
const twilioProvider = new TwilioProvider({
  accountSid: 'your_sid',
  authToken: 'your_token',
  fromNumber: '+1234567890'
});
```

#### WhatsApp Provider (utter-labs/wa-bot-api)
```typescript
// Text with markdown support, integrates with wa-bot-api
const whatsappProvider = new WhatsAppProvider({
  apiUrl: 'http://your-api-url',
  apiKey: 'your_key',
  instanceId: 'your_instance'
});
```

### Messaging Manager
Coordinates all providers with intelligent fallback:
```typescript
// Send via preferred provider with fallback
await messagingManager.send(recipient, content, {
  preferredProviders: ['SMTP'],
  fallbackEnabled: true
});
```

## 🗄️ Database Schema

- **users** - User accounts with email, phone, WhatsApp
- **stocks** - Stock information
- **user_watchlist** - User's watched stocks with alert thresholds
- **news_articles** - Scraped news data
- **stock_prices** - Historical price data
- **alerts** - Sent notifications
- **status_invest_data** - Fundamental analysis data

## 🔧 Configuration

### Check Intervals
Configure how often services check for updates:
```env
GNEWS_CHECK_INTERVAL=300       # 5 minutes
API_CHECK_INTERVAL=300         # 5 minutes
SCRAPPER_CHECK_INTERVAL=300    # 5 minutes
```

### Alert Conditions
Set minimum price change threshold when adding stocks to watchlist (default: 5%)

## 📊 Monitoring

### Service Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f gnews-service
docker-compose logs -f notifier-service
```

### RabbitMQ Management UI
```
http://localhost:15672
Username: admin (from .env)
Password: admin (from .env)
```

### Health Checks
```bash
curl http://localhost:3000/health  # Web App
curl http://localhost:3001/health  # API Handler
```

## 🛠️ Development

### Build Individual Service
```bash
docker-compose build gnews-service
```

### Restart Service
```bash
docker-compose restart notifier-service
```

### Access Service Shell
```bash
docker-compose exec web-app sh
```

## 📦 Tech Stack

### Backend Services
- **Python**: GNews service, Scraping worker
  - Libraries: gnews, beautifulsoup4, selenium, pika
- **Node.js/TypeScript**: API handler, Notifier, Web app
  - Libraries: express, yahoo-finance2, nodemailer, twilio, amqplib

### Infrastructure
- **Docker & Docker Compose**: Container orchestration
- **PostgreSQL**: Primary database
- **RabbitMQ**: Message broker
- **nginx** (future): Reverse proxy

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🔐 Security Notes

- Never commit `.env` file
- Use strong passwords for database and RabbitMQ
- Rotate JWT secrets regularly
- Use app-specific passwords for Gmail SMTP
- Keep API keys secure

## 🐛 Troubleshooting

### Services won't start
```bash
docker-compose down -v
docker-compose up -d --build
```

### Database connection issues
```bash
docker-compose logs database
# Check if database is ready
docker-compose exec database pg_isready
```

### RabbitMQ connection issues
```bash
docker-compose logs rabbitmq
# Check RabbitMQ status
docker-compose exec rabbitmq rabbitmq-diagnostics ping
```

## 📞 Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/Erick-Mafra-Edu/Market-Watcher/issues)

---

**Made with ❤️ for investors who want to stay ahead of the market**
