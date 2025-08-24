import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, IsInt, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum EventStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export class EventMetricsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  latency_ms?: number;

  [key: string]: any;
}

export class EventInDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  command_id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  service: string;

  @ApiProperty({ enum: EventStatus })
  @IsEnum(EventStatus)
  @IsNotEmpty()
  status: EventStatus;

  @ApiPropertyOptional({ 
    type: Object,
    additionalProperties: true 
  })
  @IsOptional()
  @IsObject()
  output?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  error?: string;

  @ApiPropertyOptional({ type: EventMetricsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EventMetricsDto)
  metrics?: EventMetricsDto;
}