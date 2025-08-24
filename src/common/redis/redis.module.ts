import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisService } from './redis.service';
import { redisProviders, REDIS_CLIENT } from './redis.providers';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [...redisProviders],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}

export { REDIS_CLIENT } from './redis.providers';