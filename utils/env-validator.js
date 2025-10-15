const logger = require('./logger');

// Environment variable validation
const requiredEnvVars = {
  // Database
  DB_HOST: 'Database host',
  DB_USER: 'Database user',
  DB_PASSWORD: 'Database password',
  DB_NAME: 'Database name',
  
  // Security
  JWT_SECRET: 'JWT secret key',
  
  // Email (optional in development)
  ...(process.env.NODE_ENV === 'production' && {
    SMTP_HOST: 'SMTP host',
    SMTP_USER: 'SMTP user',
    SMTP_PASS: 'SMTP password'
  })
};

const validateEnvironment = () => {
  const missing = [];
  const warnings = [];

  // Check required variables
  Object.entries(requiredEnvVars).forEach(([key, description]) => {
    if (!process.env[key] || (key === 'DB_PASSWORD' && process.env[key] === '')) {
      // Allow empty DB_PASSWORD for local development
      if (key === 'DB_PASSWORD' && process.env.NODE_ENV !== 'production') {
        warnings.push('DB_PASSWORD is empty - consider setting a password for security');
      } else {
        missing.push(`${key} (${description})`);
      }
    }
  });

  // Check JWT secret strength
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    warnings.push('JWT_SECRET should be at least 32 characters long');
  }

  // Check production settings
  if (process.env.NODE_ENV === 'production') {
    if (process.env.JWT_SECRET === 'your_super_secret_jwt_key_here_change_in_production') {
      missing.push('JWT_SECRET must be changed from default value in production');
    }
    
    if (!process.env.HTTPS_ENABLED) {
      warnings.push('HTTPS should be enabled in production');
    }
  }

  // Report results
  if (missing.length > 0) {
    logger.error('Missing required environment variables:', missing);
    console.error('\n❌ Missing required environment variables:');
    missing.forEach(item => console.error(`   - ${item}`));
    console.error('\n💡 Please check your .env file\n');
    process.exit(1);
  }

  if (warnings.length > 0) {
    logger.warn('Environment warnings:', warnings);
    console.warn('\n⚠️  Environment warnings:');
    warnings.forEach(item => console.warn(`   - ${item}`));
    console.warn('');
  }

  logger.info('Environment validation passed');
  console.log('✅ Environment validation passed');
};

module.exports = { validateEnvironment };