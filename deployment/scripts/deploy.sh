#!/bin/bash

# ============================================
# Comm-Service Deployment Script
# For Synology NAS deployment
# ============================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAS_USER="k2600x"
NAS_HOST="192.168.1.11"
NAS_PATH="/volume1/docker/comm-service"
SERVICE_NAME="comm-service"
REDIS_NAME="comm-redis"
NETWORK_NAME="comm-network"
IMAGE_TAG="v0.1-prod"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_requirements() {
    log_info "Checking requirements..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check if .env.production exists
    if [ ! -f ".env.production" ]; then
        log_error ".env.production not found. Please create it from .env.production template"
        exit 1
    fi
    
    # Check if docker-compose.prod.yml exists
    if [ ! -f "docker-compose.prod.yml" ]; then
        log_error "docker-compose.prod.yml not found"
        exit 1
    fi
    
    log_success "All requirements met"
}

build_image() {
    log_info "Building Docker image..."
    
    # Build the production image
    docker build -t ${SERVICE_NAME}:${IMAGE_TAG} . || {
        log_error "Failed to build Docker image"
        exit 1
    }
    
    log_success "Docker image built: ${SERVICE_NAME}:${IMAGE_TAG}"
}

prepare_deployment_package() {
    log_info "Preparing deployment package..."
    
    # Create temp directory
    TEMP_DIR=$(mktemp -d)
    
    # Copy necessary files
    cp docker-compose.prod.yml ${TEMP_DIR}/
    cp .env.production ${TEMP_DIR}/.env
    cp -r scripts ${TEMP_DIR}/
    cp openapi.yaml ${TEMP_DIR}/ 2>/dev/null || true
    
    # Create Redis config
    cat > ${TEMP_DIR}/redis.conf <<EOF
# Redis Configuration for Comm-Service
bind 0.0.0.0
protected-mode no
port 6379
tcp-backlog 511
timeout 0
tcp-keepalive 300

# Persistence
dir /data
dbfilename dump.rdb
appendonly yes
appendfilename "comm-service.aof"
appendfsync everysec
no-appendfsync-on-rewrite no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb

# Memory Management
maxmemory 512mb
maxmemory-policy allkeys-lru

# Logging
loglevel notice
logfile ""

# Performance
rdbcompression yes
rdbchecksum yes
stop-writes-on-bgsave-error yes
EOF
    
    # Save Docker image
    log_info "Saving Docker image..."
    docker save ${SERVICE_NAME}:${IMAGE_TAG} | gzip > ${TEMP_DIR}/${SERVICE_NAME}-${IMAGE_TAG}.tar.gz
    
    # Calculate checksum
    sha256sum ${TEMP_DIR}/${SERVICE_NAME}-${IMAGE_TAG}.tar.gz > ${TEMP_DIR}/${SERVICE_NAME}-${IMAGE_TAG}.sha256
    
    log_success "Deployment package prepared in ${TEMP_DIR}"
    echo ${TEMP_DIR}
}

deploy_local() {
    log_info "Deploying locally..."
    
    # Create network if it doesn't exist
    docker network create ${NETWORK_NAME} 2>/dev/null || true
    
    # Stop existing containers
    docker stop ${SERVICE_NAME} 2>/dev/null || true
    docker stop ${REDIS_NAME} 2>/dev/null || true
    docker rm ${SERVICE_NAME} 2>/dev/null || true
    docker rm ${REDIS_NAME} 2>/dev/null || true
    
    # Start with docker-compose
    docker-compose -f docker-compose.prod.yml up -d
    
    log_success "Services deployed locally"
}

deploy_to_nas() {
    log_info "Deploying to NAS ${NAS_HOST}..."
    
    TEMP_DIR=$(prepare_deployment_package)
    
    # Create deployment script for NAS
    cat > ${TEMP_DIR}/nas-deploy.sh <<'SCRIPT'
#!/bin/bash
set -e

echo "Starting NAS deployment..."

# Configuration
SERVICE_NAME="comm-service"
REDIS_NAME="comm-redis"
NETWORK_NAME="comm-network"
IMAGE_TAG="v0.1-prod"
NAS_PATH="/volume1/docker/comm-service"

# Create directories
mkdir -p ${NAS_PATH}/{config,data,logs,backups,scripts}
mkdir -p ${NAS_PATH}/data/{redis,audit}

# Copy files
cp redis.conf ${NAS_PATH}/config/
cp .env ${NAS_PATH}/
cp docker-compose.prod.yml ${NAS_PATH}/
cp -r scripts/* ${NAS_PATH}/scripts/
chmod +x ${NAS_PATH}/scripts/*.sh

# Load Docker image
echo "Loading Docker image..."
docker load < ${SERVICE_NAME}-${IMAGE_TAG}.tar.gz

# Verify checksum
sha256sum -c ${SERVICE_NAME}-${IMAGE_TAG}.sha256

# Create network
docker network create ${NETWORK_NAME} 2>/dev/null || true

# Stop existing containers
docker stop ${SERVICE_NAME} 2>/dev/null || true
docker stop ${REDIS_NAME} 2>/dev/null || true
docker rm ${SERVICE_NAME} 2>/dev/null || true
docker rm ${REDIS_NAME} 2>/dev/null || true

# Start services
cd ${NAS_PATH}
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to start
sleep 10

# Health check
if curl -f http://localhost:8080/health > /dev/null 2>&1; then
    echo "✅ Deployment successful!"
    docker ps | grep -E "${SERVICE_NAME}|${REDIS_NAME}"
else
    echo "❌ Health check failed"
    docker logs ${SERVICE_NAME} --tail 50
    exit 1
fi
SCRIPT
    
    chmod +x ${TEMP_DIR}/nas-deploy.sh
    
    # Transfer files to NAS
    log_info "Transferring files to NAS..."
    scp -r ${TEMP_DIR}/* ${NAS_USER}@${NAS_HOST}:~/comm-service-deploy/
    
    # Execute deployment on NAS
    log_info "Executing deployment on NAS..."
    ssh ${NAS_USER}@${NAS_HOST} "cd ~/comm-service-deploy && sudo bash nas-deploy.sh"
    
    # Cleanup
    rm -rf ${TEMP_DIR}
    
    log_success "Deployment to NAS completed"
}

health_check() {
    log_info "Running health check..."
    
    # Local health check
    if [ "$1" == "local" ]; then
        HEALTH_URL="http://localhost:8080/health"
    else
        HEALTH_URL="http://${NAS_HOST}:8080/health"
    fi
    
    if curl -f ${HEALTH_URL} > /dev/null 2>&1; then
        log_success "Health check passed"
        curl -s ${HEALTH_URL} | python3 -m json.tool 2>/dev/null || curl -s ${HEALTH_URL}
    else
        log_error "Health check failed"
        return 1
    fi
}

show_usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  build       - Build Docker image"
    echo "  local       - Deploy locally"
    echo "  nas         - Deploy to NAS"
    echo "  health      - Check service health"
    echo "  logs        - Show service logs"
    echo "  stop        - Stop services"
    echo "  restart     - Restart services"
    echo "  help        - Show this help"
    echo ""
}

# Main execution
case "$1" in
    build)
        check_requirements
        build_image
        ;;
    local)
        check_requirements
        build_image
        deploy_local
        sleep 5
        health_check local
        ;;
    nas)
        check_requirements
        build_image
        deploy_to_nas
        health_check nas
        ;;
    health)
        health_check ${2:-local}
        ;;
    logs)
        docker logs -f ${SERVICE_NAME} --tail 100
        ;;
    stop)
        docker-compose -f docker-compose.prod.yml down
        log_success "Services stopped"
        ;;
    restart)
        docker-compose -f docker-compose.prod.yml restart
        log_success "Services restarted"
        ;;
    help|*)
        show_usage
        ;;
esac