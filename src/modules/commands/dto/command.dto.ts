import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Channel, RoutingDto } from '../../../common/dto/common.dto';

export class AuditDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requested_by?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trace_id?: string;
}

export class CommandDispatchRequestDto {
  @ApiProperty({ example: 'trading-service' })
  @IsString()
  @IsNotEmpty()
  service: string;

  @ApiProperty({ example: 'strategy.pause' })
  @IsString()
  @IsNotEmpty()
  action: string;

  @ApiPropertyOptional({ 
    type: Object,
    additionalProperties: true 
  })
  @IsOptional()
  @IsObject()
  args?: Record<string, any>;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  require_confirmation?: boolean;

  @ApiPropertyOptional({ enum: Channel })
  @IsOptional()
  @IsEnum(Channel)
  channel?: Channel;

  @ApiPropertyOptional({ type: RoutingDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RoutingDto)
  routing?: RoutingDto;

  @ApiPropertyOptional({ type: AuditDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AuditDto)
  audit?: AuditDto;
}

export enum CommandStatus {
  PENDING_CONFIRMATION = 'pending_confirmation',
  QUEUED = 'queued',
  SENT = 'sent',
}

export class CommandAcceptedDto {
  @ApiProperty({ example: 'cmd_9x' })
  command_id: string;

  @ApiProperty({ enum: CommandStatus })
  status: CommandStatus;
}