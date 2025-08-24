import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EventsService } from './events.service';
import { EventInDto } from './dto/event.dto';
import { ErrorDto } from '../../common/dto/common.dto';

@ApiTags('Events')
@Controller('events')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Ingesta de eventos desde servicios (status de comandos, outputs)' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Aceptado',
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
  async handleEvent(@Body() dto: EventInDto): Promise<void> {
    await this.eventsService.handleEvent(dto);
  }
}