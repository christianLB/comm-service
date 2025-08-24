#!/bin/bash

# ============================================
# Comm-Service NAS Deployment Script
# For Synology NAS at 192.168.1.11
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SERVICE_NAME="comm-service"
REDIS_NAME="comm-redis"
NETWORK_NAME="comm-network"
IMAGE_TAG="v0.2-prod"
NAS_PATH="/volume1/docker/comm-service"

echo -e "${BLUE}Starting Comm-Service deployment on NAS...${NC}"

# Create directories
echo -e "${YELLOW}Creating directories...${NC}"
sudo mkdir -p ${NAS_PATH}/{config,data,logs,backups,scripts}
sudo mkdir -p ${NAS_PATH}/data/{redis,audit}
sudo chown -R k2600x:users ${NAS_PATH}

# Copy files
echo -e "${YELLOW}Copying configuration files...${NC}"
cp -r config/* ${NAS_PATH}/config/
cp .env ${NAS_PATH}/
cp docker-compose.prod.yml ${NAS_PATH}/
cp -r scripts/* ${NAS_PATH}/scripts/
chmod +x ${NAS_PATH}/scripts/*.sh

# Load Docker image
echo -e "${YELLOW}Loading Docker image...${NC}"
docker load < ${SERVICE_NAME}-${IMAGE_TAG}.tar.gz

# Verify checksum
echo -e "${YELLOW}Verifying image integrity...${NC}"
sha256sum -c ${SERVICE_NAME}-${IMAGE_TAG}.sha256

# Create network
echo -e "${YELLOW}Creating Docker network...${NC}"
docker network create ${NETWORK_NAME} 2>/dev/null || true

# Stop existing containers
echo -e "${YELLOW}Stopping existing containers...${NC}"
docker stop ${SERVICE_NAME} 2>/dev/null || true
docker stop ${REDIS_NAME} 2>/dev/null || true
docker rm ${SERVICE_NAME} 2>/dev/null || true
docker rm ${REDIS_NAME} 2>/dev/null || true

# Start Redis
echo -e "${YELLOW}Starting Redis...${NC}"
docker run -d \
  --name ${REDIS_NAME} \
  --network ${NETWORK_NAME} \
  --restart unless-stopped \
  -v ${NAS_PATH}/data/redis:/data \
  -v ${NAS_PATH}/config/redis.conf:/usr/local/etc/redis/redis.conf:ro \
  redis:7-alpine redis-server /usr/local/etc/redis/redis.conf

# Wait for Redis
sleep 5

# Start Comm-Service
echo -e "${YELLOW}Starting Comm-Service...${NC}"
docker run -d \
  --name ${SERVICE_NAME} \
  --network ${NETWORK_NAME} \
  --restart unless-stopped \
  --env-file ${NAS_PATH}/.env \
  -e REDIS_URL=redis://${REDIS_NAME}:6379 \
  -v ${NAS_PATH}/logs:/app/logs \
  -v ${NAS_PATH}/data/audit:/app/audit \
  -p 8080:8080 \
  ${SERVICE_NAME}:${IMAGE_TAG}

# Wait for service to start
echo -e "${YELLOW}Waiting for service to start...${NC}"
sleep 15

# Health check
echo -e "${YELLOW}Running health check...${NC}"
if curl -f http://localhost:8080/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo ""
    docker ps | grep -E "${SERVICE_NAME}|${REDIS_NAME}"
    echo ""
    echo -e "${GREEN}Service is running at: http://192.168.1.11:8080${NC}"
    echo -e "${GREEN}API Docs: http://192.168.1.11:8080/api-docs${NC}"
else
    echo -e "${RED}❌ Health check failed${NC}"
    echo "Checking logs..."
    docker logs ${SERVICE_NAME} --tail 50
    exit 1
fi

# Set up cron job for backups
echo -e "${YELLOW}Setting up automated backups...${NC}"
(crontab -l 2>/dev/null; echo "0 2 * * * ${NAS_PATH}/scripts/backup.sh") | crontab -

echo -e "${GREEN}✅ Deployment complete!${NC}"