import clientLogger from './clientLogger';
import type { ErrorLogContext } from './serverLogger';

export interface ErrorContext {
  action?: string;
  component?: string;
  userId?: string;
  [key: string]: any;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  context?: ErrorContext;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export function handleError(error: Error | AppError, context?: Record<string, any>) {
  // Client-side error handling only
  clientLogger.error('Application error', error, context);
}

export const isOperationalError = (error: Error): boolean => {
  if (error instanceof AppError) {
    return true;
  }
  return false;
}; 