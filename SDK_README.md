# Comm Service SDK

## Overview
TypeScript SDK for Comm Service API, generated from OpenAPI specification.

## Installation

### From Verdaccio (when available)
```bash
npm install @k2600x/comm-service-sdk --registry http://192.168.1.11:4873
```

### From Local Tarball
```bash
npm install ./k2600x-comm-service-sdk-0.1.0.tgz
```

## Usage

```typescript
import { Configuration, HealthApi, MessagesApi, CommandsApi } from '@k2600x/comm-service-sdk';

// Configure the SDK
const config = new Configuration({
    basePath: 'http://localhost:8080',
    accessToken: 'your-jwt-token-here'
});

// Initialize APIs
const healthApi = new HealthApi(config);
const messagesApi = new MessagesApi(config);
const commandsApi = new CommandsApi(config);

// Example: Check health
async function checkHealth() {
    try {
        const response = await healthApi.healthGet();
        console.log('Health Status:', response.data);
    } catch (error) {
        console.error('Health check failed:', error);
    }
}

// Example: Send a message
async function sendMessage() {
    try {
        const response = await messagesApi.v1MessagesSendPost(
            'unique-idempotency-key',
            {
                channel: 'telegram',
                template_key: 'alerts.generic',
                locale: 'es-AR',
                data: {
                    title: 'Alert',
                    body: 'High slippage detected'
                },
                to: {
                    telegram_chat_id: '123456789'
                },
                routing: {
                    fallback: ['email'],
                    ttl_seconds: 300
                }
            }
        );
        console.log('Message sent:', response.data);
    } catch (error) {
        console.error('Failed to send message:', error);
    }
}

// Example: Dispatch a command
async function dispatchCommand() {
    try {
        const response = await commandsApi.v1CommandsDispatchPost(
            'unique-idempotency-key',
            {
                service: 'trading-service',
                action: 'strategy.pause',
                args: {
                    strategy_id: 'btc-arb-01',
                    reason: 'manual_maintenance'
                },
                require_confirmation: true,
                channel: 'telegram',
                routing: {
                    fallback: ['email'],
                    ttl_seconds: 300
                },
                audit: {
                    requested_by: 'admin@k2600x',
                    trace_id: 'trace-123'
                }
            }
        );
        console.log('Command dispatched:', response.data);
    } catch (error) {
        console.error('Failed to dispatch command:', error);
    }
}
```

## API Documentation

The SDK includes the following APIs:

- **HealthApi**: Health check endpoints
- **MessagesApi**: Send notifications via Telegram/Email
- **CommandsApi**: Dispatch commands to services
- **VerificationApi**: Email/Telegram verification
- **EventsApi**: Service event ingestion

## Files

- `k2600x-comm-service-sdk-0.1.0.tgz` - NPM package tarball
- `sdk/` - Generated SDK source code
- `openapi.yaml` - OpenAPI specification source

## Publishing to Verdaccio

When Verdaccio is running on your NAS:

```bash
# Run the publish script
./publish-sdk.sh

# Or manually
cd sdk
npm publish --registry http://192.168.1.11:4873
```

## Regenerating the SDK

To regenerate the SDK after API changes:

```bash
# Update openapi.yaml with your changes, then:
npm run sdk:build
```

## Version History

- **0.1.0** - Initial SDK generation with core APIs