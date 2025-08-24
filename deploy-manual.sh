#!/bin/bash
set -e

echo "🚀 Preparing Comm Service for Manual Deployment to NAS..."

# Build the image
echo "📦 Building Docker image..."
npm run build
docker build -t comm-service:latest .

# Save the image
echo "💾 Saving Docker image..."
docker save comm-service:latest | gzip > comm-service-latest.tar.gz

echo "✅ Build complete!"
echo ""
echo "📋 Manual deployment steps:"
echo "=========================================="
echo "1. Copy the image to NAS:"
echo "   scp comm-service-latest.tar.gz admin@192.168.1.11:/volume1/docker/comm-service/"
echo ""
echo "2. SSH to NAS:"
echo "   ssh admin@192.168.1.11"
echo ""
echo "3. Load and run the service:"
echo "   cd /volume1/docker/comm-service"
echo "   docker load < comm-service-latest.tar.gz"
echo "   docker-compose down"
echo "   docker-compose up -d"
echo "   rm comm-service-latest.tar.gz"
echo ""
echo "4. Verify deployment:"
echo "   curl http://192.168.1.11:8080/v1/health"
echo "=========================================="
echo ""
echo "📦 Image saved to: comm-service-latest.tar.gz ($(du -h comm-service-latest.tar.gz | cut -f1))"