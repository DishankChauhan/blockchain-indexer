import WorkerLogger from './workerLogger';

export interface ErrorContext {
  action?: string;
  component?: string;
  userId?: string;
  [key: string]: any;
}

export class WorkerError extends Error {
  public readonly isOperational: boolean;
  context?: ErrorContext;

  constructor(message: string, isOperational = true) {
    super(message);
    this.isOperational = isOperational;
    this.name = 'WorkerError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export function handleWorkerError(error: Error | WorkerError, context?: Record<string, any>) {
  WorkerLogger.error('Worker error occurred', error, context);
}

export const isOperationalError = (error: Error): boolean => {
  if (error instanceof WorkerError) {
    return error.isOperational;
  }
  return false;
}; 