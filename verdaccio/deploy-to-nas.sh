#!/bin/bash

# Verdaccio deployment script for NAS
# This script deploys Verdaccio to your NAS at 192.168.1.11

set -e

# Configuration
NAS_HOST="192.168.1.11"
NAS_USER="${NAS_USER:-k2600x}"
VERDACCIO_DIR="/volume1/docker/verdaccio"
PACKAGE_NAME="verdaccio-deploy.tar.gz"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Verdaccio NAS Deployment Script ===${NC}"
echo ""

# Function to check SSH connectivity
check_ssh() {
    echo -e "${YELLOW}Checking SSH connectivity to NAS...${NC}"
    if ssh -o ConnectTimeout=5 ${NAS_USER}@${NAS_HOST} "echo 'SSH connection successful'" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ SSH connection successful${NC}"
        return 0
    else
        echo -e "${RED}✗ Cannot connect to NAS via SSH${NC}"
        echo -e "${YELLOW}Please ensure:${NC}"
        echo "  1. SSH is enabled on your NAS"
        echo "  2. You have SSH key configured or will enter password"
        echo "  3. The NAS is accessible at ${NAS_HOST}"
        return 1
    fi
}

# Create deployment package
create_package() {
    echo -e "${YELLOW}Creating deployment package...${NC}"
    
    # Create package with Verdaccio files
    tar -czf ${PACKAGE_NAME} \
        docker-compose.yml \
        conf/ \
        deploy-to-nas.sh \
        setup-users.sh \
        ../publish-sdk.sh \
        2>/dev/null || true
    
    echo -e "${GREEN}✓ Package created: ${PACKAGE_NAME}${NC}"
}

# Deploy to NAS
deploy_to_nas() {
    echo -e "${YELLOW}Deploying to NAS...${NC}"
    
    # Create directory on NAS
    echo "Creating Verdaccio directory on NAS..."
    ssh ${NAS_USER}@${NAS_HOST} "mkdir -p ${VERDACCIO_DIR}"
    
    # Copy package to NAS
    echo "Copying files to NAS..."
    scp ${PACKAGE_NAME} ${NAS_USER}@${NAS_HOST}:${VERDACCIO_DIR}/
    
    # Extract and setup on NAS
    echo "Setting up Verdaccio on NAS..."
    ssh ${NAS_USER}@${NAS_HOST} << EOF
        cd ${VERDACCIO_DIR}
        tar -xzf ${PACKAGE_NAME}
        rm ${PACKAGE_NAME}
        
        # Create necessary directories
        mkdir -p storage plugins conf
        
        # Set permissions
        chmod 755 setup-users.sh
        
        echo -e "${GREEN}Files deployed to ${VERDACCIO_DIR}${NC}"
EOF
    
    echo -e "${GREEN}✓ Deployment complete${NC}"
}

# Start Verdaccio on NAS
start_verdaccio() {
    echo -e "${YELLOW}Starting Verdaccio on NAS...${NC}"
    
    ssh ${NAS_USER}@${NAS_HOST} << 'EOF'
        cd /volume1/docker/verdaccio
        
        # Check if Docker is available
        if ! command -v docker &> /dev/null; then
            echo "Docker is not installed on the NAS"
            echo "Please install Docker from Package Center first"
            exit 1
        fi
        
        # Check if Verdaccio is already running
        if docker ps | grep -q verdaccio; then
            echo "Verdaccio is already running. Restarting..."
            docker-compose down
        fi
        
        # Start Verdaccio
        docker-compose up -d
        
        # Wait for startup
        echo "Waiting for Verdaccio to start..."
        sleep 5
        
        # Check if running
        if docker ps | grep -q verdaccio; then
            echo "✓ Verdaccio is running"
            docker ps | grep verdaccio
        else
            echo "✗ Failed to start Verdaccio"
            docker-compose logs
            exit 1
        fi
EOF
    
    echo -e "${GREEN}✓ Verdaccio started successfully${NC}"
}

# Main execution
main() {
    echo -e "${BLUE}Starting Verdaccio deployment to NAS${NC}"
    echo ""
    
    # Check prerequisites
    if ! check_ssh; then
        exit 1
    fi
    
    # Create and deploy package
    create_package
    deploy_to_nas
    
    # Ask if user wants to start Verdaccio
    echo ""
    read -p "Do you want to start Verdaccio now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        start_verdaccio
        
        echo ""
        echo -e "${GREEN}=== Verdaccio is now running on your NAS ===${NC}"
        echo -e "${BLUE}Web UI:${NC} http://${NAS_HOST}:4873"
        echo -e "${BLUE}Registry URL:${NC} http://${NAS_HOST}:4873"
        echo ""
        echo -e "${YELLOW}To create your first user:${NC}"
        echo "  1. SSH to NAS: ssh ${NAS_USER}@${NAS_HOST}"
        echo "  2. cd ${VERDACCIO_DIR}"
        echo "  3. ./setup-users.sh"
        echo ""
        echo -e "${YELLOW}To publish the SDK:${NC}"
        echo "  cd .. && ./publish-sdk.sh"
    else
        echo ""
        echo -e "${YELLOW}To start Verdaccio later:${NC}"
        echo "  1. SSH to NAS: ssh ${NAS_USER}@${NAS_HOST}"
        echo "  2. cd ${VERDACCIO_DIR}"
        echo "  3. docker-compose up -d"
    fi
    
    echo ""
    echo -e "${GREEN}Deployment complete!${NC}"
}

# Run main function
main "$@"