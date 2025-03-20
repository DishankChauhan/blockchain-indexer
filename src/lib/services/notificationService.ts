import { 
  NotificationType, 
  NotificationOptions, 
  NotificationResponse 
} from '@/types/notification';
import { PrismaClient, Notification } from '@prisma/client';
import { AppError } from '@/lib/utils/errorHandling';
import { logError } from '@/lib/utils/serverLogger';
import { EmailService } from './emailService';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 15000]; // Exponential backoff in milliseconds
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 100; // Maximum requests per minute

class NotificationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = true,
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = 'NotificationError';
  }
}

// In-memory rate limiting (consider using Redis in a distributed system)
const rateLimitStore = new Map<string, { count: number; timestamp: number }>();

function checkRateLimit(userId?: string): void {
  const key = userId || 'anonymous';
  const now = Date.now();
  const limit = rateLimitStore.get(key);

  if (limit) {
    if (now - limit.timestamp > RATE_LIMIT_WINDOW) {
      // Reset if window has passed
      rateLimitStore.set(key, { count: 1, timestamp: now });
    } else if (limit.count >= MAX_REQUESTS) {
      const retryAfter = Math.ceil((RATE_LIMIT_WINDOW - (now - limit.timestamp)) / 1000);
      throw new NotificationError(
        'Rate limit exceeded',
        'RATE_LIMIT_EXCEEDED',
        true,
        retryAfter
      );
    } else {
      // Increment count
      rateLimitStore.set(key, { count: limit.count + 1, timestamp: limit.timestamp });
    }
  } else {
    // First request
    rateLimitStore.set(key, { count: 1, timestamp: now });
  }
}

async function sendNotificationWithRetry(
  message: string,
  type: NotificationType,
  options: NotificationOptions,
  retryCount = 0
): Promise<NotificationResponse> {
  try {
    checkRateLimit(options.userId);

    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        type,
        options: { ...options, retryCount },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new NotificationError(
        error.message || 'Failed to send notification',
        error.code || 'NOTIFICATION_FAILED',
        error.retryable !== false,
        error.retryAfter
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof NotificationError) {
      if (error.retryable && retryCount < MAX_RETRIES) {
        // Wait for the specified delay or use exponential backoff
        const delay = error.retryAfter 
          ? error.retryAfter * 1000 
          : RETRY_DELAYS[retryCount];
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return sendNotificationWithRetry(message, type, options, retryCount + 1);
      }
      throw error;
    }

    // Handle unexpected errors
    logError('Unexpected notification error', error as Error, {
      component: 'NotificationService',
      action: 'handleNotification',
      notificationType: type,
      userId: options.userId
    });
    throw new NotificationError(
      'An unexpected error occurred',
      'UNEXPECTED_ERROR',
      false
    );
  }
}

export async function sendNotification(
  message: string,
  type: NotificationType,
  options: NotificationOptions = {}
): Promise<NotificationResponse> {
  try {
    // Validate inputs
    if (!message?.trim()) {
      throw new NotificationError(
        'Message is required',
        'INVALID_INPUT',
        false
      );
    }

    if (!Object.values(NotificationType).includes(type)) {
      throw new NotificationError(
        'Invalid notification type',
        'INVALID_INPUT',
        false
      );
    }

    // Set default options
    const defaultOptions: NotificationOptions = {
      channel: ['database'],
      priority: 'medium',
      ...options,
    };

    // Send notification with retry logic
    return await sendNotificationWithRetry(message, type, defaultOptions);
  } catch (error) {
    // Log error for monitoring
    logError('Notification service error', error as Error, {
      component: 'NotificationService',
      action: 'sendNotification',
      notificationType: type,
      userId: options.userId,
      metadata: JSON.stringify(options)
    });

    // Rethrow NotificationError instances
    if (error instanceof NotificationError) {
      throw error;
    }

    // Wrap unknown errors
    throw new NotificationError(
      'Failed to send notification',
      'NOTIFICATION_FAILED',
      false
    );
  }
}

export class NotificationService {
  private static instance: NotificationService | null = null;
  private readonly prisma: PrismaClient;
  private readonly emailService: EmailService;

  private constructor() {
    this.prisma = new PrismaClient();
    this.emailService = EmailService.getInstance();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public async createNotification(
    userId: string,
    type: string,
    message: string,
    metadata: Record<string, any> = {}
  ): Promise<Notification> {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          userId,
          type,
          message,
          metadata,
          status: 'unread'
        }
      });

      // Send email notification if enabled
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, emailNotifications: true }
      });

      if (user?.emailNotifications) {
        await this.emailService.sendEmail({
          to: user.email,
          subject: `New Notification: ${type}`,
          text: message,
          html: `<p>${message}</p>`
        });
      }

      return notification;
    } catch (error) {
      logError('Unexpected notification error', error as Error, {
        component: 'NotificationService',
        action: 'createNotification',
        userId,
        type
      });
      throw new AppError('Failed to create notification');
    }
  }

  public async markAsRead(userId: string, notificationId: string): Promise<void> {
    try {
      await this.prisma.notification.updateMany({
        where: {
          id: notificationId,
          userId
        },
        data: {
          status: 'read',
          readAt: new Date()
        }
      });
    } catch (error) {
      logError('Notification service error', error as Error, {
        component: 'NotificationService',
        action: 'markAsRead',
        userId,
        notificationId
      });
      throw new AppError('Failed to mark notification as read');
    }
  }

  public async cleanup(): Promise<void> {
    await this.prisma.$disconnect();
    NotificationService.instance = null;
  }
} 