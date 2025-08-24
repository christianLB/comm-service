import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Channel, RoutingDto, ToDto } from '../../../common/dto/common.dto';

export class MessageSendRequestDto {
  @ApiProperty({ enum: Channel })
  @IsEnum(Channel)
  @IsNotEmpty()
  channel: Channel;

  @ApiProperty({ example: 'alerts.generic' })
  @IsString()
  @IsNotEmpty()
  template_key: string;

  @ApiPropertyOptional({ example: 'es-AR' })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiProperty({ 
    type: Object,
    description: 'Variables de la plantilla (clave/valor)',
    additionalProperties: true 
  })
  @IsObject()
  @IsNotEmpty()
  data: Record<string, any>;

  @ApiProperty({ type: ToDto })
  @ValidateNested()
  @Type(() => ToDto)
  @IsNotEmpty()
  to: ToDto;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  require_confirmation?: boolean;

  @ApiPropertyOptional({ type: RoutingDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RoutingDto)
  routing?: RoutingDto;

  @ApiPropertyOptional({ 
    type: Object,
    additionalProperties: true 
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class MessageEnqueuedDto {
  @ApiProperty({ example: 'msg_abc' })
  message_id: string;

  @ApiProperty({ enum: ['queued'] })
  status: 'queued';

  @ApiProperty({ enum: Channel })
  channel_selected: Channel;
}