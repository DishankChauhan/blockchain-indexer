'use server';

import winston from 'winston';

// Server-side logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'blockchain-indexer' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

export interface ErrorLogContext {
  userId?: string;
  requestId?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  [key: string]: any;
}

const ServerLogger = {
  error: (message: string, error: Error, context?: ErrorLogContext) => {
    logger.error(message, { error: { message: error.message, stack: error.stack }, ...context });
  },
  warn: (message: string, context?: Record<string, any>) => {
    logger.warn(message, context);
  },
  info: (message: string, context?: Record<string, any>) => {
    logger.info(message, context);
  },
  debug: (message: string, context?: Record<string, any>) => {
    logger.debug(message, context);
  }
};

export default ServerLogger; 