import { AxiosError } from 'axios';
import { captureException } from '@sentry/nextjs';

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const handleError = (error: unknown): AppError => {
  if (error instanceof AppError) {
    // Log operational errors
    if (error.isOperational) {
      console.error('Operational error:', error);
    }
    return error;
  }

  // Log programming or unknown errors
  console.error('Unexpected error:', error);
  captureException(error);
  
  return new AppError(
    'An unexpected error occurred',
    'INTERNAL_SERVER_ERROR',
    500,
    false
  );
};

export const isAxiosError = (error: unknown): error is AxiosError => {
  return (error as any)?.isAxiosError === true;
};

export const extractErrorMessage = (error: unknown): string => {
  if (error instanceof AppError) {
    return error.message;
  }
  
  if (isAxiosError(error)) {
    return (error.response?.data as any)?.message || error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unexpected error occurred';
};

export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const; 