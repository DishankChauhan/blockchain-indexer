import winston from 'winston';

let logger: winston.Logger;

// Only initialize winston logger on the server side
if (typeof window === 'undefined') {
  logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ]
  });
}

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
  if (typeof window === 'undefined') {
    logger.error(message, { error, ...context });
  }
}

export function logWarn(message: string, context?: Record<string, any>) {
  if (typeof window === 'undefined') {
    logger.warn(message, context);
  }
}

export function logInfo(message: string, context?: Record<string, any>) {
  if (typeof window === 'undefined') {
    logger.info(message, context);
  }
}

export function logDebug(message: string, context?: Record<string, any>) {
  if (typeof window === 'undefined') {
    logger.debug(message, context);
  }
} 