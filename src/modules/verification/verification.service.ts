import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '../../common/redis/redis.service';
import {
  VerificationStartRequestDto,
  VerificationStartedDto,
  VerificationConfirmRequestDto,
  VerificationResultDto,
  VerificationMethod,
  VerificationMode,
} from './dto/verification.dto';
import { TelegramService } from '../telegram/telegram.service';
import { EmailService } from '../email/email.service';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly telegramService: TelegramService,
    private readonly emailService: EmailService,
    private readonly authService: AuthService,
  ) {}

  async startVerification(
    dto: VerificationStartRequestDto,
    idempotencyKey?: string,
  ): Promise<VerificationStartedDto> {
    const verificationId = `ver_${uuidv4()}`;
    const ttl = dto.ttl_seconds || 600;
    const expiresAt = new Date(Date.now() + ttl * 1000);

    // Generate OTP or magic link token
    const token = dto.mode === VerificationMode.OTP 
      ? this.generateOTP() 
      : await this.generateMagicLinkToken(verificationId);

    // Store verification data
    await this.storeVerification(verificationId, dto, token, ttl);

    // Send verification based on method
    await this.sendVerification(verificationId, dto, token);

    return {
      verification_id: verificationId,
      method: dto.method,
      mode: dto.mode,
      expires_at: expiresAt.toISOString(),
    };
  }

  async confirmVerification(dto: VerificationConfirmRequestDto): Promise<VerificationResultDto> {
    const verificationData = await this.redisService.get(`verification:${dto.verification_id}`);
    
    if (!verificationData) {
      throw new HttpException('Verification not found or expired', HttpStatus.GONE);
    }

    const verification = JSON.parse(verificationData);
    
    // Check if token matches
    const isValid = await this.validateToken(dto.token, verification.token, verification.mode);
    
    if (!isValid) {
      // Increment failed attempts
      await this.incrementFailedAttempts(dto.verification_id);
      
      // Check if max attempts exceeded
      const attempts = await this.getFailedAttempts(dto.verification_id);
      if (attempts >= 3) {
        await this.redisService.del(`verification:${dto.verification_id}`);
        throw new HttpException('Max verification attempts exceeded', HttpStatus.TOO_MANY_REQUESTS);
      }
      
      throw new HttpException('Invalid verification token', HttpStatus.BAD_REQUEST);
    }

    // Mark as verified
    await this.markAsVerified(dto.verification_id);

    return {
      verified: true,
      verification_id: dto.verification_id,
      purpose: verification.purpose,
      metadata: verification.metadata || {},
    };
  }

  private generateOTP(): string {
    // Generate 6-digit OTP
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async generateMagicLinkToken(verificationId: string): Promise<string> {
    return this.authService.generateMagicLinkToken({
      verification_id: verificationId,
      timestamp: Date.now(),
    });
  }

  private async storeVerification(
    verificationId: string,
    dto: VerificationStartRequestDto,
    token: string,
    ttl: number,
  ): Promise<void> {
    const data = {
      ...dto,
      token,
      created_at: new Date().toISOString(),
      attempts: 0,
    };

    await this.redisService.set(
      `verification:${verificationId}`,
      JSON.stringify(data),
      ttl,
    );
  }

  private async sendVerification(
    verificationId: string,
    dto: VerificationStartRequestDto,
    token: string,
  ): Promise<void> {
    switch (dto.method) {
      case VerificationMethod.EMAIL:
        await this.sendEmailVerification(dto, token);
        break;
      case VerificationMethod.TELEGRAM:
        await this.sendTelegramVerification(dto, token);
        break;
      default:
        throw new Error(`Unsupported verification method: ${dto.method}`);
    }
  }

  private async sendEmailVerification(
    dto: VerificationStartRequestDto,
    token: string,
  ): Promise<void> {
    if (!dto.to.email) {
      throw new HttpException('Email address is required', HttpStatus.BAD_REQUEST);
    }

    const subject = `Verification Code for ${dto.purpose}`;
    let body: string;

    if (dto.mode === VerificationMode.OTP) {
      body = `Your verification code is: ${token}\n\nThis code will expire in ${dto.ttl_seconds / 60} minutes.`;
    } else {
      const magicLink = await this.generateMagicLinkUrl(token);
      body = `Click the link below to verify:\n\n${magicLink}\n\nThis link will expire in ${dto.ttl_seconds / 60} minutes.`;
    }

    await this.emailService.sendEmail(dto.to.email, subject, body);
  }

  private async sendTelegramVerification(
    dto: VerificationStartRequestDto,
    token: string,
  ): Promise<void> {
    if (!dto.to.telegram_chat_id) {
      throw new HttpException('Telegram chat ID is required', HttpStatus.BAD_REQUEST);
    }

    let message: string;

    if (dto.mode === VerificationMode.OTP) {
      message = `🔐 Your verification code is: **${token}**\n\nThis code will expire in ${dto.ttl_seconds / 60} minutes.`;
    } else {
      const magicLink = await this.generateMagicLinkUrl(token);
      message = `🔐 Click the link below to verify:\n\n${magicLink}\n\nThis link will expire in ${dto.ttl_seconds / 60} minutes.`;
    }

    await this.telegramService.sendMessage(dto.to.telegram_chat_id, message);
  }

  private async generateMagicLinkUrl(token: string): Promise<string> {
    const baseUrl = this.configService.get<string>('app.baseUrl', 'http://localhost:8080');
    return `${baseUrl}/v1/verification/magic-link?token=${encodeURIComponent(token)}`;
  }

  private async validateToken(
    providedToken: string,
    storedToken: string,
    mode: VerificationMode,
  ): Promise<boolean> {
    if (mode === VerificationMode.OTP) {
      // Direct comparison for OTP
      return providedToken === storedToken;
    } else {
      // Validate JWT for magic link
      try {
        await this.authService.verifyMagicLinkToken(providedToken);
        return providedToken === storedToken;
      } catch {
        return false;
      }
    }
  }

  private async incrementFailedAttempts(verificationId: string): Promise<void> {
    const key = `verification:${verificationId}:attempts`;
    const current = await this.redisService.get(key);
    const attempts = current ? parseInt(current) + 1 : 1;
    await this.redisService.set(key, attempts.toString(), 600);
  }

  private async getFailedAttempts(verificationId: string): Promise<number> {
    const key = `verification:${verificationId}:attempts`;
    const attempts = await this.redisService.get(key);
    return attempts ? parseInt(attempts) : 0;
  }

  private async markAsVerified(verificationId: string): Promise<void> {
    await this.redisService.set(
      `verification:${verificationId}:verified`,
      'true',
      86400, // Keep for 24 hours
    );
    
    // Clean up verification data
    await this.redisService.del(`verification:${verificationId}`);
    await this.redisService.del(`verification:${verificationId}:attempts`);
  }
}