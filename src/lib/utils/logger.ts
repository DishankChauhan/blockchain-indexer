import winston from 'winston';
import path from 'path';

const logDir = path.join(process.cwd(), 'logs');

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
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

const AppLogger = {
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

export default AppLogger; 