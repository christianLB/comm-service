#!/bin/bash

# ============================================
# Comm-Service Deployment Test Script
# Validates deployment is working correctly
# ============================================

set -e

# Configuration
API_URL="${API_URL:-http://localhost:8080}"
REDIS_HOST="${REDIS_HOST:-localhost}"
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test results array
declare -a TEST_RESULTS

# Functions
run_test() {
    local test_name=$1
    local test_command=$2
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "Testing: $test_name... "
    
    if eval $test_command > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        TEST_RESULTS+=("✓ $test_name")
        return 0
    else
        echo -e "${RED}✗${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        TEST_RESULTS+=("✗ $test_name")
        return 1
    fi
}

print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}              COMM-SERVICE DEPLOYMENT TEST                      ${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_summary() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}                        TEST SUMMARY                            ${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    for result in "${TEST_RESULTS[@]}"; do
        echo "  $result"
    done
    
    echo ""
    echo -e "Total Tests: ${TOTAL_TESTS}"
    echo -e "Passed: ${GREEN}${PASSED_TESTS}${NC}"
    echo -e "Failed: ${RED}${FAILED_TESTS}${NC}"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✅ All tests passed! Deployment is ready.${NC}"
        return 0
    else
        echo ""
        echo -e "${RED}❌ Some tests failed. Please check the deployment.${NC}"
        return 1
    fi
}

# Test Functions
test_docker_running() {
    docker info
}

test_containers_running() {
    docker ps | grep comm-service && docker ps | grep comm-redis
}

test_health_endpoint() {
    curl -f ${API_URL}/health
}

test_api_docs() {
    curl -f ${API_URL}/api-docs
}

test_redis_connection() {
    docker exec comm-redis redis-cli ping | grep PONG
}

test_redis_persistence() {
    docker exec comm-redis test -f /data/dump.rdb || docker exec comm-redis test -f /data/comm-service.aof
}

test_network() {
    docker network inspect comm-network
}

test_volumes() {
    docker volume ls | grep comm-service || test -d /volume1/docker/comm-service
}

test_environment_vars() {
    docker exec comm-service printenv | grep NODE_ENV | grep production
}

test_logs_directory() {
    docker exec comm-service test -d /app/logs
}

test_jwt_configured() {
    docker exec comm-service printenv JWT_SECRET | grep -v "your-super-secret"
}

test_port_accessibility() {
    nc -zv localhost 8080
}

test_memory_limits() {
    docker inspect comm-service | grep -i memory | grep -v "0"
}

test_restart_policy() {
    docker inspect comm-service | grep RestartPolicy | grep unless-stopped
}

test_healthcheck() {
    docker inspect comm-service | grep -i healthcheck
}

# Performance Tests
test_response_time() {
    local response_time=$(curl -o /dev/null -s -w '%{time_total}' ${API_URL}/health)
    # Check if response time is less than 1 second
    awk -v rt="$response_time" 'BEGIN { exit (rt < 1.0) ? 0 : 1 }'
}

test_redis_performance() {
    docker exec comm-redis redis-cli --latency-history | head -1
}

# Security Tests
test_redis_protected() {
    # Redis should not be accessible from outside (only localhost)
    ! nc -zv ${REDIS_HOST} 6379 2>/dev/null || docker port comm-redis | grep "127.0.0.1"
}

test_no_default_secrets() {
    ! docker exec comm-service printenv | grep -E "JWT_SECRET.*change-in-production"
}

# Main Execution
main() {
    print_header
    
    echo -e "${YELLOW}Running deployment tests...${NC}"
    echo ""
    
    echo -e "${BLUE}▸ Docker Environment${NC}"
    run_test "Docker is running" test_docker_running
    run_test "Containers are running" test_containers_running
    run_test "Network exists" test_network
    run_test "Volumes configured" test_volumes
    echo ""
    
    echo -e "${BLUE}▸ Service Health${NC}"
    run_test "Health endpoint responds" test_health_endpoint
    run_test "API documentation available" test_api_docs
    run_test "Port 8080 accessible" test_port_accessibility
    run_test "Response time < 1s" test_response_time
    echo ""
    
    echo -e "${BLUE}▸ Redis${NC}"
    run_test "Redis connection" test_redis_connection
    run_test "Redis persistence enabled" test_redis_persistence
    run_test "Redis performance" test_redis_performance
    run_test "Redis protected mode" test_redis_protected
    echo ""
    
    echo -e "${BLUE}▸ Configuration${NC}"
    run_test "Production environment" test_environment_vars
    run_test "Logs directory exists" test_logs_directory
    run_test "JWT configured" test_jwt_configured
    run_test "No default secrets" test_no_default_secrets
    echo ""
    
    echo -e "${BLUE}▸ Docker Configuration${NC}"
    run_test "Memory limits set" test_memory_limits
    run_test "Restart policy configured" test_restart_policy
    run_test "Healthcheck configured" test_healthcheck
    echo ""
    
    print_summary
}

# Quick test mode
quick_test() {
    echo -e "${YELLOW}Running quick deployment test...${NC}"
    
    if docker ps | grep -q comm-service && curl -f ${API_URL}/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Deployment is healthy${NC}"
        exit 0
    else
        echo -e "${RED}❌ Deployment check failed${NC}"
        exit 1
    fi
}

# Parse arguments
case "${1:-full}" in
    quick)
        quick_test
        ;;
    full|*)
        main
        ;;
esac