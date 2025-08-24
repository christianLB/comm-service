import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CommandsController } from './commands.controller';
import { CommandsService } from './commands.service';
import { TelegramModule } from '../telegram/telegram.module';
import { EmailModule } from '../email/email.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    HttpModule,
    TelegramModule,
    EmailModule,
    AuthModule,
  ],
  controllers: [CommandsController],
  providers: [CommandsService],
  exports: [CommandsService],
})
export class CommandsModule {}