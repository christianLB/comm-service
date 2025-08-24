import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.service';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const redisProviders: Provider[] = [
  {
    provide: REDIS_CLIENT,
    useFactory: (configService: ConfigService) => {
      const redisUrl = configService.get<string>('redis.url') || process.env.REDIS_URL || 'redis://localhost:6379';
      const client = new Redis(redisUrl, {
        keyPrefix: configService.get<string>('redis.keyPrefix') || 'comm:',
        lazyConnect: false,
      });

      client.on('error', (err) => {
        console.error('Redis Client Error:', err);
      });

      client.on('connect', () => {
        console.log('Redis Client Connected');
      });

      return client;
    },
    inject: [ConfigService],
  },
  {
    provide: RedisService,
    useFactory: (redis: Redis) => {
      return new RedisService(redis);
    },
    inject: [REDIS_CLIENT],
  },
];