import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

// Middleware imports
import {
  createRateLimit,
  helmetConfig,
  requestLogger,
  ipWhitelist
} from './middleware/security';
import {
  csrfTokenHandler,
  csrfErrorHandler
} from './middleware/csrf';
import {
  sanitizeInput,
  sanitizeXSS
} from './middleware/validation';
import {
  errorHandler,
  notFoundHandler
} from './middleware/errorHandler';
import {
  clearMetaCache
} from './services/metaService';
import {
  policyAudit,
  requireRole
} from './middleware/policyAuth';

// Route imports
import { createApiRoutes } from './routes/api';
import { createAdminRoutes } from './routes/admin';
import { createAuthRoutes } from './routes/auth';
import { createSystemRoutes } from './routes/system';

// Initialize policies
import { initializePolicyTables } from './init-policies';
import { initializeSystemTables } from './init-system-tables';
import { tableManager } from './database';
import { JwtToken } from './models/JwtToken';
import { cacheService } from './cache/cache-service';
import { databaseFactory } from './database/factory';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createApp() {
  const app = express();

  // Initialize table manager to load existing schemas and recreate tables
  try {
    await tableManager.initialize();
  } catch (error) {
    console.warn('Warning: Failed to initialize table manager:', error);
  }

  // Initialize policy tables and JWT token model
  try {
    await initializePolicyTables();
    await initializeSystemTables();
    await JwtToken.initialize();
  } catch (error) {
    console.warn('Warning: Failed to initialize policy tables and JWT model:', error);
  }

  // Trust proxy for rate limiting and IP detection
  app.set('trust proxy', 1);

  // Security headers
  app.use(helmetConfig);

  // IP Whitelisting
  app.use(ipWhitelist(process.env.IP_WHITELIST ? process.env.IP_WHITELIST.split(',') : []));

  // CORS configuration
  app.use(cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5001',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5176'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'CSRF-Token', 'X-CSRF-Token']
  }));

  // Request logging
  app.use(requestLogger);

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Input sanitization
  app.use(sanitizeInput);
  app.use(sanitizeXSS);

  // CSRF token endpoint (must be available before CSRF protection)
  if (process.env.NODE_ENV !== 'test') {
    const { csrfProtection } = await import('./middleware/csrf');
    app.get('/csrf-token', csrfProtection, csrfTokenHandler);
  }


  // Enhanced health check endpoint with cache and database status
  app.get('/health', async (req, res) => {
    try {
      const healthStatus = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0',
        database: {
          type: databaseFactory.getDatabaseType(),
          connected: true // Will be set to false if connection fails
        },
        cache: cacheService.getHealthStatus(),
        environment: {
          node_env: process.env.NODE_ENV,
          database_type: process.env.DATABASE_TYPE || 'sqlite',
          redis_enabled: process.env.REDIS_ENABLED === 'true'
        }
      };

      // Test database connection
      try {
        const adapter = await databaseFactory.createAdapter();
        await adapter.query('SELECT 1');
      } catch (error) {
        healthStatus.database.connected = false;
        healthStatus.status = 'DEGRADED';
      }

      // Return appropriate HTTP status code
      const statusCode = healthStatus.status === 'OK' ? 200 : 503;
      res.status(statusCode).json(healthStatus);
    } catch (error) {
      res.status(503).json({
        status: 'ERROR',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Rate limiting
  const authRateLimit = createRateLimit(15 * 60 * 1000, 20, 'Too many login attempts, please try again later');
  const apiRateLimit = createRateLimit(15 * 60 * 1000, 1000, 'Too many requests from this IP, please try again later');
  const adminRateLimit = createRateLimit(15 * 60 * 1000, 2000, 'Too many admin requests, please try again later');

  app.use('/auth', authRateLimit);
  app.use('/api', apiRateLimit);
  app.use('/admin', adminRateLimit);

  // Routes
  app.use('/auth', await createAuthRoutes());
  app.use('/api', await createApiRoutes());
  app.use('/system', await createSystemRoutes());

  // Admin API routes (must come before static files) - with CSRF protection
  if (process.env.NODE_ENV !== 'test') {
    const { csrfProtection } = await import('./middleware/csrf');
    app.use('/admin/api', csrfProtection, await createAdminRoutes());
    // Special admin routes with CSRF protection
    app.post('/admin/api/cache/clear', csrfProtection, adminRateLimit, requireRole('admin'), (req, res) => {
      const resource = req.body.resource;
      clearMetaCache(resource);
      res.json({ success: true, message: `Cache cleared for ${resource || 'all resources'}` });
    });
  } else {
    app.use('/admin/api', await createAdminRoutes());
    // Special admin routes without CSRF in test environment
    app.post('/admin/api/cache/clear', adminRateLimit, requireRole('admin'), (req, res) => {
      const resource = req.body.resource;
      clearMetaCache(resource);
      res.json({ success: true, message: `Cache cleared for ${resource || 'all resources'}` });
    });
  }

  // Serve static files for admin interface (but skip API routes)
  const adminPath = path.join(__dirname, '../../admin-interface/dist');
  app.use('/admin', (req, res, next) => {
    // Skip static files for API routes
    if (req.path.startsWith('/api/')) {
      return next();
    }
    return express.static(adminPath, {
      setHeaders: (res, path) => {
        if (path.endsWith('.css')) {
          res.setHeader('Content-Type', 'text/css');
        }
        if (path.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript');
        }
      }
    })(req, res, next);
  });

  // Catch-all for admin interface (SPA routing) - but NOT for API routes
  app.get('/admin/*', (req, res, next) => {
    // Skip catch-all for API routes
    if (req.path.startsWith('/admin/api/')) {
      return next();
    }
    res.sendFile(path.join(adminPath, 'index.html'));
  });

  // Root redirect
  app.get('/', (req, res) => {
    res.redirect('/admin');
  });

  // CSRF error handler
  app.use(csrfErrorHandler);

  // Error handling middleware
  app.use(policyAudit);
  app.use(errorHandler);

  // 404 handler (must be last)
  app.use(notFoundHandler);

  return app;
}
