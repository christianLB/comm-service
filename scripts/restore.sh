#!/bin/bash

# ============================================
# Comm-Service Restore Script
# Restore from backup
# ============================================

set -e

# Configuration
BACKUP_BASE_DIR="${BACKUP_BASE_DIR:-/volume1/docker/comm-service/backups}"
DATA_DIR="${DATA_DIR:-/volume1/docker/comm-service/data}"
CONFIG_DIR="${CONFIG_DIR:-/volume1/docker/comm-service/config}"
SERVICE_NAME="comm-service"
REDIS_NAME="comm-redis"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

list_backups() {
    log_info "Available backups:"
    echo ""
    
    for backup in $(ls -d ${BACKUP_BASE_DIR}/20* 2>/dev/null | sort -r); do
        if [ -f "${backup}/manifest.json" ]; then
            local timestamp=$(basename $backup)
            local size=$(jq -r '.size' ${backup}/manifest.json 2>/dev/null || echo "unknown")
            local version=$(jq -r '.version' ${backup}/manifest.json 2>/dev/null || echo "unknown")
            
            echo "  ${timestamp} - Size: ${size}, Version: ${version}"
        fi
    done
    echo ""
}

select_backup() {
    list_backups
    
    read -p "Enter backup timestamp to restore (or 'latest' for most recent): " BACKUP_CHOICE
    
    if [ "$BACKUP_CHOICE" == "latest" ]; then
        BACKUP_DIR=$(ls -d ${BACKUP_BASE_DIR}/20* 2>/dev/null | sort -r | head -1)
    else
        BACKUP_DIR="${BACKUP_BASE_DIR}/${BACKUP_CHOICE}"
    fi
    
    if [ ! -d "$BACKUP_DIR" ]; then
        log_error "Backup directory not found: $BACKUP_DIR"
        exit 1
    fi
    
    log_info "Selected backup: $BACKUP_DIR"
}

verify_backup() {
    log_info "Verifying backup integrity..."
    
    if [ ! -f "${BACKUP_DIR}/manifest.json" ]; then
        log_error "Backup manifest not found"
        exit 1
    fi
    
    # Check components
    local has_redis=$(jq -r '.components.redis' ${BACKUP_DIR}/manifest.json)
    local has_config=$(jq -r '.components.config' ${BACKUP_DIR}/manifest.json)
    
    log_info "Backup components:"
    echo "  Redis data: $has_redis"
    echo "  Configuration: $has_config"
    echo ""
    
    read -p "Continue with restore? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        log_info "Restore cancelled"
        exit 0
    fi
}

stop_services() {
    log_info "Stopping services..."
    
    docker stop ${SERVICE_NAME} 2>/dev/null || true
    docker stop ${REDIS_NAME} 2>/dev/null || true
    
    log_success "Services stopped"
}

backup_current() {
    log_info "Creating backup of current state..."
    
    local SAFETY_BACKUP="${BACKUP_BASE_DIR}/pre-restore-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "${SAFETY_BACKUP}"
    
    # Quick backup of current Redis data
    if [ -f "${DATA_DIR}/redis/dump.rdb" ]; then
        cp "${DATA_DIR}/redis/dump.rdb" "${SAFETY_BACKUP}/"
    fi
    
    log_info "Safety backup created at: ${SAFETY_BACKUP}"
}

restore_redis() {
    log_info "Restoring Redis data..."
    
    # Clear current Redis data
    rm -f "${DATA_DIR}/redis/dump.rdb"
    rm -f "${DATA_DIR}/redis/comm-service.aof"
    
    # Restore Redis dump
    if [ -f "${BACKUP_DIR}/redis-dump.rdb" ]; then
        cp "${BACKUP_DIR}/redis-dump.rdb" "${DATA_DIR}/redis/dump.rdb"
        chown 999:999 "${DATA_DIR}/redis/dump.rdb"
        log_success "Redis RDB restored"
    fi
    
    # Restore AOF if exists
    if [ -f "${BACKUP_DIR}/redis.aof" ]; then
        cp "${BACKUP_DIR}/redis.aof" "${DATA_DIR}/redis/comm-service.aof"
        chown 999:999 "${DATA_DIR}/redis/comm-service.aof"
        log_success "Redis AOF restored"
    fi
}

restore_config() {
    log_info "Restoring configuration..."
    
    local TIMESTAMP=$(basename $BACKUP_DIR)
    
    if [ -f "${BACKUP_DIR}/config-${TIMESTAMP}.tar.gz" ]; then
        # Backup current config
        if [ -d "${CONFIG_DIR}" ]; then
            mv "${CONFIG_DIR}" "${CONFIG_DIR}.bak"
        fi
        
        # Extract config
        mkdir -p "${CONFIG_DIR}"
        tar -xzf "${BACKUP_DIR}/config-${TIMESTAMP}.tar.gz" -C "${CONFIG_DIR}"
        
        log_success "Configuration restored"
    fi
    
    # Restore environment file if exists
    if [ -f "${BACKUP_DIR}/env.backup" ]; then
        cp "${BACKUP_DIR}/env.backup" "/volume1/docker/comm-service/.env.restored"
        log_warning "Environment file restored to .env.restored (review and update secrets)"
    fi
}

restore_logs() {
    read -p "Restore logs? (yes/no): " RESTORE_LOGS
    
    if [ "$RESTORE_LOGS" == "yes" ]; then
        log_info "Restoring logs..."
        
        local TIMESTAMP=$(basename $BACKUP_DIR)
        if [ -f "${BACKUP_DIR}/logs-${TIMESTAMP}.tar.gz" ]; then
            tar -xzf "${BACKUP_DIR}/logs-${TIMESTAMP}.tar.gz" -C "${LOGS_DIR}"
            log_success "Logs restored"
        fi
    fi
}

start_services() {
    log_info "Starting services..."
    
    # Start Redis first
    docker start ${REDIS_NAME}
    sleep 5
    
    # Verify Redis is working
    if docker exec ${REDIS_NAME} redis-cli ping > /dev/null 2>&1; then
        log_success "Redis started successfully"
    else
        log_error "Redis failed to start"
        exit 1
    fi
    
    # Start comm-service
    docker start ${SERVICE_NAME}
    sleep 10
    
    log_success "Services started"
}

verify_restore() {
    log_info "Verifying restoration..."
    
    # Check service health
    if curl -f http://localhost:8080/health > /dev/null 2>&1; then
        log_success "Health check passed"
    else
        log_error "Health check failed"
        docker logs ${SERVICE_NAME} --tail 50
        exit 1
    fi
    
    # Check Redis data
    local redis_keys=$(docker exec ${REDIS_NAME} redis-cli DBSIZE | cut -d' ' -f2)
    log_info "Redis contains ${redis_keys} keys"
}

rollback() {
    log_error "Restore failed, rolling back..."
    
    stop_services
    
    # Restore safety backup
    local SAFETY_BACKUP=$(ls -d ${BACKUP_BASE_DIR}/pre-restore-* 2>/dev/null | sort -r | head -1)
    if [ -n "$SAFETY_BACKUP" ] && [ -f "${SAFETY_BACKUP}/dump.rdb" ]; then
        cp "${SAFETY_BACKUP}/dump.rdb" "${DATA_DIR}/redis/dump.rdb"
        log_info "Rolled back to previous state"
    fi
    
    start_services
}

# Main execution
main() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}                 COMM-SERVICE RESTORE UTILITY                   ${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    # Select backup
    select_backup
    
    # Verify backup
    verify_backup
    
    # Create safety backup
    backup_current
    
    # Stop services
    stop_services
    
    # Perform restore
    {
        restore_redis
        restore_config
        restore_logs
        
        # Start services
        start_services
        
        # Verify
        verify_restore
        
    } || {
        # Rollback on failure
        rollback
        exit 1
    }
    
    log_success "✅ Restore completed successfully!"
    echo ""
    echo "Post-restore tasks:"
    echo "1. Review and update .env file with production secrets"
    echo "2. Test all integrations (Telegram, Email)"
    echo "3. Monitor logs for any issues"
    echo "4. Create a new backup of the restored state"
}

# Handle arguments
case "${1:-interactive}" in
    --backup)
        BACKUP_DIR="${BACKUP_BASE_DIR}/$2"
        if [ ! -d "$BACKUP_DIR" ]; then
            log_error "Backup not found: $2"
            exit 1
        fi
        verify_backup
        stop_services
        backup_current
        restore_redis
        restore_config
        start_services
        verify_restore
        ;;
    --list)
        list_backups
        ;;
    *)
        main
        ;;
esac