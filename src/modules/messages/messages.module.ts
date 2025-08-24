import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { TelegramModule } from '../telegram/telegram.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [TelegramModule, EmailModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}