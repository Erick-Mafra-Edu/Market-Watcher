# Market Watcher - Detailed Setup Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Detailed Setup Steps](#detailed-setup-steps)
4. [Service Configuration](#service-configuration)
5. [Verification & Testing](#verification--testing)
6. [Troubleshooting](#troubleshooting)
7. [Production Deployment](#production-deployment)

---

## Prerequisites

### System Requirements
- **Operating System:** Linux, macOS, or Windows with WSL2
- **RAM:** Minimum 4GB, Recommended 8GB
- **Disk Space:** 10GB free space
- **CPU:** 2+ cores recommended

### Software Requirements

#### 1. Docker Engine
- **Version:** 20.10 or higher
- **Installation:**
  ```bash
  # Ubuntu/Debian
  curl -fsSL https://get.docker.com -o get-docker.sh
  sudo sh get-docker.sh
  sudo usermod -aG docker $USER
  # ⚠️ Security Note: Adding user to docker group grants root-equivalent privileges
  # For production, consider using sudo for docker commands instead
  
  # macOS/Windows
  # Download Docker Desktop from https://www.docker.com/products/docker-desktop
  ```

#### 2. Docker Compose
- **Version:** 2.0 or higher (v1.29+ for docker-compose legacy)
- **Installation:**
  ```bash
  # Usually included with Docker Desktop
  # For standalone installation:
  sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
  ```

#### 3. Git
```bash
# Ubuntu/Debian
sudo apt-get install git

# macOS
brew install git

# Windows
# Download from https://git-scm.com/
```

### Verify Installation
```bash
docker --version        # Should show 20.10+
docker compose version  # Should show 2.0+ or docker-compose --version for v1.29+
git --version          # Should show 2.0+
```

---

## Quick Start

For users who want to get up and running immediately:

```bash
# 1. Clone repository
git clone https://github.com/Erick-Mafra-Edu/Market-Watcher.git
cd Market-Watcher

# 2. Setup environment
cp .env.example .env
nano .env  # Edit with your credentials

# 3. Start services
docker compose up -d

# 4. Check status
docker compose ps

# 5. Access application
# Web App: http://localhost:3000
# RabbitMQ Management: http://localhost:15672
```

---

## Detailed Setup Steps

### Step 1: Clone Repository

```bash
# Clone the repository
git clone https://github.com/Erick-Mafra-Edu/Market-Watcher.git
cd Market-Watcher

# Verify structure
ls -la
# Should show: docker-compose.yml, .env.example, service directories
```

### Step 2: Environment Configuration

#### Create Environment File
```bash
cp .env.example .env
```

#### Configure Required Variables

Open `.env` in your preferred editor and configure:

##### Database Configuration (Required)
```env
POSTGRES_DB=market_watcher
POSTGRES_USER=postgres
POSTGRES_PASSWORD=CHANGE_THIS_TO_YOUR_SECURE_PASSWORD
```

⚠️ **Security Warning:** 
- **NEVER** use example passwords in production
- Use a strong password with uppercase, lowercase, numbers, and special characters
- Minimum 16 characters recommended
- Generate secure passwords using: `openssl rand -base64 24`

##### RabbitMQ Configuration (Required)
```env
RABBITMQ_USER=admin
RABBITMQ_PASS=CHANGE_THIS_TO_YOUR_SECURE_PASSWORD
```

⚠️ **Security Note:** Do not use example passwords. Generate a secure password.

##### GNews API Configuration (Required for news)
```env
GNEWS_API_KEY=your_api_key_here
```

**How to get GNews API Key:**
1. Visit https://gnews.io/
2. Click "Get API Access"
3. Sign up for free account (100 requests/day)
4. Copy API key from dashboard

##### JWT Secret (Required for authentication)
```env
JWT_SECRET=your_very_secure_random_string_at_least_32_characters_long_12345
```

**Generate secure JWT secret:**
```bash
# Linux/macOS
openssl rand -base64 32

# Or use online generator
# https://www.grc.com/passwords.htm
```

##### Email Configuration (Optional but recommended)

For Gmail:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your.email@gmail.com
SMTP_PASS=your_app_specific_password
SMTP_FROM="Market Watcher <noreply@marketwatcher.com>"
```

**Gmail App Password Setup:**
1. Go to Google Account settings
2. Security → 2-Step Verification (must be enabled)
3. App passwords → Generate
4. Select "Mail" and "Other (Custom name)"
5. Copy generated password

For other SMTP providers:
```env
# SendGrid
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key

# Mailgun
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASS=your_mailgun_password
```

##### SMS Configuration (Optional)
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_FROM_NUMBER=+1234567890
```

**Twilio Setup:**
1. Sign up at https://www.twilio.com/
2. Get free trial account ($15 credit)
3. Get phone number from console
4. Copy Account SID and Auth Token

##### WhatsApp Configuration (Optional)
```env
WHATSAPP_API_URL=http://your-whatsapp-api:3000
WHATSAPP_API_KEY=your_api_key
WHATSAPP_INSTANCE_ID=your_instance_id
```

**WhatsApp Setup (utter-labs/wa-bot-api):**
```bash
# Run wa-bot-api separately or use hosted service
docker run -d -p 3000:3000 utter-labs/wa-bot-api
# Follow wa-bot-api documentation for instance setup
```

##### Service Check Intervals (Optional)
```env
GNEWS_CHECK_INTERVAL=300      # 5 minutes
API_CHECK_INTERVAL=300        # 5 minutes
SCRAPER_CHECK_INTERVAL=300    # 5 minutes
```

### Step 3: Build Docker Images

Build all service images:

```bash
# Build all services
docker compose build

# Or build specific service
docker compose build web-app
docker compose build api-handler
```

**Expected output:**
```
[+] Building 45.3s (52/52) FINISHED
=> [gnews-service internal] load build definition
=> [api-handler internal] load build definition
...
```

### Step 4: Start Services

#### Start All Services
```bash
# Start in detached mode (background)
docker compose up -d

# Or start with logs visible (foreground)
docker compose up
```

#### Start Specific Services
```bash
# Start only database and RabbitMQ
docker compose up -d database rabbitmq

# Start remaining services
docker compose up -d
```

#### Check Service Status
```bash
docker compose ps
```

**Expected output:**
```
NAME                           STATUS    PORTS
market-watcher-api-handler     Up        0.0.0.0:3001->3001/tcp
market-watcher-db              Up        0.0.0.0:5432->5432/tcp
market-watcher-gnews           Up        
market-watcher-notifier        Up        
market-watcher-rabbitmq        Up        0.0.0.0:5672->5672/tcp, 0.0.0.0:15672->15672/tcp
market-watcher-scraper         Up        
market-watcher-web             Up        0.0.0.0:3000->3000/tcp
```

### Step 5: View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f web-app

# Last 100 lines
docker compose logs --tail=100 api-handler

# Since specific time
docker compose logs --since 30m notifier-service
```

---

## Service Configuration

### Database Initialization

The database is automatically initialized with the schema from `database/init.sql` on first startup.

#### Verify Database
```bash
# Connect to database
docker compose exec database psql -U postgres -d market_watcher

# List tables
\dt

# Check users table
SELECT * FROM users;

# Exit
\q
```

### RabbitMQ Setup

#### Access Management UI
1. Open browser to http://localhost:15672
2. Login with credentials from `.env`:
   - Username: `admin` (or your RABBITMQ_USER)
   - Password: from `RABBITMQ_PASS`

#### Verify Exchanges
Navigate to "Exchanges" tab, should see:
- `market_news` (fanout)
- `stock_prices` (fanout)
- `fundamental_data` (fanout)

#### Verify Queues
Navigate to "Queues" tab, should see:
- `news_queue`
- `price_updates`
- `fundamentals_queue`

### Service Health Checks

```bash
# Web App
curl http://localhost:3000/health
# Expected: {"status":"ok","service":"web-app"}

# API Handler
curl http://localhost:3001/health
# Expected: {"status":"ok","service":"api-handler"}

# Database
docker compose exec database pg_isready -U postgres
# Expected: /var/run/postgresql:5432 - accepting connections

# RabbitMQ
docker compose exec rabbitmq rabbitmq-diagnostics ping
# Expected: Ping succeeded
```

---

## Verification & Testing

### Test User Registration

```bash
# Register new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "name": "Test User"
  }'

# Expected response
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "email": "test@example.com",
    "name": "Test User"
  }
}
```

### Test User Login

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'

# Save the token from response
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Test Watchlist

```bash
# Add stock to watchlist
curl -X POST http://localhost:3000/api/watchlist \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "symbol": "AAPL",
    "min_price_change": 3.0
  }'

# Get watchlist
curl http://localhost:3000/api/watchlist \
  -H "Authorization: Bearer $TOKEN"
```

### Test Stock Data

```bash
# Get AAPL quote
curl http://localhost:3000/api/stocks/AAPL \
  -H "Authorization: Bearer $TOKEN"

# Expected response
{
  "symbol": "AAPL",
  "price": 175.23,
  "changePercent": 2.35,
  "volume": 50123456,
  "marketCap": 2750000000000,
  "name": "Apple Inc."
}
```

### Monitor Service Activity

```bash
# Watch news being processed
docker compose logs -f gnews-service | grep "Published news"

# Watch stock updates
docker compose logs -f api-handler | grep "Published stock data"

# Watch alert triggers
docker compose logs -f notifier-service | grep "Sending alert"
```

---

## Troubleshooting

### Issue: Services Won't Start

#### Problem: Docker daemon not running
```bash
# Check Docker status
sudo systemctl status docker

# Start Docker
sudo systemctl start docker

# Enable on boot
sudo systemctl enable docker
```

#### Problem: Port already in use
```bash
# Find process using port
sudo lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Solution 1: Kill process
sudo kill -9 <PID>

# Solution 2: Change port in docker-compose.yml
# Edit web-app ports to "8080:3000"
```

#### Problem: Insufficient memory
```bash
# Check available memory
free -h  # Linux
# Increase Docker memory limit in Docker Desktop settings
```

### Issue: Database Connection Failed

```bash
# Check database health
docker compose exec database pg_isready -U postgres

# If not ready, check logs
docker compose logs database

# Common fixes:
# 1. Wait longer (database needs 10-20 seconds to initialize)
# 2. Restart database
docker compose restart database

# 3. Reset database (WARNING: deletes all data)
docker compose down -v
docker compose up -d database
sleep 10
docker compose up -d
```

### Issue: RabbitMQ Connection Failed

```bash
# Check RabbitMQ status
docker compose exec rabbitmq rabbitmq-diagnostics ping

# Check logs
docker compose logs rabbitmq

# Common fixes:
# 1. Restart RabbitMQ
docker compose restart rabbitmq

# 2. Check credentials in .env match across all services
grep RABBITMQ .env
```

### Issue: GNews Service Not Fetching News

```bash
# Check logs
docker compose logs gnews-service

# Common issues:
# 1. Invalid API key
# Solution: Verify GNEWS_API_KEY in .env

# 2. Rate limit exceeded (free tier: 100 requests/day)
# Solution: Wait 24 hours or upgrade plan

# 3. No internet connection
# Test: docker compose exec gnews-service ping -c 3 gnews.io
```

### Issue: No Alerts Being Sent

```bash
# Check notifier logs
docker compose logs notifier-service

# Common issues:
# 1. No stocks in watchlist
# Solution: Add stocks via web app

# 2. Price change threshold too high
# Solution: Lower min_price_change in watchlist (try 1.0 for testing)

# 3. SMTP not configured
# Check: grep SMTP .env
# Verify: docker compose logs notifier-service | grep "SMTP"

# 4. No significant price movements
# Solution: Monitor a volatile stock like TSLA or crypto (BTC-USD)
```

### Issue: Web App Not Accessible

```bash
# Check if web app is running
docker compose ps web-app

# Check logs for errors
docker compose logs web-app

# Test from container
docker compose exec web-app wget -O- http://localhost:3000/health

# Common fixes:
# 1. Restart web app
docker compose restart web-app

# 2. Rebuild and restart
docker compose build web-app
docker compose up -d web-app
```

### Complete Service Reset

If all else fails:

```bash
# Stop all services
docker compose down

# Remove volumes (WARNING: deletes all data)
docker compose down -v

# Clean Docker system
docker system prune -a

# Rebuild and restart
docker compose build --no-cache
docker compose up -d

# Wait for services to initialize
sleep 30

# Check status
docker compose ps
```

---

## Production Deployment

### Security Hardening

#### 1. Change All Default Passwords
```env
# Generate strong passwords
POSTGRES_PASSWORD=$(openssl rand -base64 32)
RABBITMQ_PASS=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 48)
```

#### 2. Restrict Database Access
```yaml
# In docker-compose.yml, remove external port
database:
  # ports:
  #   - "5432:5432"  # Comment this out
```

#### 3. Restrict RabbitMQ Management
```yaml
# In docker-compose.yml, bind to localhost only
rabbitmq:
  ports:
    - "127.0.0.1:15672:15672"  # Only accessible from host
```

#### 4. Enable HTTPS
```bash
# Install nginx
sudo apt-get install nginx

# Configure SSL
sudo nano /etc/nginx/sites-available/market-watcher
```

Sample nginx config:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### 5. Use Docker Secrets
```yaml
# docker-compose.prod.yml
services:
  database:
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password

secrets:
  db_password:
    file: ./secrets/db_password.txt
```

### Performance Optimization

#### 1. Resource Limits
```yaml
# Add to each service in docker-compose.yml
deploy:
  resources:
    limits:
      cpus: '1'
      memory: 512M
    reservations:
      cpus: '0.5'
      memory: 256M
```

#### 2. Database Tuning
```yaml
database:
  environment:
    POSTGRES_SHARED_BUFFERS: 256MB
    POSTGRES_EFFECTIVE_CACHE_SIZE: 1GB
    POSTGRES_MAX_CONNECTIONS: 100
```

#### 3. Connection Pooling
Already implemented in services using `pg.Pool` with sensible defaults.

### Monitoring Setup

#### 1. Enable Service Logging
```bash
# Configure log rotation
sudo nano /etc/docker/daemon.json
```

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

#### 2. Health Monitoring Script
```bash
#!/bin/bash
# health-check.sh

echo "Checking Market Watcher services..."

# Check web app
if curl -sf http://localhost:3000/health > /dev/null; then
    echo "✓ Web App: OK"
else
    echo "✗ Web App: DOWN"
fi

# Check API handler
if curl -sf http://localhost:3001/health > /dev/null; then
    echo "✓ API Handler: OK"
else
    echo "✗ API Handler: DOWN"
fi

# Check database
if docker compose exec -T database pg_isready -U postgres > /dev/null 2>&1; then
    echo "✓ Database: OK"
else
    echo "✗ Database: DOWN"
fi

# Check RabbitMQ
if docker compose exec -T rabbitmq rabbitmq-diagnostics ping > /dev/null 2>&1; then
    echo "✓ RabbitMQ: OK"
else
    echo "✗ RabbitMQ: DOWN"
fi
```

```bash
chmod +x health-check.sh
# Add to cron for regular checks
crontab -e
# */5 * * * * /path/to/health-check.sh >> /var/log/market-watcher-health.log
```

### Backup Strategy

#### Database Backup
```bash
#!/bin/bash
# backup-db.sh

BACKUP_DIR="/backups/market-watcher"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="market_watcher_${DATE}.sql"

mkdir -p $BACKUP_DIR

docker compose exec -T database pg_dump -U postgres market_watcher > "$BACKUP_DIR/$FILENAME"

# Compress
gzip "$BACKUP_DIR/$FILENAME"

# Keep only last 7 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: $FILENAME.gz"
```

```bash
chmod +x backup-db.sh
# Add to cron for daily backups
# 0 2 * * * /path/to/backup-db.sh
```

#### Restore Database
```bash
# Restore from backup
gunzip market_watcher_20240101_020000.sql.gz
docker compose exec -T database psql -U postgres market_watcher < market_watcher_20240101_020000.sql
```

### Scaling Considerations

#### Horizontal Scaling (Multiple Instances)
```bash
# Run multiple instances of worker services
docker compose up -d --scale gnews-service=3
docker compose up -d --scale scraping-worker=2
```

#### Load Balancing
Use nginx or HAProxy for web-app:
```nginx
upstream web_app {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
}
```

---

## Additional Resources

### Documentation Files
- `README.md` - Project overview and quick start
- `ARCHITECTURE.md` - System architecture and data flow
- `SERVICE_ARCHITECTURE.md` - Detailed I/O specifications
- `DOCKER_SETUP.md` - Docker-specific setup guide
- `MESSAGING_EXAMPLES.md` - Messaging system usage examples
- `SECURITY.md` - Security measures and best practices

### External Documentation
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [RabbitMQ Documentation](https://www.rabbitmq.com/documentation.html)
- [Yahoo Finance API](https://github.com/gadicc/node-yahoo-finance2)
- [GNews API](https://gnews.io/docs/)

### Community Support
- GitHub Issues: https://github.com/Erick-Mafra-Edu/Market-Watcher/issues
- Docker Community: https://forums.docker.com/
- Stack Overflow: Use tags `docker`, `docker-compose`, `market-data`

---

## Quick Reference

### Common Commands
```bash
# Start services
docker compose up -d

# Stop services
docker compose stop

# Restart service
docker compose restart <service-name>

# View logs
docker compose logs -f <service-name>

# Execute command in container
docker compose exec <service-name> <command>

# Remove everything (including volumes)
docker compose down -v

# Rebuild service
docker compose build <service-name>

# Update service
docker compose up -d --build <service-name>
```

### Service Ports
- **3000** - Web App (HTTP)
- **3001** - API Handler (HTTP)
- **5432** - PostgreSQL (TCP)
- **5672** - RabbitMQ (AMQP)
- **15672** - RabbitMQ Management (HTTP)

### Default Credentials
- **PostgreSQL:** postgres / (from .env)
- **RabbitMQ:** admin / (from .env)
- **JWT Secret:** (from .env)

---

**Need Help?** Check the [Troubleshooting](#troubleshooting) section or open an issue on GitHub.
