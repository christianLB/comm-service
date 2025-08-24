import { IsEnum, IsOptional, IsInt, Min, Max, IsObject, ValidateNested, IsEmail, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum Channel {
  TELEGRAM = 'telegram',
  EMAIL = 'email',
  AUTO = 'auto',
}

export class RoutingDto {
  @ApiPropertyOptional({
    type: [String],
    enum: Channel,
    description: 'Orden de fallback si falla el canal principal',
  })
  @IsOptional()
  @IsEnum(Channel, { each: true })
  fallback?: Channel[];

  @ApiPropertyOptional({
    minimum: 30,
    maximum: 86400,
    description: 'TTL en segundos',
  })
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(86400)
  ttl_seconds?: number;
}

export class ToDto {
  @ApiPropertyOptional({
    minimum: 1,
    description: 'Telegram chat ID',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  telegram_chat_id?: number;

  @ApiPropertyOptional({
    format: 'email',
    description: 'Email address',
  })
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class ErrorDto {
  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  message: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  details?: Record<string, any>;
}