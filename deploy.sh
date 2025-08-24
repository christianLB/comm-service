#!/bin/bash
set -e

echo "🚀 Deploying Comm Service to NAS (192.168.1.11)..."

# Build
npm run build
docker build -t comm-service:latest .

# Save image
docker save comm-service:latest | gzip > /tmp/comm-service.tar.gz

# Create deployment package
cat > /tmp/deploy-on-nas.sh << 'EOF'
#!/bin/bash
cd /volume1/docker/comm-service
docker load < comm-service.tar.gz
docker stop comm-service comm-redis 2>/dev/null || true
docker rm comm-service comm-redis 2>/dev/null || true
docker run -d --name comm-redis --network bridge -v $(pwd)/data/redis:/data redis:7-alpine redis-server --appendonly yes
sleep 2
docker run -d --name comm-service --network bridge -p 8080:8080 \
  -v $(pwd)/logs:/app/logs \
  -e NODE_ENV=production \
  -e PORT=8080 \
  -e REDIS_URL=redis://comm-redis:6379 \
  -e TELEGRAM_BOT_TOKEN="$TELEGRAM_BOT_TOKEN" \
  -e ADMINS_TELEGRAM_IDS="$ADMINS_TELEGRAM_IDS" \
  -e ENABLE_TELEGRAM=true \
  -e JWT_SECRET="$JWT_SECRET" \
  -e JWT_EXPIRATION=1h \
  -e LOG_LEVEL=info \
  --link comm-redis:redis \
  comm-service:latest
rm comm-service.tar.gz
echo "✅ Deployment complete!"
docker ps | grep comm
EOF

# Copy and execute
scp /tmp/comm-service.tar.gz admin@192.168.1.11:/volume1/docker/comm-service/
scp /tmp/deploy-on-nas.sh admin@192.168.1.11:/volume1/docker/comm-service/
ssh admin@192.168.1.11 "source /volume1/docker/comm-service/.env && bash /volume1/docker/comm-service/deploy-on-nas.sh"

# Cleanup
rm /tmp/comm-service.tar.gz /tmp/deploy-on-nas.sh

echo "✅ DONE! Service running at http://192.168.1.11:8080"