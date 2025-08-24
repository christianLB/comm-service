import { Controller, Post, Body, UseGuards, Headers, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CommandsService } from './commands.service';
import { CommandDispatchRequestDto, CommandAcceptedDto } from './dto/command.dto';
import { ErrorDto } from '../../common/dto/common.dto';

@ApiTags('Commands')
@Controller('commands')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CommandsController {
  constructor(private readonly commandsService: CommandsService) {}

  @Post('dispatch')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Despachar comando a un servicio (con opción de confirmación Sí/No)' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Clave para deduplicar solicitudes',
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Comando aceptado',
    type: CommandAcceptedDto,
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
  async dispatchCommand(
    @Body() dto: CommandDispatchRequestDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<CommandAcceptedDto> {
    return this.commandsService.dispatchCommand(dto, idempotencyKey);
  }
}