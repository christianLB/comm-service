#!/usr/bin/env node

/**
 * Standalone JWT Token Generator for Comm-Service
 * 
 * This script generates JWT tokens for service-to-service authentication
 * without requiring the full NestJS application context.
 * 
 * Usage:
 *   node scripts/generate-token.js [service-name] [expiry]
 * 
 * Examples:
 *   node scripts/generate-token.js                    # gocardless-service, no expiry
 *   node scripts/generate-token.js my-service         # custom service, no expiry  
 *   node scripts/generate-token.js my-service 30d     # custom service, 30 days expiry
 */

const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
JWT Token Generator for Comm-Service
====================================

Usage: node scripts/generate-token.js [service-name] [expiry]

Arguments:
  service-name  Name of the service (default: gocardless-service)
  expiry        Token expiry time (default: never)
                Examples: 30d, 1y, 6m, 24h

Examples:
  node scripts/generate-token.js
  node scripts/generate-token.js gocardless-service
  node scripts/generate-token.js trading-service 30d
  node scripts/generate-token.js financial-service 1y

Permissions granted:
  - messages:send
  - notifications:telegram
  - events:publish
  `);
  process.exit(0);
}

const serviceName = args[0] || 'gocardless-service';
const expiry = args[1] || null;

// Try to read JWT secret from .env file
function getJwtSecret() {
  const envPath = path.join(__dirname, '..', '.env');
  
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/JWT_SECRET=(.+)/);
    if (match) {
      return match[1].trim();
    }
  }
  
  // Fallback to environment variable
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  
  // Default secret (should be changed in production!)
  console.warn('⚠️  Warning: Using default JWT secret. Please set JWT_SECRET in .env file!');
  return 'your-secret-key-change-this';
}

// Generate the token
function generateToken() {
  const secret = getJwtSecret();
  
  const payload = {
    service: serviceName,
    permissions: [
      'messages:send',
      'notifications:telegram',
      'events:publish'
    ],
    type: 'service',
    iat: Math.floor(Date.now() / 1000)
  };

  const options = {
    algorithm: 'HS256',
    audience: ['comm-service', 'trading-service', 'financial-service', 'ai-service', 'memory-service', 'gocardless-service', 'test-service'],
    issuer: 'comm-service'
  };

  if (expiry) {
    options.expiresIn = expiry;
    console.log(`\n🔐 Generating JWT Token (expires in ${expiry})`);
  } else {
    console.log('\n🔐 Generating JWT Token (no expiry)');
  }

  const token = jwt.sign(payload, secret, options);

  console.log('================================================');
  console.log(`Service: ${serviceName}`);
  console.log(`Permissions: ${payload.permissions.join(', ')}`);
  console.log(`Expires: ${expiry || 'Never'}`);
  console.log('================================================\n');
  
  console.log('✅ Token generated successfully!\n');
  console.log('Add this to your service\'s .env file:\n');
  console.log(`COMM_SERVICE_TOKEN=${token}\n`);
  
  console.log('================================================');
  console.log('Configuration for your service:\n');
  console.log('COMM_SERVICE_URL=http://192.168.1.11:8080');
  console.log(`COMM_SERVICE_TOKEN=${token}`);
  console.log('================================================\n');
  
  console.log('📚 Example usage:\n');
  console.log(`const { Configuration, MessagesApi } = require('@k2600x/comm-service-sdk');

const api = new MessagesApi(new Configuration({
  basePath: process.env.COMM_SERVICE_URL,
  accessToken: process.env.COMM_SERVICE_TOKEN
}));

// Send notification
await api.v1MessagesSendPost(
  'unique-id-' + Date.now(),
  {
    channel: 'telegram',
    template_key: 'sync.complete',
    locale: 'en',
    data: {
      title: 'Sync Complete',
      body: 'Successfully synced 42 transactions'
    },
    to: {} // Empty - uses admin IDs from comm-service
  }
);`);
  
  console.log('\n⚠️  Security Notes:');
  console.log('• Never commit this token to version control');
  console.log('• Store it securely in environment variables');
  console.log('• Regenerate if compromised\n');
}

// Check if JWT library is installed
try {
  generateToken();
} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    console.error('❌ jsonwebtoken not installed. Run: npm install jsonwebtoken');
  } else {
    console.error('❌ Error:', error.message);
  }
  process.exit(1);
}