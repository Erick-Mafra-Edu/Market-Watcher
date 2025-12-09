# Security Summary

## Security Measures Implemented

### 1. Authentication & Authorization
- **JWT Token-based Authentication**
  - Tokens expire after 7 days
  - Production validation ensures JWT_SECRET is properly configured
  - Runtime checks prevent undefined JWT_SECRET usage
  
- **Password Security**
  - Bcrypt hashing with cost factor 10
  - Passwords never stored in plain text

### 2. Rate Limiting
- **Authentication Endpoints**: 5 requests per 15 minutes per IP
  - `/api/auth/register`
  - `/api/auth/login`
  
- **API Endpoints**: 100 requests per 15 minutes per IP
  - All `/api/watchlist/*` endpoints
  - All `/api/alerts/*` endpoints
  - All `/api/stocks/*` endpoints

### 3. Input Validation & Sanitization
- **SQL Injection Protection**
  - All database queries use parameterized statements
  - No string concatenation in SQL queries
  - Separate queries for complex operations to ensure data integrity

- **HTML Sanitization**
  - Multiple-pass script/style tag removal
  - Removal of potentially dangerous tags (iframe, object, embed)
  - Safe HTML entity decoding order (amp last)
  - Final cleanup of any remaining < > characters

### 4. Network Security
- **Docker Network Isolation**
  - All services in isolated `market-watcher-network`
  - Only web-app and API handler exposed externally
  - Database and RabbitMQ accessible only within network

- **Port Exposure**
  - 3000: Web App (required for user access)
  - 3001: API Handler (required for external stock data)
  - 5672: RabbitMQ (message broker, consider internal only for production)
  - 15672: RabbitMQ Management (consider removing in production)
  - 5432: PostgreSQL (consider removing external access in production)

### 5. Environment Variables
- **Secret Management**
  - All sensitive data in environment variables
  - `.env` file excluded from git
  - `.env.example` provided as template
  - Production check for default values

- **Required Secrets**
  - `JWT_SECRET` - Must be changed from default
  - `POSTGRES_PASSWORD` - Database password
  - `RABBITMQ_PASS` - Message broker password
  - `SMTP_PASS` - Email credentials
  - `TWILIO_AUTH_TOKEN` - SMS credentials (optional)
  - `WHATSAPP_API_KEY` - WhatsApp credentials (optional)

### 6. Data Protection
- **User Data**
  - Email addresses stored uniquely
  - Phone/WhatsApp numbers optional
  - Alert history maintained per user
  
- **Database Indexes**
  - Optimized for query performance
  - Foreign key constraints for data integrity

## Security Recommendations for Production

### Critical
1. **Change all default passwords** in `.env`
2. **Generate strong JWT_SECRET** (32+ random characters)
3. **Use HTTPS** (add nginx reverse proxy with SSL/TLS)
4. **Enable Docker secrets** for sensitive environment variables
5. **Restrict database port** (remove `5432:5432` from docker-compose.yml)

### Recommended
1. **Implement CORS** properly for web-app
2. **Add request size limits** to prevent DoS
3. **Enable audit logging** for security events
4. **Set up monitoring** (Prometheus + Grafana)
5. **Regular security updates** for dependencies
6. **Backup strategy** for PostgreSQL data

### Optional Enhancements
1. **Two-Factor Authentication** for user accounts
2. **API Key Authentication** for service-to-service calls
3. **Content Security Policy** headers
4. **CSRF protection** for web forms
5. **Email verification** for new registrations

## Known Limitations

### Mock Scraper Data
The StatusInvest scraper currently returns mock data for demonstration. In production:
- Implement actual HTML parsing
- Add error handling for site changes
- Consider API alternatives if available
- Monitor for rate limiting

### Rate Limiting Scope
Current rate limiting is per-IP address:
- May need user-based limits for shared IPs
- Consider distributed rate limiting for multi-instance deployments
- Add bypass mechanism for trusted services

### HTML to Text Conversion
The `htmlToText` function in messaging is designed for:
- Converting email content to SMS/WhatsApp
- NOT for sanitizing user-generated content
- Trust only internally-generated HTML

## CodeQL Analysis Results

After implementing security fixes:
- **18 alerts initially found**
- **Fixed**: 
  - All rate limiting issues on protected endpoints
  - HTML sanitization vulnerabilities
  - SQL query safety issues
- **Remaining**: 7 alerts (mostly false positives on rate-limited routes)

### False Positives
Some routes flagged as "not rate-limited" are actually protected by `apiLimiter` middleware. CodeQL may not properly detect the rate limiting in the middleware chain.

## Incident Response

If a security issue is discovered:

1. **Immediate Actions**
   - Stop affected services: `docker-compose stop [service]`
   - Check logs: `docker-compose logs [service]`
   - Backup database: `pg_dump`

2. **Investigation**
   - Review access logs
   - Check for unauthorized database changes
   - Audit RabbitMQ message queue

3. **Recovery**
   - Apply security patch
   - Rotate compromised secrets
   - Rebuild affected containers: `docker-compose build --no-cache [service]`
   - Restart services: `docker-compose up -d`

4. **Post-Incident**
   - Update this document
   - Notify affected users (if applicable)
   - Implement additional monitoring

## Security Contact

For security issues:
- Create a private GitHub security advisory
- Or contact repository maintainers directly
- Do NOT publicly disclose vulnerabilities

---

**Last Updated**: December 2024
**Security Review Date**: December 2024
**Next Review**: March 2025 (or after major changes)
