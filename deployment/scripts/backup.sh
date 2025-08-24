#!/bin/bash

# ============================================
# Comm-Service Backup Script
# For Synology NAS
# ============================================

set -e

# Configuration
BACKUP_BASE_DIR="${BACKUP_BASE_DIR:-/volume1/docker/comm-service/backups}"
DATA_DIR="${DATA_DIR:-/volume1/docker/comm-service/data}"
CONFIG_DIR="${CONFIG_DIR:-/volume1/docker/comm-service/config}"
LOGS_DIR="${LOGS_DIR:-/volume1/docker/comm-service/logs}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="${BACKUP_BASE_DIR}/${TIMESTAMP}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Functions
log_info() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

create_backup_dir() {
    log_info "Creating backup directory: ${BACKUP_DIR}"
    mkdir -p "${BACKUP_DIR}"
}

backup_redis() {
    log_info "Backing up Redis data..."
    
    # Trigger Redis background save
    docker exec comm-redis redis-cli BGSAVE > /dev/null 2>&1 || {
        log_warning "Could not trigger BGSAVE, attempting direct copy..."
    }
    
    # Wait for background save to complete
    sleep 5
    
    # Check if Redis is saving
    while [ $(docker exec comm-redis redis-cli LASTSAVE) -eq $(docker exec comm-redis redis-cli LASTSAVE) ]; do
        sleep 1
    done
    
    # Copy Redis data files
    if [ -f "${DATA_DIR}/redis/dump.rdb" ]; then
        cp "${DATA_DIR}/redis/dump.rdb" "${BACKUP_DIR}/redis-dump.rdb"
        log_info "Redis RDB backup completed"
    fi
    
    if [ -f "${DATA_DIR}/redis/comm-service.aof" ]; then
        cp "${DATA_DIR}/redis/comm-service.aof" "${BACKUP_DIR}/redis.aof"
        log_info "Redis AOF backup completed"
    fi
    
    # Export Redis data as JSON for portability
    docker exec comm-redis redis-cli --rdb /tmp/export.rdb 2>/dev/null || true
}

backup_config() {
    log_info "Backing up configuration files..."
    
    # Create config backup
    if [ -d "${CONFIG_DIR}" ]; then
        tar -czf "${BACKUP_DIR}/config-${TIMESTAMP}.tar.gz" -C "${CONFIG_DIR}" .
        log_info "Configuration backup completed"
    fi
    
    # Backup environment file
    if [ -f "/volume1/docker/comm-service/.env" ]; then
        cp "/volume1/docker/comm-service/.env" "${BACKUP_DIR}/env.backup"
        # Remove sensitive data from backup
        sed -i 's/JWT_SECRET=.*/JWT_SECRET=REDACTED/g' "${BACKUP_DIR}/env.backup"
        sed -i 's/SMTP_PASS=.*/SMTP_PASS=REDACTED/g' "${BACKUP_DIR}/env.backup"
        sed -i 's/TELEGRAM_BOT_TOKEN=.*/TELEGRAM_BOT_TOKEN=REDACTED/g' "${BACKUP_DIR}/env.backup"
    fi
}

backup_logs() {
    log_info "Backing up application logs..."
    
    if [ -d "${LOGS_DIR}" ]; then
        # Compress logs
        tar -czf "${BACKUP_DIR}/logs-${TIMESTAMP}.tar.gz" -C "${LOGS_DIR}" \
            --exclude='*.gz' \
            --exclude='*.old' \
            .
        log_info "Logs backup completed"
    fi
}

backup_audit() {
    log_info "Backing up audit logs..."
    
    if [ -d "${DATA_DIR}/audit" ]; then
        tar -czf "${BACKUP_DIR}/audit-${TIMESTAMP}.tar.gz" -C "${DATA_DIR}/audit" .
        log_info "Audit logs backup completed"
    fi
}

backup_docker_info() {
    log_info "Backing up Docker information..."
    
    # Save container info
    docker inspect comm-service > "${BACKUP_DIR}/comm-service-inspect.json" 2>/dev/null || true
    docker inspect comm-redis > "${BACKUP_DIR}/comm-redis-inspect.json" 2>/dev/null || true
    
    # Save docker-compose config
    if [ -f "/volume1/docker/comm-service/docker-compose.prod.yml" ]; then
        cp "/volume1/docker/comm-service/docker-compose.prod.yml" "${BACKUP_DIR}/"
    fi
    
    # Save image versions
    docker images | grep comm-service > "${BACKUP_DIR}/docker-images.txt" 2>/dev/null || true
}

create_backup_manifest() {
    log_info "Creating backup manifest..."
    
    cat > "${BACKUP_DIR}/manifest.json" <<EOF
{
    "timestamp": "${TIMESTAMP}",
    "date": "$(date -Iseconds)",
    "version": "$(docker inspect comm-service --format='{{.Config.Image}}' 2>/dev/null || echo 'unknown')",
    "type": "full",
    "components": {
        "redis": $([ -f "${BACKUP_DIR}/redis-dump.rdb" ] && echo "true" || echo "false"),
        "config": $([ -f "${BACKUP_DIR}/config-${TIMESTAMP}.tar.gz" ] && echo "true" || echo "false"),
        "logs": $([ -f "${BACKUP_DIR}/logs-${TIMESTAMP}.tar.gz" ] && echo "true" || echo "false"),
        "audit": $([ -f "${BACKUP_DIR}/audit-${TIMESTAMP}.tar.gz" ] && echo "true" || echo "false")
    },
    "size": "$(du -sh ${BACKUP_DIR} | cut -f1)",
    "retention_days": ${RETENTION_DAYS}
}
EOF
}

cleanup_old_backups() {
    log_info "Cleaning up old backups (retention: ${RETENTION_DAYS} days)..."
    
    # Find and remove old backup directories
    find "${BACKUP_BASE_DIR}" -maxdepth 1 -type d -name "20*" -mtime +${RETENTION_DAYS} -exec rm -rf {} \; 2>/dev/null || true
    
    # Count remaining backups
    BACKUP_COUNT=$(find "${BACKUP_BASE_DIR}" -maxdepth 1 -type d -name "20*" | wc -l)
    log_info "Remaining backups: ${BACKUP_COUNT}"
}

verify_backup() {
    log_info "Verifying backup integrity..."
    
    # Check if essential files exist
    VERIFY_PASS=true
    
    if [ ! -f "${BACKUP_DIR}/redis-dump.rdb" ] && [ ! -f "${BACKUP_DIR}/redis.aof" ]; then
        log_warning "Redis backup files missing"
        VERIFY_PASS=false
    fi
    
    if [ ! -f "${BACKUP_DIR}/config-${TIMESTAMP}.tar.gz" ]; then
        log_warning "Configuration backup missing"
        VERIFY_PASS=false
    fi
    
    # Test archive integrity
    for archive in "${BACKUP_DIR}"/*.tar.gz; do
        if [ -f "$archive" ]; then
            tar -tzf "$archive" > /dev/null 2>&1 || {
                log_error "Archive integrity check failed: $archive"
                VERIFY_PASS=false
            }
        fi
    done
    
    if [ "$VERIFY_PASS" = true ]; then
        log_info "✅ Backup verification passed"
    else
        log_error "❌ Backup verification failed"
        return 1
    fi
}

send_notification() {
    # Send notification via comm-service itself (if running)
    if docker exec comm-service wget -qO- http://localhost:8080/health > /dev/null 2>&1; then
        # This would need proper authentication in production
        log_info "Backup notification would be sent here"
    fi
}

# Main execution
main() {
    log_info "Starting Comm-Service backup..."
    log_info "Backup directory: ${BACKUP_DIR}"
    
    # Create backup directory
    create_backup_dir
    
    # Perform backups
    backup_redis
    backup_config
    backup_logs
    backup_audit
    backup_docker_info
    
    # Create manifest
    create_backup_manifest
    
    # Verify backup
    verify_backup
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Calculate backup size
    BACKUP_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)
    
    log_info "✅ Backup completed successfully!"
    log_info "Backup location: ${BACKUP_DIR}"
    log_info "Backup size: ${BACKUP_SIZE}"
    
    # Send notification
    send_notification
}

# Run main function
main "$@"