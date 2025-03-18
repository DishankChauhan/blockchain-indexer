import { sendNotification } from '../services/notificationService';
import { ErrorResponse } from '@/types';

export class IndexingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'IndexingError';
  }
}

export async function handleError(
  error: Error,
  userId?: string,
  context: Record<string, any> = {}
): Promise<ErrorResponse> {
  const errorId = generateErrorId();
  const timestamp = new Date().toISOString();

  // Determine error type and severity
  const { type, severity } = categorizeError(error);

  // Log error details
  console.error('Error occurred:', {
    errorId,
    timestamp,
    name: error.name,
    message: error.message,
    stack: error.stack,
    context,
  });

  // Send notification based on severity
  if (severity === 'high') {
    await sendNotification(
      `Critical error: ${error.message}`,
      'error',
      {
        userId,
        channel: ['email', 'webhook', 'database'],
        priority: 'high',
        metadata: {
          errorId,
          type,
          context,
        },
      }
    );
  } else if (severity === 'medium') {
    await sendNotification(
      `Error occurred: ${error.message}`,
      'error',
      {
        userId,
        channel: ['database'],
        priority: 'medium',
        metadata: {
          errorId,
          type,
          context,
        },
      }
    );
  }

  // Return formatted error response
  return {
    error: {
      id: errorId,
      type,
      message: error.message,
      timestamp,
    },
  };
}

function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function categorizeError(error: Error): { type: string; severity: 'low' | 'medium' | 'high' } {
  if (error instanceof IndexingError) {
    // Categorize based on error code
    switch (error.code) {
      case 'WEBHOOK_VERIFICATION_FAILED':
      case 'DATABASE_CONNECTION_FAILED':
      case 'AUTHENTICATION_FAILED':
        return { type: 'security', severity: 'high' };
      
      case 'INDEXING_FAILED':
      case 'NOTIFICATION_FAILED':
      case 'EMAIL_SEND_FAILED':
        return { type: 'service', severity: 'medium' };
      
      case 'VALIDATION_FAILED':
      case 'RESOURCE_NOT_FOUND':
        return { type: 'client', severity: 'low' };
      
      default:
        return { type: 'unknown', severity: 'medium' };
    }
  }

  // Handle specific error types
  if (error.name === 'PrismaClientKnownRequestError') {
    return { type: 'database', severity: 'high' };
  }

  if (error.name === 'FetchError' || error.name === 'NetworkError') {
    return { type: 'network', severity: 'medium' };
  }

  // Default categorization
  return { type: 'system', severity: 'medium' };
} 