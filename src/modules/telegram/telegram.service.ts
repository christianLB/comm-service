import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Context, Markup } from 'telegraf';
import { RedisService } from '../../common/redis/redis.service';
import { CommandsService } from '../commands/commands.service';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Telegraf;
  private adminIds: Set<number>;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    // Read directly from environment variables
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (token) {
      this.bot = new Telegraf(token);
      
      // Parse admin IDs from comma-separated string
      const adminIdsString = this.configService.get<string>('ADMINS_TELEGRAM_IDS', '');
      const adminIdsList = adminIdsString
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0)
        .map(id => parseInt(id, 10))
        .filter(id => !isNaN(id));
      
      this.adminIds = new Set(adminIdsList);
      
      // Log for debugging
      this.logger.log(`Telegram bot initialized with token: ${token.substring(0, 10)}...`);
      this.logger.log(`Admin IDs configured: ${Array.from(this.adminIds).join(', ')}`);
    }
  }

  async onModuleInit() {
    const enableTelegram = this.configService.get<string>('ENABLE_TELEGRAM') === 'true';
    
    if (!enableTelegram) {
      this.logger.warn('Telegram bot disabled by configuration');
      return;
    }

    if (!this.bot) {
      this.logger.warn('Telegram bot token not configured, skipping initialization');
      return;
    }

    try {
      await this.setupBotHandlers();
      // Launch bot without blocking
      this.bot.launch().then(async () => {
        this.logger.log('Telegram bot started successfully');
        
        // Send startup notification to all admins
        try {
          const adminIdsList = Array.from(this.adminIds);
          for (const adminId of adminIdsList) {
            await this.bot.telegram.sendMessage(
              adminId,
              '🚀 **Comm-Service Bot Started**\n\n' +
              '✅ Bot is online and ready!\n' +
              `📅 Started at: ${new Date().toISOString()}\n` +
              `🌍 Environment: ${process.env.NODE_ENV || 'development'}\n` +
              `👤 Your Admin ID: ${adminId}\n\n` +
              'Type /help to see available commands.',
              { parse_mode: 'Markdown' }
            );
            this.logger.log(`Startup notification sent to admin: ${adminId}`);
          }
        } catch (notifyError) {
          this.logger.warn(`Could not send startup notification: ${notifyError.message}`);
        }
      }).catch((error) => {
        this.logger.error('Failed to start Telegram bot:', error);
      });
    } catch (error) {
      this.logger.error('Failed to setup Telegram bot:', error);
      // Don't crash the application if Telegram fails
    }
  }

  private async setupBotHandlers() {
    // Middleware to check if user is admin
    this.bot.use(async (ctx, next) => {
      const userId = ctx.from?.id;
      const username = ctx.from?.username || 'unknown';
      
      this.logger.log(`Telegram access attempt - User ID: ${userId}, Username: ${username}`);
      this.logger.log(`Configured admin IDs: ${Array.from(this.adminIds).join(', ')}`);
      
      if (userId && this.adminIds.has(userId)) {
        this.logger.log(`Access granted for user ${userId}`);
        await next();
      } else {
        this.logger.warn(`Access denied for user ${userId} - not in admin list`);
        await ctx.reply('⛔ Unauthorized. This bot is for administrators only.');
      }
    });

    // Handle /start command
    this.bot.command('start', async (ctx) => {
      await ctx.reply(
        '👋 Welcome to Comm Service Bot!\n\n' +
        'Quick commands:\n' +
        '/health - System health check\n' +
        '/ping - Test bot connectivity\n' +
        '/services - Check microservices\n\n' +
        'Service commands:\n' +
        '/cmd <service.action> [args] - Execute a command\n' +
        '/status <command_id> - Check command status\n' +
        '/help - Show detailed help'
      );
    });

    // Handle /help command
    this.bot.command('help', async (ctx) => {
      await ctx.reply(
        '📚 **Help**\n\n' +
        '**Health & Status:**\n' +
        '• `/health` - System health check\n' +
        '• `/ping` - Test bot connectivity\n' +
        '• `/services` - Check all services status\n\n' +
        '**Commands:**\n' +
        '• `/cmd trading.strategy.pause strategy_id=btc-arb-01` - Pause trading strategy\n' +
        '• `/cmd financial.report.generate month=july` - Generate financial report\n' +
        '• `/status cmd_abc123` - Check command status\n\n' +
        '**Services:**\n' +
        '• trading-service\n' +
        '• financial-service\n' +
        '• ai-service\n' +
        '• memory-service',
        { parse_mode: 'Markdown' }
      );
    });

    // Handle /ping command - Simple connectivity test
    this.bot.command('ping', async (ctx) => {
      await ctx.reply('🏓 Pong! Bot is alive and responding.');
    });

    // Handle /health command - Full system health check
    this.bot.command('health', async (ctx) => {
      try {
        // Check Redis
        const redisStatus = await this.checkRedisHealth();
        
        // Get system info
        const uptime = process.uptime();
        const memoryUsage = process.memoryUsage();
        const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
        
        const healthMessage = 
          '🏥 **System Health Check**\n\n' +
          `✅ **Status:** Healthy\n` +
          `🤖 **Service:** comm-service v0.1.0\n` +
          `📅 **Time:** ${new Date().toISOString()}\n` +
          `⏱️ **Uptime:** ${Math.floor(uptime / 60)} minutes\n` +
          `💾 **Memory:** ${memoryMB} MB\n\n` +
          '**Dependencies:**\n' +
          `• Redis: ${redisStatus ? '✅ Connected' : '❌ Disconnected'}\n` +
          `• Telegram: ✅ Connected\n` +
          `• Environment: ${process.env.NODE_ENV || 'development'}`;
        
        await ctx.reply(healthMessage, { parse_mode: 'Markdown' });
      } catch (error) {
        await ctx.reply('❌ Error checking system health');
      }
    });

    // Handle /services command - Check all microservices
    this.bot.command('services', async (ctx) => {
      const services = [
        { name: 'Trading Service', url: this.configService.get('SERVICE_URLS_TRADING'), emoji: '📈' },
        { name: 'Financial Service', url: this.configService.get('SERVICE_URLS_FINANCIAL'), emoji: '💰' },
        { name: 'AI Service', url: this.configService.get('SERVICE_URLS_AI'), emoji: '🤖' },
        { name: 'Memory Service', url: this.configService.get('SERVICE_URLS_MEMORY'), emoji: '🧠' },
      ];

      let statusMessage = '🔍 **Microservices Status**\n\n';
      
      for (const service of services) {
        if (service.url) {
          // In production, you would actually check the service
          // For now, we'll show them as configured
          statusMessage += `${service.emoji} **${service.name}**\n`;
          statusMessage += `   URL: \`${service.url}\`\n`;
          statusMessage += `   Status: ⚠️ Not checked\n\n`;
        } else {
          statusMessage += `${service.emoji} **${service.name}**\n`;
          statusMessage += `   Status: ❌ Not configured\n\n`;
        }
      }
      
      await ctx.reply(statusMessage, { parse_mode: 'Markdown' });
    });

    // Handle /cmd command
    this.bot.command('cmd', async (ctx) => {
      const args = ctx.message.text.split(' ').slice(1);
      if (args.length === 0) {
        await ctx.reply('❌ Usage: /cmd <service.action> [args]');
        return;
      }

      const [serviceAction, ...params] = args;
      const [service, action] = serviceAction.split('.');

      if (!service || !action) {
        await ctx.reply('❌ Invalid format. Use: service.action');
        return;
      }

      // Parse arguments
      const parsedArgs = this.parseCommandArgs(params);

      // Store command request
      const commandId = await this.storeCommandRequest(service, action, parsedArgs, ctx.from.id);

      // Send confirmation request
      await this.sendConfirmationRequest(ctx, commandId, service, action, parsedArgs);
    });

    // Handle /status command
    this.bot.command('status', async (ctx) => {
      const args = ctx.message.text.split(' ').slice(1);
      if (args.length === 0) {
        await ctx.reply('❌ Usage: /status <command_id>');
        return;
      }

      const commandId = args[0];
      const status = await this.getCommandStatus(commandId);

      if (!status) {
        await ctx.reply(`❌ Command ${commandId} not found`);
        return;
      }

      await ctx.reply(
        `📊 **Command Status**\n\n` +
        `ID: \`${commandId}\`\n` +
        `Status: ${status.status}\n` +
        `Service: ${status.service || 'N/A'}\n` +
        `Updated: ${status.updated_at || 'N/A'}`,
        { parse_mode: 'Markdown' }
      );
    });

    // Handle callback queries (button clicks)
    this.bot.on('callback_query', async (ctx) => {
      if ('data' in ctx.callbackQuery) {
        const data = ctx.callbackQuery.data;
        if (!data) return;

        const [action, commandId] = data.split(':');

        if (action === 'confirm' || action === 'reject') {
          await this.handleConfirmation(ctx, commandId, action === 'confirm');
        }
      }

      await ctx.answerCbQuery();
    });
  }

  private parseCommandArgs(params: string[]): Record<string, any> {
    const args: Record<string, any> = {};
    
    params.forEach(param => {
      const [key, value] = param.split('=');
      if (key && value) {
        // Try to parse as JSON, fallback to string
        try {
          args[key] = JSON.parse(value);
        } catch {
          args[key] = value;
        }
      }
    });

    return args;
  }

  private async storeCommandRequest(
    service: string,
    action: string,
    args: Record<string, any>,
    userId: number,
  ): Promise<string> {
    const commandId = `cmd_tg_${Date.now()}`;
    
    await this.redisService.set(
      `telegram:command:${commandId}`,
      JSON.stringify({
        service: `${service}-service`,
        action,
        args,
        requested_by: userId,
        created_at: new Date().toISOString(),
      }),
      300, // 5 minutes TTL
    );

    return commandId;
  }

  private async sendConfirmationRequest(
    ctx: Context,
    commandId: string,
    service: string,
    action: string,
    args: Record<string, any>,
  ) {
    const message = 
      `🤔 **Confirmation Required**\n\n` +
      `Service: ${service}\n` +
      `Action: ${action}\n` +
      `${Object.keys(args).length > 0 ? `Args: ${JSON.stringify(args, null, 2)}\n` : ''}` +
      `\nDo you want to execute this command?`;

    await ctx.reply(
      message,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Yes', `confirm:${commandId}`),
            Markup.button.callback('❌ No', `reject:${commandId}`),
          ],
        ]),
      }
    );
  }

  private async handleConfirmation(ctx: Context, commandId: string, confirmed: boolean) {
    const commandData = await this.redisService.get(`telegram:command:${commandId}`);
    
    if (!commandData) {
      await ctx.reply('❌ Command expired or not found');
      return;
    }

    const command = JSON.parse(commandData);

    if (confirmed) {
      // Import CommandsService dynamically to avoid circular dependency
      const { CommandsService } = await import('../commands/commands.service');
      const commandsService = (this as any).commandsService as CommandsService;
      
      if (commandsService) {
        await commandsService.confirmCommand(commandId, true);
        await ctx.reply(`✅ Command ${commandId} confirmed and queued for execution`);
      } else {
        await ctx.reply('❌ Commands service not available');
      }
    } else {
      await ctx.reply(`❌ Command ${commandId} rejected`);
    }

    // Clean up
    await this.redisService.del(`telegram:command:${commandId}`);
  }

  private async getCommandStatus(commandId: string): Promise<any> {
    const statusData = await this.redisService.hgetall(`command:${commandId}:status`);
    return Object.keys(statusData).length > 0 ? statusData : null;
  }

  async sendMessage(chatId: number, text: string): Promise<void> {
    if (!this.bot) {
      throw new Error('Telegram bot not initialized');
    }

    await this.bot.telegram.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
    });
  }

  async sendMessageWithConfirmation(
    chatId: number,
    text: string,
    referenceId: string,
  ): Promise<void> {
    if (!this.bot) {
      throw new Error('Telegram bot not initialized');
    }

    await this.bot.telegram.sendMessage(
      chatId,
      text,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Yes', `confirm:${referenceId}`),
            Markup.button.callback('❌ No', `reject:${referenceId}`),
          ],
        ]),
      }
    );
  }

  async sendPhoto(chatId: number, photo: Buffer | string, caption?: string): Promise<void> {
    if (!this.bot) {
      throw new Error('Telegram bot not initialized');
    }

    const input = typeof photo === 'string' ? photo : { source: photo };
    await this.bot.telegram.sendPhoto(chatId, input, {
      caption,
      parse_mode: 'Markdown',
    });
  }

  async sendDocument(chatId: number, document: Buffer | string, caption?: string): Promise<void> {
    if (!this.bot) {
      throw new Error('Telegram bot not initialized');
    }

    const input = typeof document === 'string' ? document : { source: document };
    await this.bot.telegram.sendDocument(chatId, input, {
      caption,
      parse_mode: 'Markdown',
    });
  }

  private async checkRedisHealth(): Promise<boolean> {
    try {
      const result = await this.redisService.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }
}