import winston from 'winston';
import { Logtail } from '@logtail/node';
import { LogtailTransport } from '@logtail/winston';

// Initialize Logtail for production logging
const logtail = process.env.LOGTAIL_SOURCE_TOKEN 
  ? new Logtail(process.env.LOGTAIL_SOURCE_TOKEN)
  : null;

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'blockchain-indexer' },
  transports: [
    // Write to all logs with level 'info' and below to 'combined.log'
    new winston.transports.File({ filename: 'logs/combined.log' }),
    // Write all logs error (and below) to 'error.log'
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
  ],
});

// Add Logtail transport in production
if (process.env.NODE_ENV === 'production' && logtail) {
  logger.add(new LogtailTransport(logtail));
}

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
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

export class AppLogger {
  static error(message: string, error: Error, context?: ErrorLogContext) {
    logger.error(message, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...context,
    });
  }

  static warn(message: string, context?: Record<string, any>) {
    logger.warn(message, context);
  }

  static info(message: string, context?: Record<string, any>) {
    logger.info(message, context);
  }

  static debug(message: string, context?: Record<string, any>) {
    logger.debug(message, context);
  }
}

export default AppLogger; 