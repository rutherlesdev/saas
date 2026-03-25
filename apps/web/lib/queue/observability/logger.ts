/**
 * Structured Logger
 * 
 * Pino-based structured logging with correlation ID tracking,
 * queue context, and consistent formatting.
 */

import pino, { Logger } from 'pino';

// Global logger instance
let logger: Logger | null = null;

export interface LogContext {
  correlationId: string;
  jobId?: string;
  queueName?: string;
  userId?: string;
  [key: string]: any;
}

/**
 * Get or create the global logger
 */
export function getLogger(): Logger {
  if (!logger) {
    const isDev = process.env.NODE_ENV === 'development';
    
    logger = pino({
      level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
      transport: isDev
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              singleLine: false,
              translateTime: 'SYS:standard',
            },
          }
        : undefined,
      base: {
        service: 'queue-system',
        environment: process.env.NODE_ENV || 'development',
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    });
  }

  return logger;
}

/**
 * Create a child logger with context
 */
export function createContextLogger(context: LogContext): Logger {
  return getLogger().child(context);
}

/**
 * Log helper for structured logging with context
 */
export function logWithContext(
  context: LogContext,
  level: 'info' | 'debug' | 'warn' | 'error',
  message: string,
  data?: Record<string, any>
) {
  createContextLogger(context)[level]({ ...data }, message);
}
