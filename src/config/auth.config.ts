import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
    expiresIn: process.env.JWT_EXPIRATION || '1h',
    issuer: 'comm-service',
    audience: ['comm-service', 'trading-service', 'financial-service', 'ai-service', 'memory-service', 'gocardless-service', 'test-service'],
  },
}));