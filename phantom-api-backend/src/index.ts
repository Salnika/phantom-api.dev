// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { getAllResourceNames, loadResourceMeta } from './services/metaService';
import { tableManager } from './database';
import { logger } from './logger';
import { redisManager } from './cache/redis-client';
import { cacheService } from './cache/cache-service';
import { databaseFactory } from './database/factory';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Validate environment variables
/**
 * Validates critical environment variables required for the application to run.
 * Ensures secrets are set and meet security requirements.
 * @throws Exits the process if validation fails.
 */
function validateEnvironment() {
  const requiredEnvVars = ['JWT_SECRET', 'COOKIE_SECRET'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    logger.error({ missingVars }, 'Missing required environment variables');
    process.exit(1);
  }

  const insecurePlaceholders = [
    'CHANGE_THIS_IN_PRODUCTION_USE_OPENSSL_RAND_BASE64_48',
    'CHANGE_THIS_IN_PRODUCTION_USE_OPENSSL_RAND_BASE64_32',
    'your-super-secret-jwt-key-change-this-in-production'
  ];

  // Validate secrets
  const jwtSecret = process.env.JWT_SECRET || '';
  const cookieSecret = process.env.COOKIE_SECRET || '';

  if (process.env.NODE_ENV === 'production') {
    if (jwtSecret.length < 32 || insecurePlaceholders.includes(jwtSecret)) {
      logger.error('Invalid JWT_SECRET: must be secure and not a placeholder in production');
      process.exit(1);
    }
    if (cookieSecret.length < 32 || insecurePlaceholders.includes(cookieSecret)) {
      logger.error('Invalid COOKIE_SECRET: must be secure and not a placeholder in production');
      process.exit(1);
    }
    // prevent very common insecure patterns
    [jwtSecret, cookieSecret].forEach((sec, idx) => {
      const name = idx === 0 ? 'JWT_SECRET' : 'COOKIE_SECRET';
      const lowered = sec.toLowerCase();
      ['test', 'development', 'dev', 'local', 'password', 'secret', 'admin'].forEach(word => {
        if (lowered.includes(word)) {
          logger.error(`${name} contains insecure pattern "${word}"`);
          process.exit(1);
        }
      });
    });
    // Also enforce CORS_ORIGIN sanity
    if (process.env.CORS_ORIGIN) {
      const origins = process.env.CORS_ORIGIN.split(',').map(o => o.trim());
      if (origins.some(o => o === '*' || o.includes('localhost'))) {
        logger.error('CORS_ORIGIN contains insecure entries for production');
        process.exit(1);
      }
    }
  }
}

/**
 * Starts the Phantom API backend server.
 * Initializes the Express app, connects to the database, and sets up resource tables.
 * Handles graceful shutdown on SIGTERM and SIGINT signals.
 */
async function startServer() {
  try {
    // Validate environment
    validateEnvironment();

    // Initialize Redis cache connection
    logger.info('Initializing cache system...');
    await redisManager.connect();
    const cacheStatus = cacheService.getHealthStatus();
    logger.info('Cache system initialized', cacheStatus);

    // Initialize database connection
    logger.info('Initializing database connection...');
    await databaseFactory.createAdapter();
    logger.info(`Database initialized: ${databaseFactory.getDatabaseType()}`);

    // Initialize table manager
    await tableManager.initialize();

    // Create Express app
    const app = await createApp();

    // Start server
    const server = app.listen(PORT, HOST, async () => {
      logger.info(`Server running on ${HOST}:${PORT}`);

      // Initialize all resources from meta files on startup
      try {
        const resourceNames = await getAllResourceNames();
        for (const resource of resourceNames) {
          const meta = await loadResourceMeta(resource);
          if (meta) {
            await tableManager.createTableFromSchema(resource, meta);
            logger.debug({ resource }, 'Resource table created and schema loaded');
          }
        }
        logger.info({ count: resourceNames.length }, 'Resources initialized');
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : error }, 'Could not initialize resources');
      }

      logger.info({ port: PORT }, 'Server started successfully');
      logger.info(`Admin interface: http://localhost:${PORT}/admin`);
      logger.info(`API endpoint: http://localhost:${PORT}/api/:resource/:action`);
      logger.info(`Create first admin via: POST /auth/setup`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });

    // Graceful shutdown
    const gracefulShutdown = async () => {
      logger.info('Shutting down gracefully...');
      
      // Close HTTP server
      server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
          // Disconnect from Redis
          await redisManager.disconnect();
          logger.info('Redis connection closed');
          
          // Disconnect from database
          await databaseFactory.resetAdapter();
          logger.info('Database connection closed');
          
          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : error }, 'Failed to start server');
    process.exit(1);
  }
}

// Start the server
startServer();
