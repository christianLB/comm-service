#!/bin/bash

# ============================================
# Comm-Service Monitoring Script
# Real-time monitoring and alerting
# ============================================

# Configuration
SERVICE_NAME="comm-service"
REDIS_NAME="comm-redis"
HEALTH_URL="${HEALTH_URL:-http://localhost:8080/health}"
LOG_FILE="/volume1/docker/comm-service/logs/monitor.log"
ALERT_THRESHOLD_CPU=80
ALERT_THRESHOLD_MEM=80
ALERT_THRESHOLD_REDIS_MEM=400  # MB
CHECK_INTERVAL=${CHECK_INTERVAL:-30}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# State tracking
LAST_HEALTH_STATUS="unknown"
ALERT_SENT=false

# Functions
log_metric() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "${LOG_FILE}"
}

print_header() {
    clear
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}                 COMM-SERVICE MONITOR                          ${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

check_container_status() {
    local container=$1
    local status=$(docker inspect -f '{{.State.Status}}' $container 2>/dev/null)
    
    if [ "$status" == "running" ]; then
        echo -e "${GREEN}● Running${NC}"
    elif [ "$status" == "restarting" ]; then
        echo -e "${YELLOW}● Restarting${NC}"
    else
        echo -e "${RED}● Stopped${NC}"
    fi
}

check_health() {
    local health_response=$(curl -s -o /dev/null -w "%{http_code}" ${HEALTH_URL})
    
    if [ "$health_response" == "200" ]; then
        echo -e "${GREEN}● Healthy${NC}"
        LAST_HEALTH_STATUS="healthy"
        return 0
    else
        echo -e "${RED}● Unhealthy (HTTP $health_response)${NC}"
        LAST_HEALTH_STATUS="unhealthy"
        return 1
    fi
}

get_container_stats() {
    local container=$1
    local stats=$(docker stats --no-stream --format "json" $container 2>/dev/null)
    
    if [ -n "$stats" ]; then
        local cpu=$(echo $stats | jq -r '.CPUPerc' | sed 's/%//')
        local mem=$(echo $stats | jq -r '.MemUsage' | cut -d'/' -f1)
        local mem_percent=$(echo $stats | jq -r '.MemPerc' | sed 's/%//')
        
        echo "CPU: ${cpu}% | MEM: ${mem} (${mem_percent}%)"
        
        # Check thresholds
        if (( $(echo "$cpu > $ALERT_THRESHOLD_CPU" | bc -l) )); then
            log_metric "WARNING: ${container} CPU usage high: ${cpu}%"
        fi
        
        if (( $(echo "$mem_percent > $ALERT_THRESHOLD_MEM" | bc -l) )); then
            log_metric "WARNING: ${container} Memory usage high: ${mem_percent}%"
        fi
    else
        echo "N/A"
    fi
}

check_redis_metrics() {
    local info=$(docker exec ${REDIS_NAME} redis-cli INFO stats 2>/dev/null)
    
    if [ -n "$info" ]; then
        local connected_clients=$(echo "$info" | grep "connected_clients:" | cut -d':' -f2 | tr -d '\r')
        local used_memory=$(docker exec ${REDIS_NAME} redis-cli INFO memory | grep "used_memory_human:" | cut -d':' -f2 | tr -d '\r')
        local total_commands=$(echo "$info" | grep "total_commands_processed:" | cut -d':' -f2 | tr -d '\r')
        
        echo -e "  Clients: ${connected_clients} | Memory: ${used_memory} | Commands: ${total_commands}"
    fi
}

check_logs_for_errors() {
    local container=$1
    local error_count=$(docker logs --since 5m $container 2>&1 | grep -iE "error|exception|failed" | wc -l)
    
    if [ $error_count -gt 0 ]; then
        echo -e "${RED}  ⚠ ${error_count} errors in last 5 minutes${NC}"
        log_metric "WARNING: ${container} has ${error_count} errors in logs"
    else
        echo -e "${GREEN}  ✓ No recent errors${NC}"
    fi
}

check_disk_usage() {
    local data_dir="/volume1/docker/comm-service"
    local usage=$(df -h ${data_dir} | awk 'NR==2 {print $5}' | sed 's/%//')
    local available=$(df -h ${data_dir} | awk 'NR==2 {print $4}')
    
    echo "Disk Usage: ${usage}% used | ${available} available"
    
    if [ $usage -gt 80 ]; then
        echo -e "${RED}  ⚠ High disk usage!${NC}"
        log_metric "WARNING: Disk usage high: ${usage}%"
    fi
}

check_network_connectivity() {
    # Check Telegram API
    local telegram_status=$(curl -s -o /dev/null -w "%{http_code}" https://api.telegram.org)
    if [ "$telegram_status" == "404" ] || [ "$telegram_status" == "200" ]; then
        echo -e "  Telegram API: ${GREEN}✓${NC}"
    else
        echo -e "  Telegram API: ${RED}✗${NC}"
    fi
    
    # Check SMTP (if configured)
    local smtp_host=$(docker exec ${SERVICE_NAME} printenv SMTP_HOST 2>/dev/null)
    if [ -n "$smtp_host" ]; then
        if nc -z -w2 ${smtp_host} 587 2>/dev/null; then
            echo -e "  SMTP Server: ${GREEN}✓${NC}"
        else
            echo -e "  SMTP Server: ${RED}✗${NC}"
        fi
    fi
}

monitor_live() {
    while true; do
        print_header
        
        echo -e "${BLUE}▸ Service Status${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo -n "  Comm-Service: "
        check_container_status ${SERVICE_NAME}
        echo -n "  Redis:        "
        check_container_status ${REDIS_NAME}
        echo -n "  Health Check: "
        check_health
        echo ""
        
        echo -e "${BLUE}▸ Resource Usage${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo -n "  Comm-Service: "
        get_container_stats ${SERVICE_NAME}
        echo -n "  Redis:        "
        get_container_stats ${REDIS_NAME}
        echo ""
        
        echo -e "${BLUE}▸ Redis Metrics${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        check_redis_metrics
        echo ""
        
        echo -e "${BLUE}▸ System Status${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo -n "  "
        check_disk_usage
        echo ""
        
        echo -e "${BLUE}▸ Network Status${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        check_network_connectivity
        echo ""
        
        echo -e "${BLUE}▸ Recent Logs${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        check_logs_for_errors ${SERVICE_NAME}
        check_logs_for_errors ${REDIS_NAME}
        echo ""
        
        echo -e "${CYAN}Refreshing in ${CHECK_INTERVAL} seconds... (Press Ctrl+C to exit)${NC}"
        sleep ${CHECK_INTERVAL}
    done
}

monitor_once() {
    echo -e "${CYAN}COMM-SERVICE STATUS REPORT${NC}"
    echo -e "${CYAN}$(date)${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    echo -n "Comm-Service: "
    check_container_status ${SERVICE_NAME}
    
    echo -n "Redis: "
    check_container_status ${REDIS_NAME}
    
    echo -n "Health: "
    check_health
    
    echo ""
    echo "Resources:"
    echo -n "  Comm-Service: "
    get_container_stats ${SERVICE_NAME}
    echo -n "  Redis: "
    get_container_stats ${REDIS_NAME}
    
    echo ""
    check_disk_usage
}

send_alert() {
    local message=$1
    local severity=$2
    
    # Log alert
    log_metric "ALERT [$severity]: $message"
    
    # In production, integrate with comm-service to send actual alerts
    # For now, just log to file
    echo "[ALERT] $message" >> /volume1/docker/comm-service/logs/alerts.log
}

# Main execution
case "${1:-live}" in
    live)
        monitor_live
        ;;
    once)
        monitor_once
        ;;
    check)
        if check_health > /dev/null 2>&1; then
            echo "OK"
            exit 0
        else
            echo "FAIL"
            exit 1
        fi
        ;;
    *)
        echo "Usage: $0 [live|once|check]"
        echo "  live  - Continuous monitoring (default)"
        echo "  once  - Single status check"
        echo "  check - Simple health check (for cron)"
        exit 1
        ;;
esac