import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

/**
 * Creates a rate limiting middleware for Express routes.
 * @param windowMs The time window in milliseconds for which requests are counted.
 * @param max The maximum number of requests allowed within the windowMs.
 * @param message The message to send when the rate limit is exceeded.
 * @returns An Express rate limit middleware.
 */
export const createRateLimit = (windowMs: number, max: number, message: string) => {
  return rateLimit({
    windowMs,
    max,
    message: { success: false, error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      logger.warn({
        ip: req.ip,
        url: req.url,
        userAgent: req.get('User-Agent')
      }, 'Rate limit exceeded');

      res.status(429).json({
        success: false,
        error: message
      });
    }
  });
};

/**
 * Helmet middleware configuration for setting various HTTP security headers.
 * Includes Content Security Policy (CSP) and HTTP Strict Transport Security (HSTS).
 */
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

/**
 * Middleware for IP whitelisting.
 * Blocks requests from IPs not present in the `allowedIPs` list.
 * @param allowedIPs An array of IP addresses that are allowed to access the application (default: empty array, meaning no whitelisting).
 * @returns An Express middleware function.
 */
export const ipWhitelist = (allowedIPs: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (allowedIPs.length === 0) {
      return next(); // No whitelist configured
    }

    const clientIP = req.ip || req.connection.remoteAddress;

    if (!clientIP || !allowedIPs.includes(clientIP)) {
      logger.warn({
        ip: clientIP,
        url: req.url,
        userAgent: req.get('User-Agent')
      }, 'Blocked request from non-whitelisted IP');

      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    next();
  };
};

/**
 * Middleware for logging incoming HTTP requests.
 * Logs method, URL, status code, response time, IP, and user agent.
 * @param req The Express request object.
 * @param res The Express response object.
 * @param next The next middleware function.
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    }, 'HTTP Request');
  });

  next();
};