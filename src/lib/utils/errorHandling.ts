import { logError } from './serverLogger';
import type { ErrorLogContext } from './serverLogger';

export interface ErrorContext {
  action?: string;
  component?: string;
  userId?: string;
  [key: string]: any;
}

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  context?: ErrorContext;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const handleError = async (error: Error, errorContext?: Record<string, any>) => {
  if (!(error instanceof AppError)) {
    error = new AppError(error.message);
  }

  const context = {
    ...errorContext,
    statusCode: (error as AppError).statusCode,
    isOperational: (error as AppError).isOperational
  };

  const errorData = {
    message: error.message,
    name: error.name,
    stack: error.stack,
  };

  await logError(errorData.message, errorData, context as ErrorLogContext);

  return error;
};

export const isOperationalError = (error: Error): boolean => {
  if (error instanceof AppError) {
    return true;
  }
  return false;
}; 