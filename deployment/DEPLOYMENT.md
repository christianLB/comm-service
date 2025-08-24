# Comm-Service Deployment Guide

## 📋 Table of Contents
- [Environment Setup](#environment-setup)
- [Synology NAS Deployment](#synology-nas-deployment)
- [Local Development](#local-development)
- [Production Configuration](#production-configuration)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)
- [Backup & Recovery](#backup--recovery)

---

## Environment Setup

### System Requirements
- Docker 20.10+ and Docker Compose 2.0+
- Node.js 20+ (for local development)
- Redis 7.0+
- 2GB RAM minimum
- 10GB disk space for data persistence

### Network Requirements
- Port 8080: API service
- Port 6379: Redis (internal only)
- Outbound HTTPS for Telegram API
- Outbound SMTP for email service

---

## Synology NAS Deployment

### Prerequisites
- Synology NAS with Docker package installed
- SSH access enabled
- User: `k2600x` with sudo privileges
- NAS IP: `192.168.1.11`

### Step 1: Prepare NAS Environment

```bash
# SSH into NAS
ssh k2600x@192.168.1.11

# Create directory structure
sudo mkdir -p /volume1/docker/comm-service/{config,data,logs,backups,scripts}
sudo mkdir -p /volume1/docker/comm-service/data/{redis,audit}
sudo chown -R k2600x:users /volume1/docker/comm-service
```

### Step 2: Build Production Image

On your development machine:

```bash
# Clone and enter project
cd /home/k2600x/dev/comm-service

# Build production image
docker build -t comm-service:v0.1-prod .

# Save image for transfer
docker save comm-service:v0.1-prod | gzip > comm-service-v0.1-prod.tar.gz

# Calculate checksum for verification
sha256sum comm-service-v0.1-prod.tar.gz > comm-service-v0.1-prod.sha256
```

### Step 3: Transfer Files to NAS

```bash
# Create deployment package
tar -czf deployment-package.tar.gz \
  docker-compose.prod.yml \
  .env.production \
  openapi.yaml \
  scripts/ \
  README.md \
  DEPLOYMENT.md

# Transfer files
scp comm-service-v0.1-prod.tar.gz k2600x@192.168.1.11:/volume1/docker/comm-service/
scp comm-service-v0.1-prod.sha256 k2600x@192.168.1.11:/volume1/docker/comm-service/
scp deployment-package.tar.gz k2600x@192.168.1.11:/volume1/docker/comm-service/
```

### Step 4: Deploy on NAS

```bash
# SSH into NAS
ssh k2600x@192.168.1.11
cd /volume1/docker/comm-service

# Verify image integrity
sha256sum -c comm-service-v0.1-prod.sha256

# Load Docker image
docker load < comm-service-v0.1-prod.tar.gz

# Extract deployment package
tar -xzf deployment-package.tar.gz

# Set permissions
chmod +x scripts/*.sh

# Deploy using script
./scripts/deploy.sh
```

### Step 5: Verify Deployment

```bash
# Check service health
curl http://localhost:8080/health

# View logs
docker logs comm-service --tail 50

# Check Redis connectivity
docker exec comm-redis redis-cli ping

# Test Telegram bot
curl -X POST http://localhost:8080/v1/messages/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "telegram",
    "template_key": "test",
    "data": {"message": "Deployment successful!"},
    "to": {"telegram_chat_id": YOUR_CHAT_ID}
  }'
```

---

## Local Development

### Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Start Redis locally
docker run -d --name redis-dev -p 6379:6379 redis:7-alpine

# Start development server
npm run start:dev

# Access API documentation
open http://localhost:8080/api-docs
```

### Docker Compose Development

```bash
# Start all services
docker-compose up -d

# Watch logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

## Production Configuration

### Environment Variables

Create `.env.production` with the following:

```env
# Application
NODE_ENV=production
PORT=8080
LOG_LEVEL=info

# Redis - Use internal Docker network
REDIS_URL=redis://comm-redis:6379

# Telegram
TELEGRAM_BOT_TOKEN=your-production-bot-token
ADMINS_TELEGRAM_IDS=123456789,987654321

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-production-email@gmail.com
SMTP_PASS=your-app-specific-password
EMAIL_FROM=noreply@your-domain.com

# Security - CHANGE THESE!
JWT_SECRET=generate-a-strong-random-string-here
JWT_EXPIRATION=1h
MAGIC_LINK_TTL=300

# Service URLs - Update with your service addresses
SERVICE_URLS_TRADING=http://trading-service:3001
SERVICE_URLS_FINANCIAL=http://financial-service:3002
SERVICE_URLS_AI=http://ai-service:3003
SERVICE_URLS_MEMORY=http://memory-service:3004

# Webhook
WEBHOOK_TIMEOUT=10000
WEBHOOK_MAX_RETRIES=3
```

### Security Checklist

- [ ] Generate strong JWT_SECRET (min 32 characters)
- [ ] Configure Telegram admin IDs
- [ ] Set up app-specific password for Gmail
- [ ] Enable Synology firewall
- [ ] Restrict Redis to internal network
- [ ] Configure SSL/TLS for external access
- [ ] Regular security updates
- [ ] Enable audit logging

---

## Monitoring & Maintenance

### Health Monitoring

The service provides health endpoints:

```bash
# Basic health check
curl http://192.168.1.11:8080/health

# Detailed metrics (requires auth)
curl http://192.168.1.11:8080/v1/metrics \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Log Management

Logs are stored in `/volume1/docker/comm-service/logs/`

```bash
# View recent logs
tail -f /volume1/docker/comm-service/logs/combined.log

# View error logs only
grep ERROR /volume1/docker/comm-service/logs/error.log

# Rotate logs (add to cron)
./scripts/rotate-logs.sh
```

### Performance Monitoring

```bash
# Check container stats
docker stats comm-service comm-redis

# Monitor Redis
docker exec comm-redis redis-cli INFO stats

# Check disk usage
df -h /volume1/docker/comm-service
```

---

## Troubleshooting

### Common Issues

#### 1. Service Won't Start

```bash
# Check logs
docker logs comm-service

# Verify environment variables
docker exec comm-service env | grep -E "NODE_ENV|REDIS"

# Test Redis connection
docker exec comm-service nc -zv comm-redis 6379
```

#### 2. Telegram Bot Not Responding

```bash
# Verify bot token
curl https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe

# Check webhook status
docker exec comm-service curl localhost:8080/health

# Review Telegram logs
docker logs comm-service | grep -i telegram
```

#### 3. Email Not Sending

```bash
# Test SMTP connection
docker exec comm-service nc -zv smtp.gmail.com 587

# Check email configuration
docker exec comm-service env | grep SMTP

# Review email logs
docker logs comm-service | grep -i email
```

#### 4. Redis Connection Issues

```bash
# Check Redis is running
docker ps | grep redis

# Test Redis connectivity
docker exec comm-redis redis-cli ping

# Check Redis memory
docker exec comm-redis redis-cli INFO memory
```

### Debug Mode

Enable debug logging:

```bash
# Set in .env.production
LOG_LEVEL=debug

# Restart service
docker restart comm-service

# Watch debug logs
docker logs -f comm-service
```

---

## Backup & Recovery

### Automated Backups

Backups run daily at 2 AM via Synology Task Scheduler:

```bash
# Manual backup
./scripts/backup.sh

# Verify backup
ls -la /volume1/docker/comm-service/backups/
```

### Backup Contents

- Redis data (AOF and RDB files)
- Application logs
- Configuration files
- Audit logs

### Recovery Process

#### Full Recovery

```bash
# Stop services
docker stop comm-service comm-redis

# Restore Redis data
cp /volume1/docker/comm-service/backups/redis-YYYYMMDD.rdb \
   /volume1/docker/comm-service/data/redis/dump.rdb

# Restore configuration
cp /volume1/docker/comm-service/backups/config-YYYYMMDD.tar.gz .
tar -xzf config-YYYYMMDD.tar.gz

# Restart services
docker start comm-redis
sleep 5
docker start comm-service
```

#### Partial Recovery (Redis only)

```bash
# Connect to Redis
docker exec -it comm-redis redis-cli

# Flush current data (CAREFUL!)
FLUSHALL

# Restore from backup
docker exec comm-redis redis-cli --rdb /data/dump.rdb
```

### Disaster Recovery Plan

1. **Regular Backups**: Daily automated backups with 7-day retention
2. **Off-site Backup**: Weekly sync to external storage
3. **Version Control**: Keep last 3 Docker image versions
4. **Documentation**: Maintain deployment logs and configuration history
5. **Testing**: Monthly recovery drill

---

## Update Process

### Rolling Update

```bash
# Build new version
docker build -t comm-service:v0.2-prod .

# Save and transfer
docker save comm-service:v0.2-prod | gzip > comm-service-v0.2-prod.tar.gz
scp comm-service-v0.2-prod.tar.gz k2600x@192.168.1.11:/volume1/docker/comm-service/

# On NAS - Load new image
docker load < comm-service-v0.2-prod.tar.gz

# Backup current state
./scripts/backup.sh

# Update with zero downtime
docker run -d --name comm-service-new \
  --env-file .env.production \
  -v /volume1/docker/comm-service/logs:/app/logs \
  -v /volume1/docker/comm-service/data/audit:/app/audit \
  --network comm-network \
  comm-service:v0.2-prod

# Test new instance
curl http://localhost:8081/health

# If successful, switch over
docker stop comm-service
docker rm comm-service
docker rename comm-service-new comm-service
docker run -d -p 8080:8080 --name comm-service ...
```

### Rollback Process

```bash
# Stop current version
docker stop comm-service

# Start previous version
docker run -d --name comm-service \
  --env-file .env.production \
  -p 8080:8080 \
  ... \
  comm-service:v0.1-prod
```

---

## Network Architecture

```
Internet
    │
    ├── Telegram API (HTTPS)
    ├── Email SMTP (TLS)
    │
Synology NAS (192.168.1.11)
    │
    ├── Reverse Proxy (nginx)
    │   └── SSL Termination
    │
    ├── Docker Network (comm-network)
    │   ├── comm-service:8080
    │   └── comm-redis:6379
    │
    └── Persistent Storage
        ├── /volume1/docker/comm-service/data/
        ├── /volume1/docker/comm-service/logs/
        └── /volume1/docker/comm-service/backups/
```

---

## Support & Contact

- **Documentation**: This file and README.md
- **API Docs**: http://192.168.1.11:8080/api-docs
- **Logs**: `/volume1/docker/comm-service/logs/`
- **Backups**: `/volume1/docker/comm-service/backups/`

For issues, check logs first, then refer to troubleshooting section.