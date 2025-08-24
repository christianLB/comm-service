# 🤖 Telegram Bot Setup Guide

## Prerequisites

Before setting up the Telegram integration, you need:
1. A Telegram account
2. Your Telegram user ID
3. A bot token from BotFather

## Step 1: Create Your Bot

1. **Open Telegram** and search for `@BotFather`
2. **Start a conversation** with BotFather
3. **Create a new bot**:
   ```
   /newbot
   ```
4. **Choose a name** for your bot (e.g., "Comm Service Bot")
5. **Choose a username** for your bot (must end in `bot`, e.g., `comm_service_bot`)
6. **Save the token** that BotFather gives you (looks like: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

## Step 2: Find Your Telegram User ID

### Method 1: Using UserInfoBot (Recommended)
1. Search for `@userinfobot` on Telegram
2. Start a conversation with it
3. It will immediately reply with your user info
4. Copy your ID (a number like `5015255679`)

### Method 2: From Application Logs
1. Try to use your bot without being authorized
2. Check the logs:
   ```bash
   docker logs comm-service | grep "Telegram access attempt"
   ```
3. Your user ID will be shown in the logs

### Method 3: Using Raw API
```bash
# After your bot is running, send it a message, then:
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
# Look for "from": {"id": YOUR_USER_ID}
```

## Step 3: Configure Environment Variables

Edit your `.env` or `.env.production` file:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=7675285244:AAHcM733tpyttgRPWITfeQOAGnrtbrWThpE
ADMINS_TELEGRAM_IDS=5015255679

# Enable Telegram (set to false to disable)
ENABLE_TELEGRAM=true
```

⚠️ **Important**: 
- No spaces around the comma in `ADMINS_TELEGRAM_IDS`
- Multiple admin IDs: `ADMINS_TELEGRAM_IDS=123456,789012`
- Make sure the ID is exact (no extra digits!)

## Step 4: Test Your Bot

### Initial Setup
1. **Find your bot** on Telegram using the username you created
2. **Start a conversation** by clicking "Start" or sending `/start`
3. **You should receive** a startup notification when the service starts

### Available Commands

| Command | Description |
|---------|-------------|
| `/start` | Initialize bot and see available commands |
| `/ping` | Quick connectivity test |
| `/health` | Full system health check with details |
| `/services` | Check microservices configuration |
| `/help` | Show all available commands |
| `/cmd <service.action> [args]` | Execute a command on a service |
| `/status <command_id>` | Check command execution status |

### Example Commands

```
/ping
→ 🏓 Pong! Bot is alive and responding.

/health
→ 🏥 System Health Check
  ✅ Status: Healthy
  🤖 Service: comm-service v0.1.0
  📅 Time: 2025-08-22T19:41:02.793Z
  ⏱️ Uptime: 45 minutes
  💾 Memory: 62 MB
  • Redis: ✅ Connected
  • Telegram: ✅ Connected
  • Environment: production

/services
→ 🔍 Microservices Status
  📈 Trading Service
     URL: http://192.168.1.11:3001
     Status: ⚠️ Not checked
  ...
```

## Step 5: Troubleshooting

### Bot Shows "Unauthorized"

**Check your user ID in logs:**
```bash
docker logs comm-service | grep "Telegram access attempt"
# Will show: Telegram access attempt - User ID: YOUR_ACTUAL_ID
```

**Verify configuration:**
```bash
docker exec comm-service env | grep ADMINS_TELEGRAM_IDS
# Should show your ID
```

**Common issues:**
- Wrong user ID (extra or missing digits)
- ID not properly loaded from environment
- Bot token is incorrect

### Bot Doesn't Respond At All

**Check if bot is running:**
```bash
docker logs comm-service | grep -i telegram
# Should show: "Telegram bot started successfully"
```

**Verify token is correct:**
```bash
curl https://api.telegram.org/bot<YOUR_TOKEN>/getMe
# Should return bot info if token is valid
```

### Startup Notification Not Received

The bot sends a startup message to all configured admins when it starts. If you don't receive it:

1. Check your admin ID is configured correctly
2. Make sure you've started a conversation with the bot first
3. Check logs for notification errors:
   ```bash
   docker logs comm-service | grep "Startup notification"
   ```

## Advanced Configuration

### Multiple Admins
```env
ADMINS_TELEGRAM_IDS=5015255679,1234567890,9876543210
```

### Disable Telegram Temporarily
```env
ENABLE_TELEGRAM=false
```

### Custom Commands

You can extend the bot by adding new commands in `src/modules/telegram/telegram.service.ts`:

```typescript
// Handle custom command
this.bot.command('custom', async (ctx) => {
  await ctx.reply('Custom command response!');
});
```

## Security Notes

1. **Never share your bot token** - anyone with the token can control your bot
2. **Restrict admin IDs** - only trusted users should be admins
3. **Use environment variables** - never hardcode tokens in source code
4. **Rotate tokens periodically** - create a new bot if token is compromised

## Getting Help

- **BotFather Commands**: Send `/help` to @BotFather
- **Telegram Bot API**: https://core.telegram.org/bots/api
- **Check Logs**: `docker logs comm-service | grep -i telegram`
- **Test Connection**: `/ping` command in your bot