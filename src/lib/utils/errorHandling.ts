export class AppError extends Error {
  public readonly isOperational: boolean;

  constructor(message: string, isOperational = true) {
    super(message);
    this.name = 'AppError';
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function handleError({ component, action }: { component: string; action: string }, error: unknown): never {
  console.error(`Error in ${component} during ${action}:`, error);
  
  if (error instanceof AppError) {
    throw error;
  }
  
  throw new AppError(
    `Unexpected error in ${component} during ${action}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    false
  );
} 