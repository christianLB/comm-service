#!/bin/bash
set -e

echo "🚀 Deploying Comm Service to NAS..."

# Configuration
NAS_HOST="192.168.1.11"
NAS_USER="admin"
DEPLOY_DIR="/volume1/docker/comm-service"
IMAGE_NAME="comm-service"
IMAGE_TAG="latest"

# Build the image
echo "📦 Building Docker image..."
npm run build
docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .

# Save the image
echo "💾 Saving Docker image..."
docker save ${IMAGE_NAME}:${IMAGE_TAG} | gzip > ${IMAGE_NAME}-${IMAGE_TAG}.tar.gz

# Copy to NAS
echo "📤 Copying to NAS..."
scp ${IMAGE_NAME}-${IMAGE_TAG}.tar.gz ${NAS_USER}@${NAS_HOST}:${DEPLOY_DIR}/

# Deploy on NAS
echo "🔧 Deploying on NAS..."
ssh ${NAS_USER}@${NAS_HOST} << 'ENDSSH'
cd /volume1/docker/comm-service

# Load the new image
echo "Loading Docker image..."
docker load < comm-service-latest.tar.gz

# Stop existing containers
echo "Stopping existing services..."
docker-compose down || true

# Start services
echo "Starting services..."
docker-compose up -d

# Clean up
rm comm-service-latest.tar.gz

# Check status
sleep 5
echo "✅ Deployment complete! Checking status..."
docker-compose ps
ENDSSH

# Clean up local tar
rm ${IMAGE_NAME}-${IMAGE_TAG}.tar.gz

echo "✨ Deployment to NAS complete!"
echo ""
echo "Service URL: http://${NAS_HOST}:8080"
echo "API Docs: http://${NAS_HOST}:8080/api-docs"
echo ""
echo "📝 For bank-sync-service, add these to .env:"
echo "COMM_SERVICE_URL=http://${NAS_HOST}:8080"
echo "COMM_SERVICE_TOKEN=<generated-token>"