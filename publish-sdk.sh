#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

VERDACCIO_URL="http://192.168.1.11:4873"
SDK_DIR="./sdk"

echo -e "${YELLOW}Checking Verdaccio availability at $VERDACCIO_URL...${NC}"

# Check if Verdaccio is accessible
if curl -f -s -o /dev/null "$VERDACCIO_URL"; then
    echo -e "${GREEN}✓ Verdaccio is accessible${NC}"
    
    # Build SDK
    echo -e "${YELLOW}Building SDK...${NC}"
    npm run sdk:build
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ SDK built successfully${NC}"
        
        # Publish to Verdaccio
        echo -e "${YELLOW}Publishing SDK to Verdaccio...${NC}"
        cd $SDK_DIR
        npm publish --registry $VERDACCIO_URL
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ SDK published successfully to Verdaccio!${NC}"
            echo -e "${GREEN}Package: @k2600x/comm-service-sdk${NC}"
            echo -e "${GREEN}Registry: $VERDACCIO_URL${NC}"
        else
            echo -e "${RED}✗ Failed to publish SDK to Verdaccio${NC}"
            exit 1
        fi
    else
        echo -e "${RED}✗ Failed to build SDK${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ Verdaccio is not accessible at $VERDACCIO_URL${NC}"
    echo -e "${YELLOW}Please ensure Verdaccio is running on your NAS${NC}"
    echo ""
    echo "To start Verdaccio on your NAS, you might need to:"
    echo "1. SSH into your NAS (ssh user@192.168.1.11)"
    echo "2. Start Verdaccio container if using Docker:"
    echo "   docker run -d --name verdaccio -p 4873:4873 verdaccio/verdaccio"
    echo "3. Or start Verdaccio directly if installed globally:"
    echo "   verdaccio --listen 0.0.0.0:4873"
    echo ""
    echo -e "${YELLOW}SDK has been generated and built locally in the ./sdk directory${NC}"
    echo -e "${YELLOW}You can publish it manually once Verdaccio is running:${NC}"
    echo "   cd sdk && npm publish --registry $VERDACCIO_URL"
    exit 1
fi