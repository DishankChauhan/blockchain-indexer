export class AppError extends Error {
  public readonly isOperational: boolean;
  statusCode: number | undefined;

  constructor(message: string, isOperational: boolean = true) {
    super(message);
    this.name = 'AppError';
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const handleError = (error: unknown, p0: { component: string; action: string; }): string => {
  if (error instanceof AppError) {
    if (!error.isOperational) {
      console.error('Non-operational error:', error);
    }
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred';
}; 