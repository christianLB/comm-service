# Comm Service NAS Deployment

## Quick Start

1. **Copy files to NAS:**
   ```bash
   scp comm-service-latest.tar.gz admin@192.168.1.11:/volume1/docker/comm-service/
   scp nas-deployment/* admin@192.168.1.11:/volume1/docker/comm-service/
   ```

2. **SSH to NAS and configure:**
   ```bash
   ssh admin@192.168.1.11
   cd /volume1/docker/comm-service
   cp .env.example .env
   nano .env  # Edit with your actual values
   ```

3. **Load and start service:**
   ```bash
   docker load < comm-service-latest.tar.gz
   docker-compose down
   docker-compose up -d
   rm comm-service-latest.tar.gz
   ```

4. **Verify deployment:**
   ```bash
   docker-compose ps
   docker logs comm-service
   curl http://localhost:8080/v1/health
   ```

## Service URLs

- Health Check: http://192.168.1.11:8080/v1/health
- API Documentation: http://192.168.1.11:8080/api-docs
- Messages Endpoint: http://192.168.1.11:8080/v1/messages/send

## Bank Sync Integration

Add to bank-sync-service `.env`:

```bash
COMM_SERVICE_URL=http://192.168.1.11:8080
COMM_SERVICE_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzZXJ2aWNlIjoiYmFuay1zeW5jLXNlcnZpY2UiLCJwZXJtaXNzaW9ucyI6WyJtZXNzYWdlczpzZW5kIiwibm90aWZpY2F0aW9uczp0ZWxlZ3JhbSIsImV2ZW50czpwdWJsaXNoIl0sInR5cGUiOiJzZXJ2aWNlIiwiaWF0IjoxNzU2MDM2OTU0LCJhdWQiOlsiY29tbS1zZXJ2aWNlIiwidHJhZGluZy1zZXJ2aWNlIiwiZmluYW5jaWFsLXNlcnZpY2UiLCJhaS1zZXJ2aWNlIiwibWVtb3J5LXNlcnZpY2UiLCJnb2NhcmRsZXNzLXNlcnZpY2UiLCJ0ZXN0LXNlcnZpY2UiLCJiYW5rLXN5bmMtc2VydmljZSJdLCJpc3MiOiJjb21tLXNlcnZpY2UifQ.P59g1Ua_IBZQ_TP5OjSx2H1bVtpBg9H2gmDqPKRNrMo
```

## Troubleshooting

### Check logs
```bash
docker logs comm-service --tail 50
docker logs comm-redis --tail 50
```

### Restart services
```bash
docker-compose restart
```

### Check Redis connection
```bash
docker exec comm-redis redis-cli ping
```

### Test notification
```bash
TOKEN="your-token-here"
curl -X POST http://localhost:8080/v1/messages/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "telegram",
    "template_key": "test.message",
    "locale": "en",
    "data": {
      "title": "Test",
      "body": "This is a test message"
    },
    "to": {}
  }'
```

## Maintenance

### Update service
1. Build new image on development machine
2. Run `./deploy-manual.sh` to create new tar.gz
3. Follow deployment steps above

### Backup Redis data
```bash
docker exec comm-redis redis-cli BGSAVE
cp data/redis/dump.rdb backup/redis-$(date +%Y%m%d).rdb
```

### View metrics
```bash
docker stats comm-service comm-redis
```