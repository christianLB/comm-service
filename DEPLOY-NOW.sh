#!/bin/bash
set -e

NAS_HOST="192.168.1.11"
NAS_USER="admin"
DEPLOY_DIR="/volume1/docker/comm-service"

echo "🚀 ONE-COMMAND DEPLOYMENT TO NAS"
echo "================================="
echo "Target: $NAS_USER@$NAS_HOST:$DEPLOY_DIR"
echo ""

# Build
echo "📦 Building..."
npm run build >/dev/null 2>&1
docker build -t comm-service:latest . >/dev/null 2>&1

# Package everything
echo "💾 Creating deployment package..."
docker save comm-service:latest | gzip > /tmp/comm.tar.gz

# Create remote script
cat > /tmp/run.sh << 'SCRIPT'
#!/bin/bash
cd /volume1/docker/comm-service
echo "Loading image..."
docker load < comm.tar.gz
echo "Stopping old containers..."
docker stop comm-service comm-redis 2>/dev/null || true
docker rm comm-service comm-redis 2>/dev/null || true
echo "Starting Redis..."
docker run -d --name comm-redis --restart unless-stopped \
  -v $(pwd)/data/redis:/data \
  redis:7-alpine redis-server --appendonly yes
sleep 2
echo "Starting Comm Service..."
docker run -d --name comm-service --restart unless-stopped \
  -p 8080:8080 \
  -v $(pwd)/logs:/app/logs \
  -e NODE_ENV=production \
  -e PORT=8080 \
  -e REDIS_URL=redis://comm-redis:6379 \
  -e TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-your-telegram-bot-token}" \
  -e ADMINS_TELEGRAM_IDS="${ADMINS_TELEGRAM_IDS:-123456789}" \
  -e ENABLE_TELEGRAM=true \
  -e JWT_SECRET="${JWT_SECRET:-your-super-secret-jwt-key-change-in-production}" \
  -e LOG_LEVEL=info \
  --link comm-redis:redis \
  comm-service:latest
rm comm.tar.gz run.sh
echo "✅ DEPLOYED!"
docker ps | grep comm
SCRIPT

# Deploy with single SSH session
echo "📤 Deploying to NAS (enter password when prompted)..."
cat /tmp/comm.tar.gz /tmp/run.sh | ssh $NAS_USER@$NAS_HOST "
  mkdir -p $DEPLOY_DIR && cd $DEPLOY_DIR
  cat > comm.tar.gz
  cat > run.sh
  bash run.sh
"

# Cleanup
rm /tmp/comm.tar.gz /tmp/run.sh

echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo "========================"
echo "✅ Service URL: http://$NAS_HOST:8080"
echo "📚 API Docs: http://$NAS_HOST:8080/api-docs"
echo "🔑 Bank-sync token in: BANK_SYNC_TOKEN.md"