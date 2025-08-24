# Bank Sync Service Integration

## Token for bank-sync-service

Add these environment variables to your bank-sync-service `.env` file:

```bash
# Comm Service Integration
COMM_SERVICE_URL=http://192.168.1.11:8080
COMM_SERVICE_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzZXJ2aWNlIjoiYmFuay1zeW5jLXNlcnZpY2UiLCJwZXJtaXNzaW9ucyI6WyJtZXNzYWdlczpzZW5kIiwibm90aWZpY2F0aW9uczp0ZWxlZ3JhbSIsImV2ZW50czpwdWJsaXNoIl0sInR5cGUiOiJzZXJ2aWNlIiwiaWF0IjoxNzU2MDQ0NzEzLCJhdWQiOlsiY29tbS1zZXJ2aWNlIiwidHJhZGluZy1zZXJ2aWNlIiwiZmluYW5jaWFsLXNlcnZpY2UiLCJhaS1zZXJ2aWNlIiwibWVtb3J5LXNlcnZpY2UiLCJnb2NhcmRsZXNzLXNlcnZpY2UiLCJ0ZXN0LXNlcnZpY2UiLCJiYW5rLXN5bmMtc2VydmljZSJdLCJpc3MiOiJjb21tLXNlcnZpY2UifQ.13g1YxjonFcUrwQiQYiGPYqfWaUCrI9fPgtD674Gc84
```

## Usage Example

```typescript
import { Configuration, MessagesApi } from '@k2600x/comm-service-sdk';

const messagesApi = new MessagesApi(new Configuration({
  basePath: process.env.COMM_SERVICE_URL,
  accessToken: process.env.COMM_SERVICE_TOKEN
}));

// Send notification when sync completes
async function notifySyncComplete(transactionCount: number) {
  try {
    const response = await messagesApi.v1MessagesSendPost(
      `bank-sync-${Date.now()}`, // Idempotency key
      {
        channel: 'telegram',
        template_key: 'bank_sync.complete',
        locale: 'en',
        data: {
          title: 'Bank Sync Complete ✅',
          body: `Successfully synced ${transactionCount} transactions from GoCardless.`
        },
        to: {} // Empty - will use admin Telegram IDs from comm-service config
      }
    );
    
    console.log('Notification sent:', response.data.message_id);
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
}
```

## Important Notes

1. The token has no expiration for service-to-service communication
2. The `to` field should be an empty object `{}` - comm-service will auto-detect admin IDs
3. Use unique idempotency keys to prevent duplicate messages
4. The service must be able to reach `http://192.168.1.11:8080`

## Regenerating Token

If you need to regenerate the token:

```bash
cd /path/to/comm-service
node scripts/generate-token.js bank-sync-service
```

Or use the Make command:
```bash
make token SERVICE=bank-sync-service
```