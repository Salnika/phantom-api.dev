import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { logger } from '../logger';

/**
 * Middleware to handle validation errors from `express-validator`.
 * If validation errors are present, it logs them and sends a 400 Bad Request response.
 * @param req The Express request object.
 * @param res The Express response object.
 * @param next The next middleware function.
 */
const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    logger.warn({
      url: req.url,
      method: req.method,
      errors: errors.array(),
      ip: req.ip
    }, 'Validation failed');

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }

  next();
};

/**
 * Validation rules for resource names.
 * Ensures the resource name is alphabetic and between 1 and 50 characters.
 */
export const validateResource = [
  param('resource')
    .isAlpha()
    .isLength({ min: 1, max: 50 })
    .withMessage('Resource name must be alphabetic and 1-50 characters'),
  handleValidationErrors
];

/**
 * Validation rules for IDs.
 * Ensures the ID is between 1 and 100 characters.
 */
export const validateId = [
  param('id')
    .isLength({ min: 1, max: 100 })
    .withMessage('ID must be 1-100 characters'),
  handleValidationErrors
];

/**
 * Validation rules for pagination query parameters.
 * Validates `limit`, `offset`, and `page` to be integers within acceptable ranges.
 */
export const validatePagination = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Limit must be an integer between 1 and 1000'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  handleValidationErrors
];

/**
 * Validation rules for email addresses.
 * Ensures the email is a valid format and normalizes it.
 */
export const validateEmail = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  handleValidationErrors
];

/**
 * Validation rules for passwords.
 * Enforces length requirements and, in production, strong password criteria.
 */
export const validatePassword = [
  body('password')
    .isLength({ min: 6, max: 128 })
    .withMessage('Password must be 6-128 characters')
    .custom((value) => {
      // In development, allow simpler passwords like admin123
      if (process.env.NODE_ENV === 'development' && value === 'admin123') {
        return true;
      }

      // In production, enforce strong password requirements
      if (process.env.NODE_ENV === 'production') {
        const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
        if (!strongPasswordRegex.test(value)) {
          throw new Error('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character');
        }
      }

      return true;
    }),
  handleValidationErrors
];

/**
 * Middleware to sanitize request inputs against potential SQL injection attacks.
 * Scans request body, query, and parameters for suspicious SQL patterns.
 * @param req The Express request object.
 * @param res The Express response object.
 * @param next The next middleware function.
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const suspiciousPatterns = [
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi,
    /(--|\/\*|\*\/)/g,
    /(\bor\b|\band\b)\s+\d+\s*=\s*\d+/gi,
    /(['"]\s*(or|and)\s+['"][^'"]+['"]\s*=\s*['"][^'"]+['"])/gi
  ];

  const checkForSQLInjection = (obj: any, path: string = ''): boolean => {
    if (typeof obj === 'string') {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(obj)) {
          logger.warn({
            value: obj,
            pattern: pattern.toString(),
            path
          }, 'Suspicious value detected by SQLi middleware');
          return true;
        }
      }
      return false;
    }

    if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        if (checkForSQLInjection(value, `${path}.${key}`)) {
          return true;
        }
      }
    }

    return false;
  };

  // Check body, query, and params for SQL injection patterns
  if (checkForSQLInjection(req.body) ||
    checkForSQLInjection(req.query) ||
    checkForSQLInjection(req.params)) {

    logger.warn({
      ip: req.ip,
      url: req.url,
      method: req.method,
      userAgent: req.get('User-Agent'),
      body: req.body,
      query: req.query,
      params: req.params
    }, 'Potential SQL injection attempt detected');

    return res.status(400).json({
      success: false,
      error: 'Invalid input detected'
    });
  }

  next();
};

/**
 * Middleware to sanitize request inputs against potential Cross-Site Scripting (XSS) attacks.
 * Scans request body and query for suspicious XSS patterns.
 * @param req The Express request object.
 * @param res The Express response object.
 * @param next The next middleware function.
 */
export const sanitizeXSS = (req: Request, res: Response, next: NextFunction) => {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi
  ];

  const checkForXSS = (obj: any): boolean => {
    if (typeof obj === 'string') {
      return xssPatterns.some(pattern => pattern.test(obj));
    }

    if (typeof obj === 'object' && obj !== null) {
      for (const value of Object.values(obj)) {
        if (checkForXSS(value)) {
          return true;
        }
      }
    }

    return false;
  };

  if (checkForXSS(req.body) || checkForXSS(req.query)) {
    logger.warn({
      ip: req.ip,
      url: req.url,
      method: req.method,
      userAgent: req.get('User-Agent')
    }, 'Potential XSS attempt detected');

    return res.status(400).json({
      success: false,
      error: 'Invalid input detected'
    });
  }

  next();
};