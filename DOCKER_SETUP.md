# Docker Setup Guide

## Prerequisites

- Docker Engine 20.10+ or Docker Desktop
- Docker Compose v2.0+ (or docker-compose v1.29+)
- Minimum 4GB RAM available
- 10GB free disk space

## Quick Start

### 1. Environment Configuration

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` with your actual credentials:
```bash
nano .env  # or use your preferred editor
```

**Required Variables:**
- `POSTGRES_PASSWORD` - Database password
- `RABBITMQ_PASS` - Message broker password
- `GNEWS_API_KEY` - Get from https://gnews.io/
- `SMTP_*` - Email server credentials
- `JWT_SECRET` - Random secure string

**Optional Variables (for additional features):**
- `TWILIO_*` - SMS notifications
- `WHATSAPP_*` - WhatsApp notifications

### 2. Build and Start Services

Build all images:
```bash
docker compose build
```

Start all services:
```bash
docker compose up -d
```

Watch logs:
```bash
docker compose logs -f
```

### 3. Verify Services

Check all services are running:
```bash
docker compose ps
```

Expected output:
```
NAME                           STATUS    PORTS
market-watcher-api-handler     Up        0.0.0.0:3001->3001/tcp
market-watcher-db              Up        0.0.0.0:5432->5432/tcp
market-watcher-gnews           Up        
market-watcher-notifier        Up        
market-watcher-rabbitmq        Up        0.0.0.0:5672->5672/tcp, 0.0.0.0:15672->15672/tcp
market-watcher-scrapper        Up        
market-watcher-web             Up        0.0.0.0:3000->3000/tcp
```

### 4. Access Services

- **Web App**: http://localhost:3000
- **API Handler**: http://localhost:3001
- **RabbitMQ Management**: http://localhost:15672 (admin/admin)

## Service Management

### Start Services
```bash
docker compose up -d
```

### Stop Services
```bash
docker compose stop
```

### Restart a Service
```bash
docker compose restart notifier-service
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f web-app

# Last 100 lines
docker compose logs --tail=100 api-handler
```

### Execute Commands in Container
```bash
# Access shell
docker compose exec web-app sh

# Run database query
docker compose exec database psql -U postgres -d market_watcher -c "SELECT COUNT(*) FROM users;"
```

## Troubleshooting

### Services Won't Start

**Problem**: Docker daemon not running
```bash
# Linux
sudo systemctl start docker

# macOS/Windows
# Start Docker Desktop
```

**Problem**: Port already in use
```bash
# Find process using port
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Change port in docker-compose.yml
ports:
  - "8080:3000"  # Change 3000 to 8080
```

### Database Connection Issues

**Check database is healthy:**
```bash
docker compose exec database pg_isready -U postgres
```

**Reset database:**
```bash
docker compose down -v
docker compose up -d database
# Wait 10 seconds
docker compose up -d
```

### RabbitMQ Issues

**Check RabbitMQ status:**
```bash
docker compose exec rabbitmq rabbitmq-diagnostics ping
```

**Access RabbitMQ logs:**
```bash
docker compose logs rabbitmq
```

**Reset RabbitMQ:**
```bash
docker compose restart rabbitmq
```

### Build Failures

**Clear Docker cache:**
```bash
docker compose build --no-cache
```

**Remove all containers and volumes:**
```bash
docker compose down -v
docker system prune -a
docker compose up -d --build
```

## Development Workflow

### Making Changes to Code

1. Edit source files
2. Rebuild specific service:
```bash
docker compose build gnews-service
```
3. Restart service:
```bash
docker compose up -d gnews-service
```

### Hot Reload (Development Mode)

For Node.js services, mount source as volume in docker-compose.yml:
```yaml
volumes:
  - ./web-app/src:/app/src
```

Then start with dev script.

### Database Migrations

Access PostgreSQL:
```bash
docker compose exec database psql -U postgres -d market_watcher
```

Run SQL file:
```bash
docker compose exec -T database psql -U postgres -d market_watcher < migration.sql
```

## Production Deployment

### Security Checklist

- [ ] Change all default passwords in `.env`
- [ ] Use strong JWT_SECRET (32+ characters)
- [ ] Enable HTTPS (add nginx reverse proxy)
- [ ] Restrict database port (remove from ports in docker-compose.yml)
- [ ] Use Docker secrets for sensitive data
- [ ] Enable firewall rules
- [ ] Regular backups of PostgreSQL

### Performance Optimization

**Resource Limits** - Add to docker-compose.yml:
```yaml
services:
  api-handler:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

**Database Tuning** - Add to PostgreSQL environment:
```yaml
environment:
  POSTGRES_SHARED_BUFFERS: 256MB
  POSTGRES_EFFECTIVE_CACHE_SIZE: 1GB
  POSTGRES_MAX_CONNECTIONS: 100
```

### Monitoring

**Install Prometheus + Grafana:**
```yaml
# Add to docker-compose.yml
prometheus:
  image: prom/prometheus
  # ... configuration

grafana:
  image: grafana/grafana
  # ... configuration
```

### Backup Strategy

**Database Backup:**
```bash
# Backup
docker compose exec database pg_dump -U postgres market_watcher > backup.sql

# Restore
docker compose exec -T database psql -U postgres market_watcher < backup.sql
```

**Automated Backups** - Add cron job:
```bash
0 2 * * * cd /path/to/project && docker compose exec database pg_dump -U postgres market_watcher > backups/backup_$(date +\%Y\%m\%d).sql
```

## Useful Commands

### Clean Up

Remove stopped containers:
```bash
docker compose rm
```

Remove all project resources:
```bash
docker compose down --rmi all -v
```

### Scaling Services

Run multiple instances:
```bash
docker compose up -d --scale gnews-service=3
```

### Resource Usage

View stats:
```bash
docker stats
```

## Environment Variables Reference

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| POSTGRES_DB | No | Database name | market_watcher |
| POSTGRES_USER | No | Database user | postgres |
| POSTGRES_PASSWORD | Yes | Database password | - |
| RABBITMQ_USER | No | RabbitMQ user | admin |
| RABBITMQ_PASS | Yes | RabbitMQ password | - |
| GNEWS_API_KEY | Yes | GNews API key | - |
| SMTP_HOST | Yes | SMTP server | - |
| SMTP_PORT | No | SMTP port | 587 |
| SMTP_USER | Yes | SMTP username | - |
| SMTP_PASS | Yes | SMTP password | - |
| TWILIO_ACCOUNT_SID | No | Twilio SID | - |
| TWILIO_AUTH_TOKEN | No | Twilio token | - |
| WHATSAPP_API_URL | No | WhatsApp API URL | - |
| JWT_SECRET | Yes | JWT signing key | - |

## Support

For issues:
- Check logs: `docker compose logs`
- Review [ARCHITECTURE.md](ARCHITECTURE.md)
- Open GitHub issue
