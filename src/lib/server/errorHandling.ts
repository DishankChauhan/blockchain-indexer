import { logError } from './logger';
import { AppError } from '../utils/errorHandling';

export function handleServerError(error: Error | AppError, context?: Record<string, any>) {
  logError('Server error', error, context);
} 