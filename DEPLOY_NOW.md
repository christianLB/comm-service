# 🚀 Deploy Comm-Service to Synology NAS

## Step 1: Transfer to NAS

From your local machine:

```bash
# Transfer the deployment package
scp comm-service-deploy.tar.gz k2600x@192.168.1.11:~/

# Or if you're on the same network, you might prefer:
rsync -avz --progress comm-service-deploy.tar.gz k2600x@192.168.1.11:~/
```

## Step 2: Deploy on NAS

SSH into your NAS and run:

```bash
# Connect to NAS
ssh k2600x@192.168.1.11

# Extract deployment package
tar -xzf comm-service-deploy.tar.gz

# Move to deployment directory
cd deployment

# Run deployment script
sudo bash nas-deploy.sh
```

## Step 3: Verify Deployment

After deployment completes:

```bash
# Check service health (use v1 endpoint!)
curl http://localhost:8080/v1/health

# View running containers
sudo /usr/local/bin/docker ps

# Check logs if needed
sudo /usr/local/bin/docker logs comm-service --tail 50

# Test Telegram bot (if configured)
# Go to Telegram and message your bot with /start
# Available commands: /ping, /health, /services, /help
```

## Step 4: Access Services

- **API**: http://192.168.1.11:8080
- **API Docs**: http://192.168.1.11:8080/api-docs
- **Health Check**: http://192.168.1.11:8080/health

## Step 5: Monitor Services

```bash
# Real-time monitoring
cd /volume1/docker/comm-service
./scripts/monitor.sh live

# Check backup status
./scripts/backup.sh
```

## Troubleshooting

If the service doesn't start properly:

1. **Check environment variables**:
   ```bash
   cat /volume1/docker/comm-service/.env
   ```

2. **Check Redis connection**:
   ```bash
   docker exec comm-redis redis-cli ping
   ```

3. **View detailed logs**:
   ```bash
   docker logs comm-service --tail 100
   ```

4. **Restart services**:
   ```bash
   docker restart comm-service comm-redis
   ```

## Important Notes

- The service is currently configured with your Telegram bot token
- Admin Telegram ID is set to: 50152555379
- Email service needs SMTP configuration (update in .env)
- JWT secret should be changed in production (generate with: `openssl rand -hex 32`)

## Next Steps

1. Test Telegram bot integration
2. Configure email settings if needed
3. Set up service URLs for your microservices
4. Enable automated backups (already configured in cron)
5. Monitor service health regularly

## Service Management

```bash
# Stop services
sudo /usr/local/bin/docker stop comm-service comm-redis

# Start services
sudo /usr/local/bin/docker start comm-redis
sudo /usr/local/bin/docker start comm-service

# Restart services
sudo /usr/local/bin/docker restart comm-service comm-redis

# View logs
sudo /usr/local/bin/docker logs -f comm-service

# Backup data
/volume1/docker/comm-service/scripts/backup.sh

# Restore from backup
/volume1/docker/comm-service/scripts/restore.sh
```

## Common Deployment Issues

### Issue: Service won't start
```bash
# Check if port 8080 is already in use
sudo netstat -tlnp | grep 8080

# Check Docker logs for errors
sudo /usr/local/bin/docker logs comm-service --tail 100
```

### Issue: Telegram bot not responding
```bash
# Check if Telegram is enabled
sudo /usr/local/bin/docker exec comm-service env | grep TELEGRAM

# Check admin IDs configuration
sudo /usr/local/bin/docker logs comm-service | grep "Admin IDs configured"

# See access attempts
sudo /usr/local/bin/docker logs comm-service | grep "Telegram access attempt"
```

### Issue: Health check fails
```bash
# Make sure to use v1 endpoint
curl http://192.168.1.11:8080/v1/health

# Check Redis connection
sudo /usr/local/bin/docker exec comm-redis redis-cli ping
```