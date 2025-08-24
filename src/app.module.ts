import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { HttpModule } from '@nestjs/axios';
import redisConfig from './config/redis.config';
import appConfig from './config/app.config';
import authConfig from './config/auth.config';
import { RedisModule } from './common/redis/redis.module';
import { MessagesModule } from './modules/messages/messages.module';
import { CommandsModule } from './modules/commands/commands.module';
import { VerificationModule } from './modules/verification/verification.module';
import { EventsModule } from './modules/events/events.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { EmailModule } from './modules/email/email.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, redisConfig, authConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    RedisModule,
    AuthModule,
    MessagesModule,
    CommandsModule,
    VerificationModule,
    EventsModule,
    TelegramModule,
    EmailModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
})
export class AppModule {}