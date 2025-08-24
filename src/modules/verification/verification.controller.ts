import { Controller, Post, Body, UseGuards, Headers, HttpCode, HttpStatus, HttpException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VerificationService } from './verification.service';
import { 
  VerificationStartRequestDto, 
  VerificationStartedDto,
  VerificationConfirmRequestDto,
  VerificationResultDto 
} from './dto/verification.dto';
import { ErrorDto } from '../../common/dto/common.dto';

@ApiTags('Verification')
@Controller('verification')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post('start')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Iniciar verificación por email o telegram (OTP o magic link)' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Clave para deduplicar solicitudes',
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Verificación iniciada',
    type: VerificationStartedDto,
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
  async startVerification(
    @Body() dto: VerificationStartRequestDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<VerificationStartedDto> {
    return this.verificationService.startVerification(dto, idempotencyKey);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirmar OTP o token de magic link' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Verificado',
    type: VerificationResultDto,
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
  @ApiResponse({
    status: HttpStatus.GONE,
    description: 'Expirado',
  })
  async confirmVerification(
    @Body() dto: VerificationConfirmRequestDto,
  ): Promise<VerificationResultDto> {
    try {
      return await this.verificationService.confirmVerification(dto);
    } catch (error) {
      if (error.message === 'EXPIRED') {
        throw new HttpException('Verification expired', HttpStatus.GONE);
      }
      throw error;
    }
  }
}