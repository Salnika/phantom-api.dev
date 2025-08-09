#!/usr/bin/env node

/**
 * Script to generate secure secrets for Phantom API
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateSecrets() {
  console.log('🔐 Generating secure secrets for Phantom API...\n');
  
  // Generate secrets
  const jwtSecret = crypto.randomBytes(48).toString('base64');
  const cookieSecret = crypto.randomBytes(32).toString('base64');
  
  console.log('Generated secrets:');
  console.log('==================');
  console.log(`JWT_SECRET=${jwtSecret}`);
  console.log(`COOKIE_SECRET=${cookieSecret}`);
  console.log('');
  
  // Check if .env exists
  const envPath = path.join(process.cwd(), '.env');
  const envExamplePath = path.join(process.cwd(), '.env.example');
  
  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envExamplePath)) {
      console.log('📄 Creating .env file from .env.example...');
      fs.copyFileSync(envExamplePath, envPath);
    } else {
      console.log('❌ No .env.example file found. Creating basic .env file...');
      fs.writeFileSync(envPath, `# Phantom API Environment Configuration
NODE_ENV=development
PORT=3000

# Security Configuration
JWT_SECRET=${jwtSecret}
COOKIE_SECRET=${cookieSecret}

# Database Configuration
DB_PATH=./data/phantom.db

# CORS Configuration
CORS_ORIGIN=http://localhost:5173,http://localhost:5174,http://localhost:5175
`);
      console.log('✅ Basic .env file created with secure secrets');
      return;
    }
  }
  
  // Update .env file with new secrets
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Replace JWT_SECRET
  if (envContent.includes('JWT_SECRET=')) {
    envContent = envContent.replace(
      /JWT_SECRET=.*/,
      `JWT_SECRET=${jwtSecret}`
    );
  } else {
    envContent += `\nJWT_SECRET=${jwtSecret}`;
  }
  
  // Replace COOKIE_SECRET
  if (envContent.includes('COOKIE_SECRET=')) {
    envContent = envContent.replace(
      /COOKIE_SECRET=.*/,
      `COOKIE_SECRET=${cookieSecret}`
    );
  } else {
    envContent += `\nCOOKIE_SECRET=${cookieSecret}`;
  }
  
  // Remove insecure admin credentials if they exist
  envContent = envContent.replace(/ADMIN_EMAIL=admin@phantom-api\.com/, '# ADMIN_EMAIL=your-admin@example.com');
  envContent = envContent.replace(/ADMIN_PASSWORD=admin123/, '# ADMIN_PASSWORD=your-secure-password');
  
  fs.writeFileSync(envPath, envContent);
  
  console.log('✅ Updated .env file with secure secrets');
  console.log('');
  console.log('🚨 IMPORTANT SECURITY NOTES:');
  console.log('============================');
  console.log('1. Keep your secrets secure and never commit them to version control');
  console.log('2. Use different secrets for each environment (dev, staging, production)');
  console.log('3. Consider using a secrets management service in production');
  console.log('4. Hardcoded admin credentials have been removed - use the setup process');
  console.log('');
  console.log('🎉 Your Phantom API is now more secure!');
}

// Run the script
if (require.main === module) {
  generateSecrets();
}

module.exports = { generateSecrets };