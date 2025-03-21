import winston from 'winston';
import path from 'path';

const logDir = path.join(process.cwd(), 'logs');

// Ensure we're in a Node.js environment
const isNode = typeof process !== 'undefined' && 
  process.versions != null && 
  process.versions.node != null;

if (!isNode) {
  throw new Error('serverLogger can only be used in Node.js environment');
}

interface LogMetadata {
  component?: string;
  action?: string;
  userId?: string;
  message?: string;
  error?: Error;
  [key: string]: any;
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log') 
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

const serverLogger = {
  info: (message: string, metadata?: LogMetadata) => {
    logger.info(message, metadata);
  },
  error: (message: string, error: Error | null, metadata?: LogMetadata) => {
    logger.error(message, { ...metadata, error });
  },
  warn: (message: string, metadata?: LogMetadata) => {
    logger.warn(message, metadata);
  },
  debug: (message: string, metadata?: LogMetadata) => {
    logger.debug(message, metadata);
  }
};

export default serverLogger;

// Export individual functions for convenience
export const { info, error, warn, debug } = serverLogger;

export interface ErrorLogContext {
  userId?: string;
  requestId?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  [key: string]: any;
}

interface SerializableError {
  message: string;
  name: string;
  stack?: string;
}

export function logError(message: string, error?: Error, context?: Record<string, any>) {
  if (isNode) {
    logger.error(message, { error, ...context });
  }
}

export function logWarn(message: string, context?: Record<string, any>) {
  if (isNode) {
    logger.warn(message, context);
  }
}

export function logInfo(message: string, context?: Record<string, any>) {
  if (isNode) {
    logger.info(message, context);
  }
}

export function logDebug(message: string, context?: Record<string, any>) {
  if (isNode) {
    logger.debug(message, context);
  }
} 