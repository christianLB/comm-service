import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { TelegramModule } from '../telegram/telegram.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [TelegramModule, EmailModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}