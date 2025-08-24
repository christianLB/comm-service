import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../common/redis/redis.service';
import { EventInDto, EventStatus } from './dto/event.dto';
import { TelegramService } from '../telegram/telegram.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly telegramService: TelegramService,
    private readonly emailService: EmailService,
  ) {}

  async handleEvent(dto: EventInDto): Promise<void> {
    // Store event
    await this.storeEvent(dto);

    // Update command status
    await this.updateCommandStatus(dto);

    // Process event based on status
    await this.processEvent(dto);

    // Notify relevant parties
    await this.notifyEvent(dto);

    // Update metrics
    await this.updateMetrics(dto);

    this.logger.log(`Event processed for command ${dto.command_id} from ${dto.service}`);
  }

  private async storeEvent(dto: EventInDto): Promise<void> {
    const eventKey = `event:${dto.command_id}:${Date.now()}`;
    await this.redisService.set(
      eventKey,
      JSON.stringify({
        ...dto,
        received_at: new Date().toISOString(),
      }),
      86400, // 24 hours
    );

    // Add to event stream
    await this.redisService.lpush(
      `events:${dto.service}`,
      JSON.stringify({
        command_id: dto.command_id,
        status: dto.status,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  private async updateCommandStatus(dto: EventInDto): Promise<void> {
    const statusKey = `command:${dto.command_id}:status`;
    
    await this.redisService.hset(statusKey, 'status', dto.status);
    await this.redisService.hset(statusKey, 'service', dto.service);
    await this.redisService.hset(statusKey, 'updated_at', new Date().toISOString());

    if (dto.output) {
      await this.redisService.hset(statusKey, 'output', JSON.stringify(dto.output));
    }

    if (dto.error) {
      await this.redisService.hset(statusKey, 'error', dto.error);
    }
  }

  private async processEvent(dto: EventInDto): Promise<void> {
    switch (dto.status) {
      case EventStatus.COMPLETED:
        await this.handleCompletedEvent(dto);
        break;
      case EventStatus.FAILED:
        await this.handleFailedEvent(dto);
        break;
      case EventStatus.PROCESSING:
        await this.handleProcessingEvent(dto);
        break;
      case EventStatus.PENDING:
        // No special processing for pending status
        break;
    }
  }

  private async handleCompletedEvent(dto: EventInDto): Promise<void> {
    // Store successful result
    if (dto.output) {
      await this.redisService.set(
        `command:${dto.command_id}:result`,
        JSON.stringify(dto.output),
        86400, // 24 hours
      );
    }

    // Log success
    this.logger.log(`Command ${dto.command_id} completed successfully`, dto.output);
  }

  private async handleFailedEvent(dto: EventInDto): Promise<void> {
    // Store error details
    if (dto.error) {
      await this.redisService.set(
        `command:${dto.command_id}:error`,
        dto.error,
        86400, // 24 hours
      );
    }

    // Log failure
    this.logger.error(`Command ${dto.command_id} failed: ${dto.error}`);

    // Check if retry is needed
    const commandData = await this.redisService.get(`command:${dto.command_id}`);
    if (commandData) {
      const command = JSON.parse(commandData);
      if (command.routing?.fallback?.length > 0) {
        // Schedule retry
        await this.scheduleRetry(dto.command_id, command);
      }
    }
  }

  private async handleProcessingEvent(dto: EventInDto): Promise<void> {
    // Update processing status
    this.logger.debug(`Command ${dto.command_id} is being processed by ${dto.service}`);
  }

  private async scheduleRetry(commandId: string, command: any): Promise<void> {
    // Add to retry queue
    await this.redisService.lpush(
      'queue:retries',
      JSON.stringify({
        command_id: commandId,
        command,
        retry_at: new Date(Date.now() + 5000).toISOString(), // Retry after 5 seconds
      }),
    );
  }

  private async notifyEvent(dto: EventInDto): Promise<void> {
    // Get notification preferences
    const commandData = await this.redisService.get(`command:${dto.command_id}`);
    if (!commandData) {
      return;
    }

    const command = JSON.parse(commandData);
    const notificationMessage = this.formatNotificationMessage(dto, command);

    // Notify via configured channels
    if (command.channel === 'telegram' || !command.channel) {
      await this.notifyViaTelegram(notificationMessage, command);
    }

    if (command.channel === 'email') {
      await this.notifyViaEmail(notificationMessage, command);
    }
  }

  private formatNotificationMessage(dto: EventInDto, command: any): string {
    let message = `📊 Command Update\n\n`;
    message += `Command ID: ${dto.command_id}\n`;
    message += `Service: ${dto.service}\n`;
    message += `Action: ${command.action}\n`;
    message += `Status: ${this.getStatusEmoji(dto.status)} ${dto.status}\n`;

    if (dto.status === EventStatus.COMPLETED && dto.output) {
      message += `\nResult:\n${JSON.stringify(dto.output, null, 2)}`;
    }

    if (dto.status === EventStatus.FAILED && dto.error) {
      message += `\nError: ${dto.error}`;
    }

    if (dto.metrics?.latency_ms) {
      message += `\nLatency: ${dto.metrics.latency_ms}ms`;
    }

    return message;
  }

  private getStatusEmoji(status: EventStatus): string {
    switch (status) {
      case EventStatus.COMPLETED:
        return '✅';
      case EventStatus.FAILED:
        return '❌';
      case EventStatus.PROCESSING:
        return '⏳';
      case EventStatus.PENDING:
        return '⏸️';
      default:
        return '❓';
    }
  }

  private async notifyViaTelegram(message: string, command: any): Promise<void> {
    const adminIds = this.configService.get<string[]>('app.telegram.adminIds', []);
    
    for (const adminId of adminIds) {
      try {
        await this.telegramService.sendMessage(parseInt(adminId), message);
      } catch (error) {
        this.logger.error(`Failed to notify Telegram user ${adminId}:`, error);
      }
    }
  }

  private async notifyViaEmail(message: string, command: any): Promise<void> {
    const adminEmail = command.audit?.requested_by || this.configService.get<string>('app.email.admin');
    
    if (adminEmail) {
      try {
        await this.emailService.sendEmail(
          adminEmail,
          `Command ${command.command_id} - ${command.status}`,
          message,
        );
      } catch (error) {
        this.logger.error(`Failed to notify via email ${adminEmail}:`, error);
      }
    }
  }

  private async updateMetrics(dto: EventInDto): Promise<void> {
    if (!dto.metrics) {
      return;
    }

    // Store metrics
    const metricsKey = `metrics:${dto.service}:${new Date().toISOString().split('T')[0]}`;
    
    if (dto.metrics.latency_ms) {
      await this.redisService.lpush(
        `${metricsKey}:latency`,
        dto.metrics.latency_ms.toString(),
      );
    }

    // Increment counters
    const statusKey = `${metricsKey}:status:${dto.status}`;
    const currentCount = await this.redisService.get(statusKey);
    const newCount = (currentCount ? parseInt(currentCount) : 0) + 1;
    await this.redisService.set(statusKey, newCount.toString(), 86400 * 7); // Keep for 7 days
  }
}