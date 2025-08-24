import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { ServiceTokenPayload } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('auth.jwt.secret'),
      issuer: configService.get<string>('auth.jwt.issuer'),
      audience: configService.get<string[]>('auth.jwt.audience'),
    });
  }

  async validate(payload: ServiceTokenPayload): Promise<ServiceTokenPayload> {
    if (!payload.service) {
      throw new UnauthorizedException('Invalid token');
    }
    return payload;
  }
}