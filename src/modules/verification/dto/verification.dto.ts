import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, IsInt, Min, Max, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ToDto } from '../../../common/dto/common.dto';

export enum VerificationMethod {
  EMAIL = 'email',
  TELEGRAM = 'telegram',
}

export enum VerificationMode {
  OTP = 'otp',
  MAGIC_LINK = 'magic_link',
}

export class VerificationStartRequestDto {
  @ApiProperty({ enum: VerificationMethod })
  @IsEnum(VerificationMethod)
  @IsNotEmpty()
  method: VerificationMethod;

  @ApiProperty({ example: 'login' })
  @IsString()
  @IsNotEmpty()
  purpose: string;

  @ApiProperty({ type: ToDto })
  @ValidateNested()
  @Type(() => ToDto)
  @IsNotEmpty()
  to: ToDto;

  @ApiProperty({ enum: VerificationMode })
  @IsEnum(VerificationMode)
  @IsNotEmpty()
  mode: VerificationMode;

  @ApiPropertyOptional({ 
    minimum: 60,
    maximum: 3600,
    default: 600 
  })
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(3600)
  ttl_seconds?: number;
}

export class VerificationStartedDto {
  @ApiProperty({ example: 'ver_abc' })
  verification_id: string;

  @ApiProperty({ enum: VerificationMethod })
  method: VerificationMethod;

  @ApiProperty({ enum: VerificationMode })
  mode: VerificationMode;

  @ApiProperty({ format: 'date-time' })
  expires_at: string;
}

export class VerificationConfirmRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  verification_id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class VerificationResultDto {
  @ApiProperty()
  @IsBoolean()
  verified: boolean;

  @ApiProperty()
  @IsString()
  verification_id: string;

  @ApiProperty()
  @IsString()
  purpose: string;

  @ApiPropertyOptional({ 
    type: Object,
    additionalProperties: true 
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}