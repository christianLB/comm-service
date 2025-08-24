import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '../../common/redis/redis.service';
import { MessageSendRequestDto, MessageEnqueuedDto } from './dto/message.dto';
import { Channel } from '../../common/dto/common.dto';
import { TelegramService } from '../telegram/telegram.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly telegramService: TelegramService,
    private readonly emailService: EmailService,
  ) {}

  async sendMessage(
    dto: MessageSendRequestDto,
    idempotencyKey?: string,
  ): Promise<MessageEnqueuedDto> {
    const messageId = `msg_${uuidv4()}`;
    
    // Store message in Redis
    await this.storeMessage(messageId, dto);

    // Determine channel
    const channel = await this.selectChannel(dto);

    // Queue message for processing
    await this.queueMessage(messageId, channel, dto);

    // Process message asynchronously
    this.processMessage(messageId, channel, dto).catch(error => {
      this.logger.error(`Failed to process message ${messageId}:`, error);
    });

    return {
      message_id: messageId,
      status: 'queued',
      channel_selected: channel,
    };
  }

  private async selectChannel(dto: MessageSendRequestDto): Promise<Channel> {
    if (dto.channel === Channel.AUTO) {
      // Auto-select based on availability
      if (dto.to.telegram_chat_id) {
        return Channel.TELEGRAM;
      } else if (dto.to.email) {
        return Channel.EMAIL;
      }
    }
    return dto.channel;
  }

  private async storeMessage(messageId: string, dto: MessageSendRequestDto): Promise<void> {
    const ttl = dto.routing?.ttl_seconds || 300;
    await this.redisService.set(
      `message:${messageId}`,
      JSON.stringify({
        ...dto,
        created_at: new Date().toISOString(),
      }),
      ttl,
    );
  }

  private async queueMessage(
    messageId: string,
    channel: Channel,
    dto: MessageSendRequestDto,
  ): Promise<void> {
    await this.redisService.lpush(
      `queue:messages:${channel}`,
      JSON.stringify({
        message_id: messageId,
        channel,
        created_at: new Date().toISOString(),
      }),
    );
  }

  private async processMessage(
    messageId: string,
    channel: Channel,
    dto: MessageSendRequestDto,
  ): Promise<void> {
    try {
      switch (channel) {
        case Channel.TELEGRAM:
          await this.sendViaTelegram(messageId, dto);
          break;
        case Channel.EMAIL:
          await this.sendViaEmail(messageId, dto);
          break;
        default:
          throw new Error(`Unsupported channel: ${channel}`);
      }

      // Update message status
      await this.updateMessageStatus(messageId, 'sent');
    } catch (error) {
      this.logger.error(`Failed to send message via ${channel}:`, error);
      
      // Try fallback channels
      if (dto.routing?.fallback?.length > 0) {
        await this.tryFallbackChannels(messageId, dto);
      } else {
        await this.updateMessageStatus(messageId, 'failed');
      }
    }
  }

  private async sendViaTelegram(messageId: string, dto: MessageSendRequestDto): Promise<void> {
    // If no chat ID provided, use admin IDs from environment
    let chatId = dto.to.telegram_chat_id;
    
    if (!chatId) {
      const adminIds = this.configService.get<string>('ADMINS_TELEGRAM_IDS', '');
      const adminIdsList = adminIds.split(',').map(id => id.trim()).filter(id => id.length > 0);
      
      if (adminIdsList.length === 0) {
        throw new Error('No Telegram chat ID provided and no admin IDs configured');
      }
      
      // Send to first admin ID (or implement sending to all)
      chatId = parseInt(adminIdsList[0], 10);
    }

    const message = this.formatMessage(dto);
    
    if (dto.require_confirmation) {
      await this.telegramService.sendMessageWithConfirmation(
        chatId,
        message,
        messageId,
      );
    } else {
      await this.telegramService.sendMessage(chatId, message);
    }
  }

  private async sendViaEmail(messageId: string, dto: MessageSendRequestDto): Promise<void> {
    if (!dto.to.email) {
      throw new Error('Email address is required');
    }

    const subject = dto.data.subject || dto.template_key;
    const body = this.formatMessage(dto);

    if (dto.require_confirmation) {
      const magicLink = await this.generateMagicLink(messageId);
      await this.emailService.sendEmailWithConfirmation(
        dto.to.email,
        subject,
        body,
        magicLink,
      );
    } else {
      await this.emailService.sendEmail(dto.to.email, subject, body);
    }
  }

  private formatMessage(dto: MessageSendRequestDto): string {
    // Simple template processing - in production, use a proper template engine
    let message = dto.data.body || dto.data.message || '';
    
    if (dto.data.title) {
      message = `**${dto.data.title}**\n\n${message}`;
    }

    // Replace template variables
    Object.entries(dto.data).forEach(([key, value]) => {
      message = message.replace(`{{${key}}}`, String(value));
    });

    return message;
  }

  private async generateMagicLink(messageId: string): Promise<string> {
    const baseUrl = this.configService.get<string>('app.baseUrl', 'http://localhost:8080');
    const token = await this.generateConfirmationToken(messageId);
    return `${baseUrl}/v1/messages/confirm?token=${token}`;
  }

  private async generateConfirmationToken(messageId: string): Promise<string> {
    // In production, use JWT or similar
    return Buffer.from(`${messageId}:${Date.now()}`).toString('base64');
  }

  private async tryFallbackChannels(
    messageId: string,
    dto: MessageSendRequestDto,
  ): Promise<void> {
    for (const fallbackChannel of dto.routing.fallback) {
      try {
        const fallbackDto = { ...dto, channel: fallbackChannel };
        await this.processMessage(messageId, fallbackChannel, fallbackDto);
        return; // Success, stop trying other fallbacks
      } catch (error) {
        this.logger.error(`Fallback channel ${fallbackChannel} failed:`, error);
      }
    }
    
    // All fallbacks failed
    await this.updateMessageStatus(messageId, 'failed');
  }

  private async updateMessageStatus(messageId: string, status: string): Promise<void> {
    await this.redisService.hset(`message:${messageId}:status`, 'status', status);
    await this.redisService.hset(
      `message:${messageId}:status`,
      'updated_at',
      new Date().toISOString(),
    );
  }
}