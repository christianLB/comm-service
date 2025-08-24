import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT, 10) || 8080,
  environment: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'debug',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  
  // Service URLs
  services: {
    trading: process.env.SERVICE_URLS_TRADING || 'http://trading-service:3000',
    financial: process.env.SERVICE_URLS_FINANCIAL || 'http://financial-service:3000',
    ai: process.env.SERVICE_URLS_AI || 'http://ai-service:3000',
    memory: process.env.SERVICE_URLS_MEMORY || 'http://memory-service:3000',
  },

  // Webhook configuration
  webhook: {
    timeout: parseInt(process.env.WEBHOOK_TIMEOUT, 10) || 5000,
    maxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES, 10) || 3,
  },

  // Telegram configuration
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    adminIds: process.env.ADMINS_TELEGRAM_IDS?.split(',').map(id => id.trim()) || [],
  },

  // Email configuration
  email: {
    from: process.env.EMAIL_FROM || 'noreply@comm-service.local',
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY,
    },
  },

  // Magic link configuration
  magicLink: {
    ttl: parseInt(process.env.MAGIC_LINK_TTL, 10) || 300, // 5 minutes
  },
}));