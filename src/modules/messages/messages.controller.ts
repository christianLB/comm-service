import { Controller, Post, Body, UseGuards, Headers, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MessagesService } from './messages.service';
import { MessageSendRequestDto, MessageEnqueuedDto } from './dto/message.dto';
import { ErrorDto } from '../../common/dto/common.dto';

@ApiTags('Messages')
@Controller('messages')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post('send')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Enviar notificación (Telegram/Email/Auto) con fallback y TTL' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Clave para deduplicar solicitudes',
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Mensaje encolado',
    type: MessageEnqueuedDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Error de validación o payload inválido',
    type: ErrorDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autorizado',
    type: ErrorDto,
  })
  async sendMessage(
    @Body() dto: MessageSendRequestDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<MessageEnqueuedDto> {
    return this.messagesService.sendMessage(dto, idempotencyKey);
  }
}