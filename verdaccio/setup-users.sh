#!/bin/bash

# Verdaccio user setup script
# Run this on the NAS after Verdaccio is installed

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Verdaccio User Setup ===${NC}"
echo ""

# Function to add user
add_user() {
    local username=$1
    local password=$2
    
    echo -e "${YELLOW}Adding user: ${username}${NC}"
    
    # Use npm-cli-login or verdaccio htpasswd
    docker exec -it verdaccio /bin/sh -c "
        cd /verdaccio/conf
        if [ ! -f htpasswd ]; then
            touch htpasswd
        fi
        htpasswd -bB htpasswd '${username}' '${password}'
    " 2>/dev/null || {
        # Fallback: create htpasswd file manually
        docker exec -it verdaccio /bin/sh -c "
            apk add --no-cache apache2-utils 2>/dev/null || true
            htpasswd -bBc /verdaccio/conf/htpasswd '${username}' '${password}'
        "
    }
    
    echo -e "${GREEN}✓ User ${username} added${NC}"
}

# Function to login and get token
login_user() {
    local username=$1
    local password=$2
    
    echo -e "${YELLOW}Logging in as ${username}...${NC}"
    
    # Login using npm
    npm_commands="
npm config set registry http://localhost:4873/
npm login --registry=http://localhost:4873/ <<EOF
${username}
${password}
${username}@k2600x.local
EOF
"
    
    docker exec -it verdaccio /bin/sh -c "${npm_commands}" 2>/dev/null || {
        echo -e "${YELLOW}Manual login required${NC}"
        echo "Run on your local machine:"
        echo "  npm login --registry=http://192.168.1.11:4873/"
        echo "  Username: ${username}"
        echo "  Password: ${password}"
    }
}

# Main setup
main() {
    # Check if Verdaccio is running
    if ! docker ps | grep -q verdaccio; then
        echo -e "${RED}Verdaccio is not running!${NC}"
        echo "Please start Verdaccio first: docker-compose up -d"
        exit 1
    fi
    
    echo "This script will help you create users for Verdaccio"
    echo ""
    
    # Default user creation
    read -p "Do you want to create the default 'k2600x' user? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -sp "Enter password for k2600x user: " password
        echo ""
        add_user "k2600x" "${password}"
        
        # Generate .npmrc content
        echo ""
        echo -e "${GREEN}=== Configuration for .npmrc ===${NC}"
        echo "Add this to your project's .npmrc file:"
        echo ""
        echo "registry=http://192.168.1.11:4873"
        echo ""
        echo "Then run: npm login --registry=http://192.168.1.11:4873/"
        echo ""
    fi
    
    # Additional users
    while true; do
        read -p "Do you want to add another user? (y/n) " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            break
        fi
        
        read -p "Username: " username
        read -sp "Password: " password
        echo ""
        add_user "${username}" "${password}"
    done
    
    echo ""
    echo -e "${GREEN}=== Setup Complete ===${NC}"
    echo ""
    echo -e "${BLUE}Verdaccio Web UI:${NC} http://192.168.1.11:4873"
    echo ""
    echo -e "${YELLOW}To use this registry in your projects:${NC}"
    echo "1. Add to .npmrc:"
    echo "   registry=http://192.168.1.11:4873"
    echo ""
    echo "2. Login:"
    echo "   npm login --registry=http://192.168.1.11:4873/"
    echo ""
    echo "3. Publish packages:"
    echo "   npm publish --registry=http://192.168.1.11:4873"
    echo ""
    echo -e "${YELLOW}To publish scoped packages:${NC}"
    echo "   npm publish --access public --registry=http://192.168.1.11:4873"
}

# Run main
main "$@"