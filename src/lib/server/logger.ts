import winston from 'winston';

const logger = winston.createLogger({
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

export interface ErrorLogContext {
  userId?: string;
  requestId?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  [key: string]: any;
}

export function logError(message: string, error?: Error, context?: Record<string, any>) {
  logger.error(message, { error, ...context });
}

export function logWarn(message: string, context?: Record<string, any>) {
  logger.warn(message, context);
}

export function logInfo(message: string, context?: Record<string, any>) {
  logger.info(message, context);
}

export function logDebug(message: string, context?: Record<string, any>) {
  logger.debug(message, context);
} 