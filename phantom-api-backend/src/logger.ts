import pino from 'pino';
import path from 'path';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Configured Pino logger instance for the application.
 * In development, logs are output to console (pretty-printed) and to `logs/app.log` and `logs/error.log`.
 * In production, logs are output to `logs/app.log` and `logs/error.log`.
 */
export const logger = pino({
  level: isDev ? 'debug' : 'info',
  transport: isDev
    ? {
      targets: [
        {
          // Log all levels to app.log in development
          target: 'pino/file',
          options: {
            destination: path.join(process.cwd(), 'logs', 'app.log'),
            mkdir: true
          }
        },
        {
          // Log errors to error.log
          target: 'pino/file',
          options: {
            destination: path.join(process.cwd(), 'logs', 'error.log'),
            mkdir: true
          },
          level: 'error'
        },
        {
          // Pretty-print to console
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:dd-mm-yyyy HH:MM:ss',
            ignore: 'pid,hostname'
          }
        }
      ]
    }
    : {
      targets: [
        {
          target: 'pino/file',
          options: {
            destination: path.join(process.cwd(), 'logs', 'app.log'),
            mkdir: true
          }
        },
        {
          target: 'pino/file',
          options: {
            destination: path.join(process.cwd(), 'logs', 'error.log'),
            mkdir: true
          },
          level: 'error'
        }
      ]
    }
});
