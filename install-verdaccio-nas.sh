#!/bin/bash

# Quick Verdaccio installer for NAS
# Run this to install Verdaccio on your NAS with one command

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Verdaccio NAS Quick Installer       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Configuration
NAS_HOST="192.168.1.11"
NAS_USER="${NAS_USER:-k2600x}"

echo -e "${YELLOW}This will install Verdaccio on your NAS at ${NAS_HOST}${NC}"
echo -e "${YELLOW}Prerequisites:${NC}"
echo "  • Docker must be installed on your NAS"
echo "  • SSH access to your NAS"
echo ""

read -p "Continue with installation? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Installation cancelled"
    exit 0
fi

echo ""
echo -e "${GREEN}Step 1: Deploying Verdaccio to NAS${NC}"
cd verdaccio && ./deploy-to-nas.sh

echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}Installation Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Verdaccio is now available at:${NC}"
echo "  Web UI: http://${NAS_HOST}:4873"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Create a user account:"
echo "   npm adduser --registry http://${NAS_HOST}:4873/"
echo ""
echo "2. Publish the SDK:"
echo "   ./publish-sdk.sh"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"