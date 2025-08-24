import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as helmet from 'helmet';
import { AppModule } from './app.module';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

async function bootstrap() {
  console.log('[STARTUP] Starting bootstrap...');
  
  console.log('[STARTUP] Creating NestFactory app...');
  const app = await NestFactory.create(AppModule);
  console.log('[STARTUP] NestFactory app created');

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 8080);
  console.log(`[STARTUP] Port configured: ${port}`);

  // Security
  console.log('[STARTUP] Applying security middleware...');
  app.use(helmet.default());

  // CORS
  console.log('[STARTUP] Enabling CORS...');
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN', '*'),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Versioning
  console.log('[STARTUP] Enabling versioning...');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global validation pipe
  console.log('[STARTUP] Setting up validation pipe...');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger documentation
  console.log('[STARTUP] Setting up Swagger documentation...');
  const config = new DocumentBuilder()
    .setTitle('Comm Service API')
    .setDescription('Centralized communication service for microservices')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addTag('messages', 'Message sending operations')
    .addTag('commands', 'Command dispatch operations')
    .addTag('verification', 'Verification operations')
    .addTag('events', 'Event handling operations')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);
  console.log('[STARTUP] Swagger documentation setup complete');

  console.log('[STARTUP] Calling app.listen()...');
  await app.listen(port, '0.0.0.0', () => {
    console.log('[STARTUP] app.listen() callback fired');
    console.log(`Comm Service is running on: http://0.0.0.0:${port}`);
    console.log(`API Documentation: http://0.0.0.0:${port}/api-docs`);
  });
  console.log('[STARTUP] app.listen() completed');
}

bootstrap().catch(err => {
  console.error('[STARTUP ERROR]', err);
  process.exit(1);
});