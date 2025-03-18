export enum NotificationType {
    ERROR = 'error',
    WARNING = 'warning',
    INFO = 'info',
    SUCCESS = 'success'
  }
  
  export type NotificationChannel = 'email' | 'webhook' | 'database';
  export type NotificationPriority = 'low' | 'medium' | 'high';
  export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'retrying';
  
  export interface NotificationOptions {
    userId?: string;
    channel?: NotificationChannel[];
    priority?: NotificationPriority;
    metadata?: Record<string, any>;
    retryCount?: number;
  }
  
  export interface EmailTemplate {
    subject: string;
    color: string;
  }
  
  export interface NotificationResponse {
    success: boolean;
    notification?: {
      id: string;
      status: NotificationStatus;
      channel: NotificationChannel[];
      createdAt: Date;
    };
    error?: {
      code: string;
      message: string;
      retryAfter?: number;
    };
  }
  
  export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
  } 