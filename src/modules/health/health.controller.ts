import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../common/redis/redis.module';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  async health() {
    const redisStatus = await this.checkRedis();
    
    return {
      status: redisStatus ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'comm-service',
      version: '0.1.0',
      dependencies: {
        redis: redisStatus ? 'connected' : 'disconnected',
      },
    };
  }

  private async checkRedis(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      return false;
    }
  }
}