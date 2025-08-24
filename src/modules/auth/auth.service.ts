import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface ServiceTokenPayload {
  service: string;
  permissions: string[];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async generateServiceToken(service: string, permissions: string[] = []): Promise<string> {
    const payload: ServiceTokenPayload = {
      service,
      permissions,
    };

    return this.jwtService.sign(payload, {
      audience: this.configService.get<string[]>('auth.jwt.audience'),
    });
  }

  async verifyServiceToken(token: string): Promise<ServiceTokenPayload> {
    return this.jwtService.verify(token, {
      audience: this.configService.get<string[]>('auth.jwt.audience'),
    });
  }

  async generateMagicLinkToken(data: any): Promise<string> {
    return this.jwtService.sign(data, {
      expiresIn: this.configService.get<number>('app.magicLink.ttl'),
    });
  }

  async verifyMagicLinkToken(token: string): Promise<any> {
    return this.jwtService.verify(token);
  }
}