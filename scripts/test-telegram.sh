#!/bin/bash

# ============================================
# Telegram Bot Testing and Debugging Script
# Helps diagnose Telegram bot issues
# ============================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
NAS_HOST="${1:-192.168.1.11}"
NAS_USER="${2:-k2600x}"
SERVICE_NAME="comm-service"
LOCAL_MODE=false

# Check if running locally or on NAS
if [ "$NAS_HOST" = "local" ]; then
    LOCAL_MODE=true
    echo -e "${BLUE}Running in local mode${NC}"
else
    echo -e "${BLUE}Testing Telegram bot on NAS: ${NAS_HOST}${NC}"
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Telegram Bot Diagnostic Tool${NC}"
echo -e "${BLUE}========================================${NC}"

# Function to run Docker commands
run_docker() {
    if [ "$LOCAL_MODE" = true ]; then
        docker $@
    else
        ssh ${NAS_USER}@${NAS_HOST} "sudo /usr/local/bin/docker $@"
    fi
}

# Function to get service URL
get_service_url() {
    if [ "$LOCAL_MODE" = true ]; then
        echo "http://localhost:8080"
    else
        echo "http://${NAS_HOST}:8080"
    fi
}

# 1. Check if service is running
echo -e "\n${YELLOW}[1/7] Checking if service is running...${NC}"
CONTAINER_STATUS=$(run_docker ps --filter "name=${SERVICE_NAME}" --format "table {{.Status}}" | tail -n 1)
if [[ $CONTAINER_STATUS == *"Up"* ]]; then
    echo -e "${GREEN}✓ Container is running: ${CONTAINER_STATUS}${NC}"
else
    echo -e "${RED}✗ Container is not running${NC}"
    echo -e "${YELLOW}Starting container...${NC}"
    run_docker start ${SERVICE_NAME}
    sleep 5
fi

# 2. Check health endpoint
echo -e "\n${YELLOW}[2/7] Checking service health...${NC}"
HEALTH=$(curl -s $(get_service_url)/v1/health | jq -r '.status' 2>/dev/null || echo "failed")
if [ "$HEALTH" = "healthy" ]; then
    echo -e "${GREEN}✓ Service is healthy${NC}"
else
    echo -e "${RED}✗ Service health check failed${NC}"
fi

# 3. Check Telegram configuration
echo -e "\n${YELLOW}[3/7] Checking Telegram configuration...${NC}"
echo -e "${BLUE}Environment variables:${NC}"
run_docker exec ${SERVICE_NAME} env | grep -E "(TELEGRAM|ADMIN)" | while read line; do
    if [[ $line == *"TOKEN"* ]]; then
        # Mask the token
        TOKEN_VALUE=$(echo $line | cut -d'=' -f2)
        MASKED_TOKEN="${TOKEN_VALUE:0:10}..."
        echo "  ${line%%=*}=${MASKED_TOKEN}"
    else
        echo "  $line"
    fi
done

# 4. Check admin IDs configuration in logs
echo -e "\n${YELLOW}[4/7] Checking admin IDs configuration...${NC}"
ADMIN_IDS=$(run_docker logs ${SERVICE_NAME} 2>&1 | grep "Admin IDs configured" | tail -1)
if [ -n "$ADMIN_IDS" ]; then
    echo -e "${GREEN}✓ ${ADMIN_IDS}${NC}"
else
    echo -e "${RED}✗ No admin IDs found in logs${NC}"
fi

# 5. Check Telegram bot status
echo -e "\n${YELLOW}[5/7] Checking Telegram bot status...${NC}"
BOT_STATUS=$(run_docker logs ${SERVICE_NAME} 2>&1 | grep -i "telegram bot" | tail -3)
if [ -n "$BOT_STATUS" ]; then
    echo "$BOT_STATUS" | while read line; do
        if [[ $line == *"successfully"* ]]; then
            echo -e "${GREEN}✓ $line${NC}"
        elif [[ $line == *"error"* ]] || [[ $line == *"failed"* ]]; then
            echo -e "${RED}✗ $line${NC}"
        else
            echo -e "${YELLOW}  $line${NC}"
        fi
    done
else
    echo -e "${YELLOW}⚠ No Telegram bot status messages found${NC}"
fi

# 6. Check recent access attempts
echo -e "\n${YELLOW}[6/7] Checking recent Telegram access attempts...${NC}"
ACCESS_ATTEMPTS=$(run_docker logs ${SERVICE_NAME} 2>&1 | grep "Telegram access attempt" | tail -5)
if [ -n "$ACCESS_ATTEMPTS" ]; then
    echo -e "${BLUE}Recent access attempts:${NC}"
    echo "$ACCESS_ATTEMPTS" | while read line; do
        if [[ $line == *"granted"* ]]; then
            echo -e "${GREEN}  $line${NC}"
        elif [[ $line == *"denied"* ]]; then
            echo -e "${RED}  $line${NC}"
        else
            echo "  $line"
        fi
    done
else
    echo -e "${YELLOW}No access attempts found (bot may not have been used yet)${NC}"
fi

# 7. Test bot token validity (optional)
echo -e "\n${YELLOW}[7/7] Testing bot token validity...${NC}"
TOKEN=$(run_docker exec ${SERVICE_NAME} env | grep TELEGRAM_BOT_TOKEN | cut -d'=' -f2)
if [ -n "$TOKEN" ] && [ "$TOKEN" != "your-telegram-bot-token" ]; then
    echo -e "${YELLOW}Checking token with Telegram API...${NC}"
    BOT_INFO=$(curl -s "https://api.telegram.org/bot${TOKEN}/getMe" 2>/dev/null)
    if [[ $BOT_INFO == *'"ok":true'* ]]; then
        BOT_USERNAME=$(echo $BOT_INFO | jq -r '.result.username' 2>/dev/null)
        BOT_NAME=$(echo $BOT_INFO | jq -r '.result.first_name' 2>/dev/null)
        echo -e "${GREEN}✓ Bot token is valid${NC}"
        echo -e "  Bot name: ${BLUE}${BOT_NAME}${NC}"
        echo -e "  Bot username: ${BLUE}@${BOT_USERNAME}${NC}"
        echo -e "  Bot URL: ${BLUE}https://t.me/${BOT_USERNAME}${NC}"
    else
        echo -e "${RED}✗ Bot token is invalid or bot is not accessible${NC}"
        echo -e "${YELLOW}Error: $(echo $BOT_INFO | jq -r '.description' 2>/dev/null)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Bot token not configured or using default${NC}"
fi

# Summary
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}Diagnostic Summary${NC}"
echo -e "${BLUE}========================================${NC}"

# Provide recommendations
echo -e "\n${YELLOW}Recommendations:${NC}"

if [ "$HEALTH" != "healthy" ]; then
    echo -e "${RED}• Fix service health issues first${NC}"
fi

if [ -z "$ADMIN_IDS" ]; then
    echo -e "${RED}• Configure ADMINS_TELEGRAM_IDS in .env file${NC}"
fi

if [[ $BOT_STATUS != *"successfully"* ]]; then
    echo -e "${YELLOW}• Check Telegram bot initialization${NC}"
fi

if [ -z "$ACCESS_ATTEMPTS" ]; then
    echo -e "${BLUE}• Try sending /start to your bot to test access${NC}"
fi

echo -e "\n${BLUE}To test your bot:${NC}"
echo -e "1. Open Telegram and search for your bot"
echo -e "2. Send /start to initialize"
echo -e "3. Try /ping for a quick test"
echo -e "4. Try /health for system status"
echo -e "5. Run this script again to see access attempts"

echo -e "\n${BLUE}For more details, check:${NC}"
echo -e "• Full logs: ${YELLOW}docker logs ${SERVICE_NAME}${NC}"
echo -e "• Documentation: ${YELLOW}TELEGRAM_SETUP.md${NC}"