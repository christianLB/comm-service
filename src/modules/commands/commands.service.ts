import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { v4 as uuidv4 } from 'uuid';
import { firstValueFrom } from 'rxjs';
import { RedisService } from '../../common/redis/redis.service';
import { CommandDispatchRequestDto, CommandAcceptedDto, CommandStatus } from './dto/command.dto';
import { Channel } from '../../common/dto/common.dto';
import { TelegramService } from '../telegram/telegram.service';
import { EmailService } from '../email/email.service';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class CommandsService {
  private readonly logger = new Logger(CommandsService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly telegramService: TelegramService,
    private readonly emailService: EmailService,
    private readonly authService: AuthService,
  ) {}

  async dispatchCommand(
    dto: CommandDispatchRequestDto,
    idempotencyKey?: string,
  ): Promise<CommandAcceptedDto> {
    const commandId = `cmd_${uuidv4()}`;
    
    // Store command in Redis
    await this.storeCommand(commandId, dto);

    // Log audit trail
    await this.logAudit(commandId, dto);

    let status: CommandStatus;

    if (dto.require_confirmation) {
      // Send confirmation request
      await this.sendConfirmationRequest(commandId, dto);
      status = CommandStatus.PENDING_CONFIRMATION;
    } else {
      // Queue for immediate execution
      await this.queueCommand(commandId, dto);
      status = CommandStatus.QUEUED;
      
      // Execute command asynchronously
      this.executeCommand(commandId, dto).catch(error => {
        this.logger.error(`Failed to execute command ${commandId}:`, error);
      });
    }

    return {
      command_id: commandId,
      status,
    };
  }

  private async storeCommand(commandId: string, dto: CommandDispatchRequestDto): Promise<void> {
    const ttl = dto.routing?.ttl_seconds || 300;
    await this.redisService.set(
      `command:${commandId}`,
      JSON.stringify({
        ...dto,
        created_at: new Date().toISOString(),
      }),
      ttl,
    );
  }

  private async logAudit(commandId: string, dto: CommandDispatchRequestDto): Promise<void> {
    const auditEntry = {
      command_id: commandId,
      service: dto.service,
      action: dto.action,
      args: dto.args,
      requested_by: dto.audit?.requested_by || 'system',
      trace_id: dto.audit?.trace_id || uuidv4(),
      timestamp: new Date().toISOString(),
    };

    await this.redisService.lpush('audit:commands', JSON.stringify(auditEntry));
    this.logger.log(`Audit logged for command ${commandId}`, auditEntry);
  }

  private async sendConfirmationRequest(
    commandId: string,
    dto: CommandDispatchRequestDto,
  ): Promise<void> {
    const channel = dto.channel || Channel.TELEGRAM;
    const message = this.formatConfirmationMessage(dto);

    switch (channel) {
      case Channel.TELEGRAM:
        await this.sendTelegramConfirmation(commandId, message);
        break;
      case Channel.EMAIL:
        await this.sendEmailConfirmation(commandId, dto, message);
        break;
      default:
        throw new Error(`Unsupported channel: ${channel}`);
    }
  }

  private formatConfirmationMessage(dto: CommandDispatchRequestDto): string {
    let message = `¿Confirmás ejecutar el comando?\n\n`;
    message += `Servicio: ${dto.service}\n`;
    message += `Acción: ${dto.action}\n`;
    
    if (dto.args && Object.keys(dto.args).length > 0) {
      message += `Parámetros:\n`;
      Object.entries(dto.args).forEach(([key, value]) => {
        message += `  - ${key}: ${JSON.stringify(value)}\n`;
      });
    }

    return message;
  }

  private async sendTelegramConfirmation(commandId: string, message: string): Promise<void> {
    const adminIds = this.configService.get<string[]>('app.telegram.adminIds', []);
    
    for (const adminId of adminIds) {
      await this.telegramService.sendMessageWithConfirmation(
        parseInt(adminId),
        message,
        commandId,
      );
    }
  }

  private async sendEmailConfirmation(
    commandId: string,
    dto: CommandDispatchRequestDto,
    message: string,
  ): Promise<void> {
    const adminEmail = dto.audit?.requested_by || this.configService.get<string>('app.email.admin');
    
    if (!adminEmail) {
      throw new Error('Admin email not configured');
    }

    const magicLink = await this.generateConfirmationLink(commandId);
    await this.emailService.sendEmailWithConfirmation(
      adminEmail,
      'Command Confirmation Required',
      message,
      magicLink,
    );
  }

  private async generateConfirmationLink(commandId: string): Promise<string> {
    const baseUrl = this.configService.get<string>('app.baseUrl', 'http://localhost:8080');
    const token = await this.authService.generateMagicLinkToken({ commandId, action: 'confirm' });
    return `${baseUrl}/v1/commands/confirm?token=${token}`;
  }

  async confirmCommand(commandId: string, confirmed: boolean): Promise<void> {
    const commandData = await this.redisService.get(`command:${commandId}`);
    
    if (!commandData) {
      throw new HttpException('Command not found or expired', HttpStatus.NOT_FOUND);
    }

    const dto: CommandDispatchRequestDto = JSON.parse(commandData);

    if (confirmed) {
      await this.queueCommand(commandId, dto);
      await this.executeCommand(commandId, dto);
    } else {
      await this.updateCommandStatus(commandId, 'rejected');
      this.logger.log(`Command ${commandId} was rejected`);
    }
  }

  private async queueCommand(commandId: string, dto: CommandDispatchRequestDto): Promise<void> {
    await this.redisService.lpush(
      `queue:commands:${dto.service}`,
      JSON.stringify({
        command_id: commandId,
        created_at: new Date().toISOString(),
      }),
    );
  }

  private async executeCommand(
    commandId: string,
    dto: CommandDispatchRequestDto,
  ): Promise<void> {
    try {
      await this.updateCommandStatus(commandId, 'processing');

      // Get service URL
      const serviceUrl = this.getServiceUrl(dto.service);
      
      // Generate service token
      const token = await this.authService.generateServiceToken('comm-service', ['command.execute']);

      // Make HTTP request to target service
      const response = await firstValueFrom(
        this.httpService.post(
          `${serviceUrl}/v1/commands/${dto.action}`,
          dto.args || {},
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-Command-Id': commandId,
              'X-Trace-Id': dto.audit?.trace_id || uuidv4(),
            },
            timeout: this.configService.get<number>('app.webhook.timeout', 5000),
          },
        ),
      );

      await this.updateCommandStatus(commandId, 'completed');
      await this.storeCommandResult(commandId, response.data);

      this.logger.log(`Command ${commandId} executed successfully`);
    } catch (error) {
      this.logger.error(`Failed to execute command ${commandId}:`, error);
      await this.updateCommandStatus(commandId, 'failed');
      await this.storeCommandError(commandId, error.message);
      
      // Retry logic could be added here
      if (dto.routing?.fallback?.length > 0) {
        await this.retryWithFallback(commandId, dto);
      }
    }
  }

  private getServiceUrl(service: string): string {
    const serviceKey = service.replace('-service', '');
    const url = this.configService.get<string>(`app.services.${serviceKey}`);
    
    if (!url) {
      throw new Error(`Service URL not configured for ${service}`);
    }
    
    return url;
  }

  private async updateCommandStatus(commandId: string, status: string): Promise<void> {
    await this.redisService.hset(`command:${commandId}:status`, 'status', status);
    await this.redisService.hset(
      `command:${commandId}:status`,
      'updated_at',
      new Date().toISOString(),
    );
  }

  private async storeCommandResult(commandId: string, result: any): Promise<void> {
    await this.redisService.set(
      `command:${commandId}:result`,
      JSON.stringify(result),
      86400, // 24 hours
    );
  }

  private async storeCommandError(commandId: string, error: string): Promise<void> {
    await this.redisService.set(
      `command:${commandId}:error`,
      error,
      86400, // 24 hours
    );
  }

  private async retryWithFallback(commandId: string, dto: CommandDispatchRequestDto): Promise<void> {
    // Implement retry logic with exponential backoff
    // This is a simplified version
    setTimeout(() => {
      this.executeCommand(commandId, dto).catch(error => {
        this.logger.error(`Retry failed for command ${commandId}:`, error);
      });
    }, 5000);
  }
}