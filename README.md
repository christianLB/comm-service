# Comm-Service v0.1

Centralized bidirectional communication service for orchestrating notifications and commands between administrators and microservices (trading-service, financial-service, ai-service, memory-service).

## Features

- **Multi-channel Notifications**: Send messages via Telegram and Email with automatic fallback
- **Interactive Confirmations**: Request Yes/No confirmations through Telegram buttons or email magic links
- **Command Dispatch**: Execute administrative commands on connected services with confirmation flow
- **Verification System**: OTP and magic link authentication for secure operations
- **Event Processing**: Receive and process status updates from microservices
- **Idempotency**: Prevent duplicate operations with idempotency keys
- **Audit Logging**: Complete audit trail of all confirmed actions
- **CONTRACT-FIRST**: Built from OpenAPI specification for consistency

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Telegram  │────▶│              │────▶│  Trading    │
│     Bot     │     │              │     │  Service    │
└─────────────┘     │              │     └─────────────┘
                    │              │
┌─────────────┐     │  Comm-Service│     ┌─────────────┐
│    Email    │────▶│              │────▶│ Financial   │
│  SMTP/SG    │     │              │     │  Service    │
└─────────────┘     │              │     └─────────────┘
                    │              │
┌─────────────┐     │              │     ┌─────────────┐
│    Redis    │◀───▶│              │────▶│     AI      │
│  State/Queue│     │              │     │  Service    │
└─────────────┘     └──────────────┘     └─────────────┘
```

## Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd comm-service

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your configuration (see .env.example for detailed instructions)
```

### 2. Configure Environment

Edit `.env` file with your settings:

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=your-bot-token-from-botfather
ADMINS_TELEGRAM_IDS=123456789,987654321

# Email (choose SMTP or SendGrid)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# OR SendGrid
SENDGRID_API_KEY=your-sendgrid-api-key

# JWT Security
JWT_SECRET=your-super-secret-key-change-in-production

# Service URLs
SERVICE_URLS_TRADING=http://trading-service:3000
SERVICE_URLS_FINANCIAL=http://financial-service:3000
SERVICE_URLS_AI=http://ai-service:3000
SERVICE_URLS_MEMORY=http://memory-service:3000
```

### 3. Start Services

#### Using Docker Compose (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f comm-api

# Stop services
docker-compose down
```

#### Local Development

```bash
# Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# Start development server
npm run start:dev

# Build for production
npm run build
npm run start:prod
```

## API Documentation

Once running, access the interactive API documentation at:
- Swagger UI: http://localhost:8080/api-docs
- OpenAPI Spec: http://localhost:8080/api-docs-json

### Core Endpoints

#### Send Message
```bash
curl -X POST http://localhost:8080/v1/messages/send \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "telegram",
    "template_key": "alerts.generic",
    "data": {"title": "Alert", "body": "High slippage detected"},
    "to": {"telegram_chat_id": 123456789},
    "routing": {"fallback": ["email"], "ttl_seconds": 300}
  }'
```

#### Dispatch Command
```bash
curl -X POST http://localhost:8080/v1/commands/dispatch \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "trading-service",
    "action": "strategy.pause",
    "args": {"strategy_id": "btc-arb-01"},
    "require_confirmation": true,
    "channel": "telegram"
  }'
```

#### Start Verification
```bash
curl -X POST http://localhost:8080/v1/verification/start \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "method": "email",
    "purpose": "login",
    "to": {"email": "user@example.com"},
    "mode": "otp",
    "ttl_seconds": 600
  }'
```

## Telegram Bot Commands

Once configured, interact with the bot using:

- `/start` - Initialize bot and show help
- `/cmd <service.action> [args]` - Execute a command
- `/status <command_id>` - Check command status
- `/help` - Show available commands

### Examples:

```
/cmd trading.strategy.pause strategy_id=btc-arb-01
/cmd financial.report.generate month=july
/status cmd_9x
```

## Service Integration

### For Microservices

Services should implement the following endpoints:

1. **Command Handler**: `POST /v1/commands/{action}`
   - Receive commands from comm-service
   - Include authentication via JWT bearer token
   - Return success/failure status

2. **Event Webhook**: Send status updates to comm-service
   ```bash
   POST http://comm-service:8080/v1/events
   {
     "command_id": "cmd_9x",
     "service": "trading-service",
     "status": "completed",
     "output": {"paused": true},
     "metrics": {"latency_ms": 320}
   }
   ```

### Authentication

Generate service tokens:

```javascript
// In your service
const token = await commService.generateServiceToken('my-service', ['command.execute']);
```

## Security Features

- **JWT Authentication**: Service-to-service authentication
- **Telegram Allowlist**: Only configured admin IDs can use bot
- **Magic Links**: Time-limited signed URLs for email confirmations
- **Idempotency**: Prevent duplicate operations with request headers
- **Audit Logging**: All confirmed actions are logged to Redis
- **TTL Expiration**: Messages and commands expire after configured time

## Development

### Project Structure

```
comm-service/
├── src/
│   ├── main.ts                 # Application entry point
│   ├── app.module.ts           # Root module
│   ├── config/                 # Configuration files
│   ├── common/                 # Shared utilities
│   │   ├── dto/               # Common DTOs
│   │   ├── interceptors/      # Global interceptors
│   │   └── redis/             # Redis module
│   └── modules/
│       ├── messages/          # Message sending
│       ├── commands/          # Command dispatch
│       ├── verification/      # OTP/Magic links
│       ├── events/            # Event processing
│       ├── telegram/          # Telegram adapter
│       ├── email/             # Email adapter
│       ├── auth/              # JWT authentication
│       └── health/            # Health checks
├── openapi.yaml               # CONTRACT-FIRST API spec
├── docker-compose.yml         # Docker configuration
└── package.json              # Dependencies
```

### Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

### Monitoring

- Health Check: `GET /health`
- Redis Status: Check via health endpoint
- Logs: Available in `logs/` directory or Docker logs

## Troubleshooting

### NestJS Application Hanging on Startup

**Problem**: Application logs show "Calling app.listen()..." but never completes.

**Solution**: 
- Ensure Telegram bot.launch() is non-blocking
- Add callback to app.listen() method
- Check for blocking operations in onModuleInit hooks

### Telegram Bot Not Responding

**Problem**: Bot shows "Unauthorized. This bot is for administrators only."

**Solutions**:
1. **Find your correct Telegram ID**:
   - Message @userinfobot on Telegram
   - Or check logs: `docker logs comm-service | grep "Telegram access attempt"`
   
2. **Verify configuration**:
   ```bash
   # Check configured admin IDs
   docker exec comm-service env | grep ADMINS_TELEGRAM_IDS
   
   # Check logs for your actual ID
   docker logs comm-service | grep "User ID:"
   ```

3. **Common issues**:
   - Extra digits in Telegram ID (e.g., 50152555379 vs 5015255679)
   - Admin IDs not loaded from environment variables
   - Bot token incorrect or expired

### Health Check Returns 404

**Problem**: `curl http://localhost:8080/health` returns 404

**Solution**: Use versioned endpoint: `curl http://localhost:8080/v1/health`

### Redis Connection Issues

**Problem**: Multiple Redis instances causing port conflicts

**Solution**:
```bash
# Use dedicated port for this service
REDIS_URL=redis://localhost:6383

# Or use Docker network name
REDIS_URL=redis://comm-redis:6379
```

### Docker Commands Fail on Synology NAS

**Problem**: "docker: command not found" when using sudo

**Solution**: Use full path: `sudo /usr/local/bin/docker`

### Service Not Starting After Deployment

**Checklist**:
1. Check logs: `docker logs comm-service --tail 100`
2. Verify environment: `docker exec comm-service env`
3. Test health: `curl http://localhost:8080/v1/health`
4. Check Redis: `docker exec comm-redis redis-cli ping`
5. Verify ports: `docker ps` (should show 0.0.0.0:8080->8080)
3. Ensure bot has proper permissions
4. View logs: `docker-compose logs comm-api`

### Email Not Sending

1. For Gmail: Enable "App Passwords" and use instead of regular password
2. For SendGrid: Verify API key and sender domain
3. Check firewall/network settings for SMTP ports

### Redis Connection Issues

1. Ensure Redis is running: `docker ps`
2. Check Redis URL in environment variables
3. Test connection: `redis-cli ping`

## Phase Roadmap

### Phase 0 (Current) - MVP ✅
- Basic API with Telegram and Email adapters
- Yes/No confirmations
- Command dispatch via HTTP
- Redis state management

### Phase 1 - Robustness
- Retry logic with exponential backoff
- Versioned templates with i18n
- User preferences storage
- Enhanced audit logging

### Phase 2 - Scalability
- Event bus (Redis Streams/RabbitMQ)
- Command/Event subscriptions
- Multi-step workflow orchestration
- Horizontal scaling support

## Contributing

1. Follow CONTRACT-FIRST approach: Update `openapi.yaml` first
2. Generate DTOs from OpenAPI specification
3. Implement services following the contract
4. Add tests for new features
5. Update documentation

## Deployment

### 🚀 Quick Deploy to Synology NAS

```bash
# Build and deploy to NAS (k2600x@192.168.1.11)
./scripts/deploy.sh nas

# Or step by step:
./scripts/deploy.sh build          # Build Docker image
./scripts/deploy.sh local          # Test locally first
./scripts/deploy.sh nas            # Deploy to NAS
```

### Production Files

- **`.env.production`** - Production environment template (update with real values)
- **`docker-compose.prod.yml`** - Production Docker Compose with NAS paths
- **`DEPLOYMENT.md`** - Complete deployment documentation
- **`scripts/`** - Automation scripts:
  - `deploy.sh` - Deployment automation
  - `backup.sh` - Automated backups
  - `monitor.sh` - Real-time monitoring
  - `restore.sh` - Backup restoration

### NAS Directory Structure

```
/volume1/docker/comm-service/
├── config/          # Configuration files
├── data/
│   ├── redis/      # Redis persistence
│   └── audit/      # Audit logs
├── logs/           # Application logs
├── backups/        # Automated backups
└── scripts/        # Management scripts
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## Monitoring

### Real-time Monitoring

```bash
# Live monitoring dashboard
./scripts/monitor.sh live

# Single status check
./scripts/monitor.sh once

# Simple health check (for cron)
./scripts/monitor.sh check
```

### Backup & Recovery

```bash
# Create backup
./scripts/backup.sh

# List available backups
./scripts/restore.sh --list

# Restore from backup
./scripts/restore.sh
```

## License

MIT

## Support

For issues or questions, create an issue in the repository or contact the development team.