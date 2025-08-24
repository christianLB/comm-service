#!/bin/bash

# ============================================
# Quick Deploy Script for Comm-Service
# Automates build, save, transfer, and deploy
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
NAS_HOST="192.168.1.11"
NAS_USER="k2600x"
SERVICE_NAME="comm-service"
REDIS_NAME="comm-redis"
NAS_PATH="/volume1/docker/comm-service"

# Get version from argument or use timestamp
VERSION=${1:-"v$(date +%Y%m%d-%H%M%S)"}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Comm-Service Quick Deploy${NC}"
echo -e "${BLUE}Version: ${VERSION}${NC}"
echo -e "${BLUE}========================================${NC}"

# Step 1: Build
echo -e "\n${YELLOW}[1/6] Building application...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Build successful${NC}"

# Step 2: Build Docker image
echo -e "\n${YELLOW}[2/6] Building Docker image...${NC}"
docker build -t ${SERVICE_NAME}:${VERSION} .
if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Docker build failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker image built: ${SERVICE_NAME}:${VERSION}${NC}"

# Step 3: Save Docker image
echo -e "\n${YELLOW}[3/6] Saving Docker image...${NC}"
docker save ${SERVICE_NAME}:${VERSION} | gzip > deployment/${SERVICE_NAME}-${VERSION}.tar.gz
if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Failed to save Docker image${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Image saved to deployment/${SERVICE_NAME}-${VERSION}.tar.gz${NC}"

# Step 4: Transfer to NAS
echo -e "\n${YELLOW}[4/6] Transferring to NAS...${NC}"
scp deployment/${SERVICE_NAME}-${VERSION}.tar.gz ${NAS_USER}@${NAS_HOST}:~/
if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Transfer failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Image transferred to NAS${NC}"

# Step 5: Load image on NAS
echo -e "\n${YELLOW}[5/6] Loading image on NAS...${NC}"
ssh ${NAS_USER}@${NAS_HOST} "sudo /usr/local/bin/docker load < ~/${SERVICE_NAME}-${VERSION}.tar.gz"
if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Failed to load image on NAS${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Image loaded on NAS${NC}"

# Step 6: Deploy container
echo -e "\n${YELLOW}[6/6] Deploying container...${NC}"

# Check if .env.production exists and transfer it
if [ -f ".env.production" ]; then
    echo -e "${YELLOW}  Updating .env file on NAS...${NC}"
    scp .env.production ${NAS_USER}@${NAS_HOST}:${NAS_PATH}/.env
fi

# Stop and remove old container
ssh ${NAS_USER}@${NAS_HOST} "sudo /usr/local/bin/docker stop ${SERVICE_NAME} 2>/dev/null || true"
ssh ${NAS_USER}@${NAS_HOST} "sudo /usr/local/bin/docker rm ${SERVICE_NAME} 2>/dev/null || true"

# Start new container
ssh ${NAS_USER}@${NAS_HOST} "sudo /usr/local/bin/docker run -d \
  --name ${SERVICE_NAME} \
  --network comm-network \
  --restart unless-stopped \
  --env-file ${NAS_PATH}/.env \
  -e REDIS_URL=redis://${REDIS_NAME}:6379 \
  -e ENABLE_TELEGRAM=true \
  -e PORT=8080 \
  -e NODE_ENV=production \
  -v ${NAS_PATH}/logs:/app/logs \
  -v ${NAS_PATH}/data/audit:/app/audit \
  -p 8080:8080 \
  ${SERVICE_NAME}:${VERSION}"

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Failed to start container${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Container deployed${NC}"

# Wait for service to start
echo -e "\n${YELLOW}Waiting for service to start...${NC}"
sleep 10

# Health check
echo -e "${YELLOW}Running health check...${NC}"
HEALTH=$(curl -s http://${NAS_HOST}:8080/v1/health | jq -r '.status' 2>/dev/null || echo "failed")

if [ "$HEALTH" = "healthy" ]; then
    echo -e "${GREEN}✓ Service is healthy!${NC}"
    
    # Show service info
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}Deployment Successful!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "Service URL: ${BLUE}http://${NAS_HOST}:8080${NC}"
    echo -e "API Docs: ${BLUE}http://${NAS_HOST}:8080/api-docs${NC}"
    echo -e "Health: ${BLUE}http://${NAS_HOST}:8080/v1/health${NC}"
    echo -e "Version: ${BLUE}${VERSION}${NC}"
    
    # Check Telegram status
    TELEGRAM_STATUS=$(ssh ${NAS_USER}@${NAS_HOST} "sudo /usr/local/bin/docker logs ${SERVICE_NAME} 2>&1 | grep 'Telegram bot' | tail -1")
    if [[ $TELEGRAM_STATUS == *"successfully"* ]]; then
        echo -e "Telegram: ${GREEN}✓ Bot is running${NC}"
    else
        echo -e "Telegram: ${YELLOW}⚠ Check bot status${NC}"
    fi
else
    echo -e "${RED}✗ Health check failed${NC}"
    echo -e "${YELLOW}Checking logs...${NC}"
    ssh ${NAS_USER}@${NAS_HOST} "sudo /usr/local/bin/docker logs ${SERVICE_NAME} --tail 20"
    exit 1
fi

# Cleanup old images (optional)
echo -e "\n${YELLOW}Cleanup old images? (y/n)${NC}"
read -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Removing old deployment files...${NC}"
    rm -f deployment/${SERVICE_NAME}-*.tar.gz
    ssh ${NAS_USER}@${NAS_HOST} "rm -f ~/${SERVICE_NAME}-*.tar.gz"
    echo -e "${GREEN}✓ Cleanup complete${NC}"
fi

echo -e "\n${GREEN}Deployment complete!${NC}"