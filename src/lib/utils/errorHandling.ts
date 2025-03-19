import { ServerLogger, ErrorLogContext } from './serverLogger';

export interface ErrorContext {
  action?: string;
  component?: string;
  userId?: string;
  [key: string]: any;
}

export class AppError extends Error {
  context?: ErrorContext;

  constructor(message: string, context?: ErrorContext) {
    super(message);
    this.name = this.constructor.name;
    this.context = context;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const handleError = (error: Error | AppError, context?: ErrorContext) => {
  const errorContext = (error as AppError).context || context;
  
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', error);
    if (errorContext) {
      console.error('Context:', errorContext);
    }
  }

  ServerLogger.error(error.message, error, errorContext as ErrorLogContext);

  return error;
};

export const isOperationalError = (error: Error): boolean => {
  if (error instanceof AppError) {
    return true;
  }
  return false;
}; 