import csrf from 'csurf';
import { Request, Response, NextFunction } from 'express';
// import { logger } from '../logger';

/**
 * CSRF protection middleware configuration.
 * Configures cookie settings and defines how to extract the CSRF token from incoming requests.
 */
export const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 3600000 // 1 hour
  },
  value: (req: any) => {
    // Try multiple sources for CSRF token
    const token = req.body._csrf ||
      req.query._csrf ||
      req.headers['csrf-token'] ||
      req.headers['x-csrf-token'] ||
      req.headers['xsrf-token'] ||
      req.headers['x-xsrf-token'];

    // Debug logging (disabled in production)
    if (process.env.NODE_ENV !== 'production') {
      console.log('CSRF Debug:', {
        url: req.originalUrl,
        method: req.method,
        token: token ? token.substring(0, 8) + '...' : 'none',
        cookies: req.headers.cookie ? 'present' : 'none',
        origin: req.headers.origin
      });
    }

    return token;
  }
});

/**
 * Express route handler for providing a CSRF token to the client.
 * This endpoint is protected by CSRF itself to ensure the token is securely issued.
 * @param req The Express request object.
 * @param res The Express response object.
 * @param next The next middleware function.
 */
export const csrfTokenHandler = (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({
      success: true,
      csrfToken: (req as any).csrfToken()
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Express error handling middleware specifically for CSRF token errors.
 * Catches 'EBADCSRFTOKEN' errors and sends a 403 Forbidden response.
 * @param err The error object.
 * @param req The Express request object.
 * @param res The Express response object.
 * @param next The next middleware function.
 */
export const csrfErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.code === 'EBADCSRFTOKEN') {
    console.warn('CSRF attack attempt detected:', {
      ip: req.ip,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      error: 'CSRF token validation failed'
    });

    return res.status(403).json({
      success: false,
      error: 'Invalid CSRF token',
      code: 'CSRF_TOKEN_INVALID'
    });
  }
  next(err);
};

/**
 * Middleware to conditionally skip CSRF protection for certain routes or HTTP methods.
 * Skips CSRF for GET, HEAD, OPTIONS requests, and specific health/API endpoints.
 * @param req The Express request object.
 * @param res The Express response object.
 * @param next The next middleware function.
 */
export const skipCSRF = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for safe methods and health endpoints
  if (req.method === 'GET' ||
    req.method === 'HEAD' ||
    req.method === 'OPTIONS' ||
    req.path === '/health' ||
    req.path.startsWith('/api/')) {
    return next();
  }

  return csrfProtection(req as any, res as any, next);
};