// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { logger } from '../logger';

function maskSensitive(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  const redactKeys = ['password', 'token', 'secret', 'apiKey', 'authorization', 'cookie', 'jwt'];
  const clone: any = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (redactKeys.some(rk => k.toLowerCase().includes(rk))) {
      clone[k] = '[REDACTED]';
    } else if (typeof v === 'object') {
      clone[k] = maskSensitive(v);
    } else {
      clone[k] = v;
    }
  }
  return clone;
}

/**
 * Custom error class for application-specific errors.
 * Allows for setting a specific status code and marking errors as operational.
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  /**
   * Creates an instance of AppError.
   * @param message The error message.
   * @param statusCode The HTTP status code associated with the error (default: 500).
   */
  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handling middleware for Express applications.
 * Catches errors, logs them, and sends an appropriate JSON response to the client.
 * Handles various types of errors including operational, database, JWT, and validation errors.
 * @param err The error object.
 * @param req The Express request object.
 * @param res The Express response object.
 * @param _next The next middleware function (unused, as this is a terminal error handler).
 */
export const errorHandler: ErrorRequestHandler = (
  err: AppError | Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  let error = { ...err } as AppError;
  error.message = err.message;

  // Log error details with sensitive fields masked
  logger.error({
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: maskSensitive(req.body)
  }, 'Unhandled error occurred');

  // Default error
  let message = 'Internal server error';
  let statusCode = 500;

  // Handle specific error types
  if (error.isOperational) {
    message = error.message;
    statusCode = error.statusCode;
  }

  // SQLite errors
  if (error.message.includes('SQLITE_')) {
    statusCode = 400;
    message = 'Database operation failed';
  }

  // JWT errors
  if (error.message.includes('jwt')) {
    statusCode = 401;
    message = 'Authentication failed';
  }

  // Validation errors
  if (error.message.includes('validation')) {
    statusCode = 400;
    message = 'Validation failed';
  }

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production' && !error.isOperational) {
    message = 'Something went wrong';
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV !== 'production' && {
      stack: error.stack,
      details: error
    })
  });
};

/**
 * Middleware to handle 404 (Not Found) errors.
 * Logs the attempt to access a non-existent route and sends a 404 JSON response.
 * @param req The Express request object.
 * @param res The Express response object.
 */
export const notFoundHandler = (req: Request, res: Response) => {
  logger.warn({
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  }, '404 - Route not found');

  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
};

/**
 * A higher-order function to wrap asynchronous Express route handlers.
 * Catches any errors thrown by the async function and passes them to the next middleware (error handler).
 * This avoids the need for repetitive try-catch blocks in every async route handler.
 * @param fn The asynchronous Express route handler function.
 * @returns A new function that wraps the original handler with error catching.
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
