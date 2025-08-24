# GoCardless Integration with Comm-Service

## Overview

The chat ID is stored in comm-service's ADMINS_TELEGRAM_IDS environment variable. Your GoCardless service only needs the comm-service URL and a JWT token to send messages.

## Setup in GoCardless Project

### 1. Environment Variables (.env)
```env
# Comm Service Configuration
COMM_SERVICE_URL=http://192.168.1.11:8080  # or internal Docker network URL
COMM_SERVICE_TOKEN=<JWT_TOKEN>             # Generate this once (see below)
```

### 2. Install SDK
```bash
npm install @k2600x/comm-service-sdk --registry http://192.168.1.11:4873
```

### 3. Integration Code
```typescript
import { Configuration, MessagesApi } from '@k2600x/comm-service-sdk';

class TelegramNotifier {
  private messagesApi: MessagesApi;

  constructor() {
    this.messagesApi = new MessagesApi(new Configuration({
      basePath: process.env.COMM_SERVICE_URL,
      accessToken: process.env.COMM_SERVICE_TOKEN
    }));
  }

  async notifySyncComplete(transactionCount: number, errors: any[] = []) {
    try {
      const response = await this.messagesApi.v1MessagesSendPost(
        `gocardless-sync-${Date.now()}`, // unique idempotency key
        {
          channel: 'telegram',
          template_key: 'gocardless.sync',
          locale: 'en',
          data: {
            title: '💳 GoCardless Sync Complete',
            body: this.formatSyncMessage(transactionCount, errors),
            timestamp: new Date().toISOString(),
            service: 'gocardless',
            status: errors.length > 0 ? 'warning' : 'success'
          },
          to: {}, // Empty - comm-service knows the admin chat IDs
          routing: {
            fallback: ['email'], // Optional fallback
            ttl_seconds: 300
          }
        }
      );
      
      console.log('Notification sent:', response.data.message_id);
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  private formatSyncMessage(count: number, errors: any[]): string {
    let message = `Synchronized ${count} transactions successfully.`;
    
    if (errors.length > 0) {
      message += `\n\n⚠️ Errors: ${errors.length}`;
      errors.slice(0, 3).forEach(err => {
        message += `\n• ${err.message}`;
      });
    }
    
    return message;
  }
}

// Usage in your GoCardless sync process
export async function runGoCardlessSync() {
  const notifier = new TelegramNotifier();
  
  try {
    // Your sync logic here
    const transactions = await syncTransactions();
    
    // Send notification
    await notifier.notifySyncComplete(transactions.length);
  } catch (error) {
    // Send error notification
    await notifier.notifySyncComplete(0, [error]);
  }
}
```

## Generating the JWT Token

### Option 1: Create a Script in comm-service
```typescript
// generate-token.ts in comm-service project
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { AuthService } from './src/modules/auth/auth.service';

async function generateToken() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const authService = app.get(AuthService);
  
  const token = await authService.generateServiceToken('gocardless-service', [
    'messages:send',
    'notifications:telegram'
  ]);
  
  console.log('Token for GoCardless Service:');
  console.log(token);
  
  await app.close();
}

generateToken();
```

Run with: `npx ts-node generate-token.ts`

### Option 2: Manual JWT Generation
```javascript
// generate-jwt.js
const jwt = require('jsonwebtoken');

const payload = {
  service: 'gocardless-service',
  permissions: ['messages:send', 'notifications:telegram']
};

const secret = 'your-jwt-secret-from-comm-service'; // Get from comm-service .env
const token = jwt.sign(payload, secret, {
  expiresIn: '365d', // Long-lived token for service-to-service
  audience: ['comm-service']
});

console.log(token);
```

## Important Notes

1. **Chat IDs are managed by comm-service** - The ADMINS_TELEGRAM_IDS environment variable in comm-service contains the chat IDs. Your GoCardless service doesn't need to know them.

2. **The 'to' field** - When sending to admins, pass an empty object `{}` or omit the telegram_chat_id. The comm-service will use its configured admin IDs.

3. **JWT Token Security** - Store the token securely in your environment. Never commit it to version control.

4. **Network Access** - Ensure your GoCardless container can reach the comm-service:
   - If using Docker, they should be on the same network or use host networking
   - Use the internal Docker service name if on the same network (e.g., `http://comm-service:8080`)

5. **Template Keys** - Use consistent template keys for different types of notifications:
   - `gocardless.sync` - Sync completion
   - `gocardless.error` - Sync errors
   - `gocardless.webhook` - Webhook events

## Docker Compose Example

If both services run in Docker:

```yaml
version: '3.8'

services:
  comm-service:
    image: comm-service:latest
    ports:
      - "8080:8080"
    networks:
      - app-network
    environment:
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - ADMINS_TELEGRAM_IDS=${ADMINS_TELEGRAM_IDS}

  gocardless-service:
    image: gocardless-service:latest
    networks:
      - app-network
    environment:
      - COMM_SERVICE_URL=http://comm-service:8080
      - COMM_SERVICE_TOKEN=${COMM_SERVICE_TOKEN}

networks:
  app-network:
    driver: bridge
```

## Testing the Integration

```typescript
// test-notification.ts
import { TelegramNotifier } from './telegram-notifier';

async function test() {
  const notifier = new TelegramNotifier();
  await notifier.notifySyncComplete(42, []);
  console.log('Test notification sent!');
}

test();
```