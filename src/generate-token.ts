#!/usr/bin/env node

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AuthService } from './modules/auth/auth.service';

async function generateToken() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  const serviceName = args[0] || 'gocardless-service';
  const permissions = args.slice(1).length > 0 ? args.slice(1) : ['messages:send', 'notifications:telegram'];
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npm run generate:token [service-name] [permissions...]

Examples:
  npm run generate:token                                    # Default: gocardless-service with messaging permissions
  npm run generate:token gocardless-service                 # Specific service with default permissions
  npm run generate:token my-service messages:send events:publish  # Custom service and permissions

Default permissions: messages:send, notifications:telegram
    `);
    process.exit(0);
  }

  console.log('🔐 Generating JWT Token for Service-to-Service Authentication');
  console.log('================================================');
  console.log(`Service: ${serviceName}`);
  console.log(`Permissions: ${permissions.join(', ')}`);
  console.log('================================================\n');

  try {
    // Create application context
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: false, // Disable logging for cleaner output
    });
    
    const authService = app.get(AuthService);
    
    // Generate token
    const token = await authService.generateServiceToken(serviceName, permissions);
    
    console.log('✅ Token generated successfully!\n');
    console.log('Add this to your service\'s environment variables:\n');
    console.log(`COMM_SERVICE_TOKEN=${token}\n`);
    console.log('================================================');
    console.log('⚠️  Security Notes:');
    console.log('• Store this token securely in your environment');
    console.log('• Never commit tokens to version control');
    console.log('• This token does not expire - revoke if compromised');
    console.log('================================================\n');
    
    // Example usage
    console.log('📚 Example usage in your service:\n');
    console.log(`import { Configuration, MessagesApi } from '@k2600x/comm-service-sdk';

const api = new MessagesApi(new Configuration({
  basePath: process.env.COMM_SERVICE_URL,
  accessToken: process.env.COMM_SERVICE_TOKEN // <-- Use the token here
}));`);
    
    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error generating token:', error.message);
    process.exit(1);
  }
}

// Run the token generator
generateToken().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});