import { PrismaClient, Prisma, Webhook } from '@prisma/client';
import { WebhookLog } from '@prisma/client';
import { AppError } from '../utils/errorHandling';
import { logError, logInfo, logDebug } from '../utils/serverLogger';
import { HeliusService } from './heliusService';
import { EmailService } from './emailService';
import { createHmac } from 'crypto';

// Rate limiting configuration
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

export interface WebhookConfig {
  url: string;
  secret: string;
  retryCount?: number;
  retryDelay?: number;
  filters?: any;
  rateLimit?: RateLimitConfig;
  notificationEmail?: string; // Add email for notifications
}

interface WebhookWithConfig extends Webhook {
  config: string | null;
  filters: string | null;
}

export class WebhookService {
  private static instance: WebhookService | null = null;
  private readonly maxRetries = 5;
  private readonly initialRetryDelay = 1000; // 1 second
  private heliusService: HeliusService;
  private emailService: EmailService;
  private rateLimitMap: Map<string, RateLimitInfo> = new Map();
  private defaultRateLimit: RateLimitConfig = {
    windowMs: 60000, // 1 minute
    maxRequests: 60  // 60 requests per minute
  };
  private readonly userId: string;
  private cleanupInterval: NodeJS.Timeout | undefined;
  private prisma: PrismaClient;

  private constructor(userId: string, prismaClient?: PrismaClient) {
    if (!userId || userId.trim() === '') {
      throw new AppError('userId is required');
    }
    this.userId = userId;
    this.heliusService = HeliusService.getInstance(userId);
    this.emailService = EmailService.getInstance();
    this.prisma = prismaClient || new PrismaClient();
    
    // Clean up expired rate limit entries every minute
    this.cleanupInterval = setInterval(() => {
      try {
        this.cleanupRateLimits();
      } catch (error) {
        logError('Failed to cleanup rate limits', error as Error, {
          component: 'WebhookService',
          action: 'cleanupRateLimits'
        });
      }
    }, 60000);
  }

  public static getInstance(userId: string, prismaClient?: PrismaClient): WebhookService {
    if (!userId || userId.trim() === '') {
      throw new AppError('userId is required');
    }
    if (!WebhookService.instance) {
      WebhookService.instance = new WebhookService(userId, prismaClient);
    }
    return WebhookService.instance;
  }

  public static resetInstance(): void {
    WebhookService.instance = null;
  }

  public async cleanup(): Promise<void> {
    try {
      // Cleanup dependent services
      await this.heliusService.cleanup();
      await this.emailService.cleanup();
      
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = undefined;
      }
      
      this.cleanupRateLimits();
      await this.prisma.$disconnect();
      
      this.rateLimitMap.clear();
      
      // Reset singleton instance
      WebhookService.instance = null;
      
      logInfo('WebhookService cleaned up successfully', {
        userId: this.userId,
      });
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logError('Failed to cleanup WebhookService', errorObj, {
        userId: this.userId,
      });
      // Don't throw the error to handle cleanup failures gracefully
    }
  }

  private cleanupRateLimits() {
    const now = Date.now();
    Array.from(this.rateLimitMap.entries()).forEach(([webhookId, info]) => {
      if (info.resetTime <= now) {
        this.rateLimitMap.delete(webhookId);
      }
    });
  }

  private checkRateLimit(webhookId: string, config?: RateLimitConfig): boolean {
    const now = Date.now();
    const limit = config || this.defaultRateLimit;
    const info = this.rateLimitMap.get(webhookId);

    if (!info || info.resetTime <= now) {
      // New or expired entry
      this.rateLimitMap.set(webhookId, {
        count: 1,
        resetTime: now + limit.windowMs
      });
      return true;
    }

    if (info.count >= limit.maxRequests) {
      return false;
    }

    info.count++;
    this.rateLimitMap.set(webhookId, info);
    return true;
  }

  async createWebhook(userId: string, indexingJobId: string, config: WebhookConfig) {
    try {
      // Create webhook in Helius
      const heliusWebhook = await this.heliusService.createWebhook({
        accountAddresses: [],
        programIds: [],
        webhookURL: config.url,
        webhookSecret: config.secret
      });

      // Store webhook configuration
      const webhook = await this.prisma.webhook.create({
        data: {
          indexingJobId,
          userId,
          url: config.url,
          secret: config.secret,
          retryCount: config.retryCount ?? 3,
          retryDelay: config.retryDelay ?? 1000,
          heliusWebhookId: heliusWebhook.webhookId,
          filters: JSON.stringify(config.filters ?? {}),
          status: 'active'
        } as Prisma.WebhookUncheckedCreateInput
      });

      return webhook;
    } catch (error) {
      logError('Failed to create webhook', error as Error, {
        component: 'WebhookService',
        action: 'createWebhook',
        userId: userId
      });
      throw new AppError('Failed to create webhook');
    }
  }

  async deleteWebhook(id: string) {
    try {
      const webhook = await this.prisma.webhook.findUnique({
        where: { id }
      });

      if (!webhook) {
        throw new Error('Webhook not found');
      }

      // Delete webhook from Helius
      await this.heliusService.deleteWebhook(webhook.heliusWebhookId);

      // Delete webhook from database
      await this.prisma.webhook.delete({
        where: { id }
      });
    } catch (error) {
      logError('Failed to delete webhook', error as Error, {
        component: 'WebhookService',
        action: 'deleteWebhook',
        webhookId: id
      });
      throw new AppError('Failed to delete webhook');
    }
  }

  async getWebhook(id: string) {
    try {
      const webhook = await this.prisma.webhook.findUnique({
        where: { id }
      });

      if (!webhook) {
        throw new Error('Webhook not found');
      }
      const logs = await this.prisma.webhookLog.findMany({
        where: { webhookId: id },
        orderBy: { timestamp: 'desc' },
        take: 10
      });

      return { ...webhook, logs };
    } catch (error) {
      logError('Failed to get webhook', error as Error, {
        component: 'WebhookService',
        action: 'getWebhook',
        webhookId: id
      });
      throw new AppError('Failed to get webhook');
    }
  }

  async listWebhooks(userId: string) {
    try {
      const webhooks = await this.prisma.webhook.findMany({
        where: { userId }
      });

      const webhooksWithLogs = await Promise.all(
        webhooks.map(async (webhook) => {
          const latestLog = await this.prisma.webhookLog.findFirst({
            where: { webhookId: webhook.id },
            orderBy: { timestamp: 'desc' }
          });
          return { ...webhook, logs: latestLog ? [latestLog] : [] };
        })
      );

      return webhooksWithLogs;
    } catch (error) {
      logError('Failed to list webhooks', error as Error, {
        component: 'WebhookService',
        action: 'listWebhooks',
        userId: userId
      });
      throw new AppError('Failed to list webhooks');
    }
  }

  private verifySignature(secret: string, signature: string, payload: any): boolean {
    if (!signature || signature.trim() === '') {
      return false;
    }

    try {
      const expectedSignature = this.generateSignature(secret, payload);
      return signature === expectedSignature;
    } catch (error) {
      logError('Failed to verify signature', error as Error, {
        component: 'WebhookService',
        action: 'verifySignature'
      });
      return false;
    }
  }

  private async processWebhookEvent(webhook: WebhookWithConfig, payload: any) {
    let attempt = 1;
    const maxAttempts = webhook.retryCount || 3;
    const baseDelay = webhook.retryDelay || 1000;

    while (attempt <= maxAttempts) {
      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': this.generateSignature(webhook.secret, payload)
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return;
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }

        // Wait before retrying
        const delay = this.calculateRetryDelay(attempt, baseDelay);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
      }
    }
  }

  private calculateRetryDelay(attempt: number, baseDelay: number): number {
    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
  }

  private generateSignature(secret: string, payload: any): string {
    const hmac = createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  }

  private passesFilters(payload: any, filters: any): boolean {
    if (!filters) return true;

    // Check program IDs
    if (filters.programIds?.length > 0) {
      const payloadProgramIds = Array.isArray(payload.programIds) 
        ? payload.programIds 
        : [payload.programId];
      
      if (!payloadProgramIds.some((id: any) => filters.programIds.includes(id))) {
        return false;
      }
    }

    // Check account IDs
    if (filters.accountIds?.length > 0) {
      const payloadAccountIds = Array.isArray(payload.accountIds) 
        ? payload.accountIds 
        : [payload.accountId];
      
      if (!payloadAccountIds.some((id: any) => filters.accountIds.includes(id))) {
        return false;
      }
    }

    // Check event types
    if (filters.eventTypes?.length > 0) {
      if (!filters.eventTypes.includes(payload.type)) {
        return false;
      }
    }

    return true;
  }

  async getWebhookLogs(webhookId: string, options: {
    startDate?: Date;
    endDate?: Date;
    status?: 'success' | 'failed' | 'retrying';
    limit?: number;
    offset?: number;
  } = {}) {
    try {
      const logs = await this.prisma.webhookLog.findMany({
        where: {
          webhookId,
          ...(options.startDate && {
            timestamp: {
              gte: options.startDate,
            },
          }),
          ...(options.endDate && {
            timestamp: {
              lte: options.endDate,
            },
          }),
          ...(options.status && {
            status: options.status,
          }),
        },
        orderBy: {
          timestamp: 'desc',
        },
        take: options.limit || 50,
        skip: options.offset || 0,
      });

      return logs;
    } catch (error) {
      throw new AppError(`Failed to get webhook logs: ${error}`);
    }
  }

  private async sendNotification(webhook: any, config: any, message: string) {
    if (!config.notificationEmail) return;

    try {
      // Send email notification
      const emailSent = await this.emailService.sendEmail({
        to: config.notificationEmail,
        subject: `Webhook Notification - ${webhook.id}`,
        text: message,
        html: `
          <h2>Webhook Notification</h2>
          <p><strong>Webhook ID:</strong> ${webhook.id}</p>
          <p><strong>URL:</strong> ${webhook.url}</p>
          <p><strong>Message:</strong> ${message}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        `
      });
      
      // Log the notification
      await this.prisma.webhookLog.create({
        data: {
          webhookId: webhook.id,
          status: 'notification',
          attempt: 1,
          payload: { 
            message,
            emailSent,
            emailAddress: config.notificationEmail 
          },
          timestamp: new Date()
        }
      });
    } catch (error) {
      logError('Failed to send webhook notification', error as Error, {
        component: 'WebhookService',
        action: 'sendNotification',
        webhookId: webhook.id,
        url: webhook.url
      });
      throw new AppError('Failed to send webhook notification');
    }
  }

  private async logWebhookEvent(webhookId: string, status: string, attempt: number, payload: any, response?: any, error?: string): Promise<void> {
    try {
      // Convert payload to string if it's not already
      const payloadString = typeof payload === 'string' 
        ? payload 
        : JSON.stringify(payload);

      // Convert response to string if present
      const responseString = response 
        ? (typeof response === 'string' ? response : JSON.stringify(response))
        : undefined;

      await this.prisma.webhookLog.create({
        data: {
          webhookId,
          status,
          attempt,
          payload: payloadString,
          response: responseString,
          error: error || undefined,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      logError('Failed to log webhook event', error as Error, {
        component: 'WebhookService',
        action: 'logWebhookEvent',
        webhookId,
        status,
        error,
      });
    }
  }

  async handleWebhookEvent(webhookId: string, payload: Record<string, any>, signature: string) {
    let webhook: WebhookWithConfig | null = null;
    let attempt = 1;

    try {
      webhook = await this.prisma.webhook.findUnique({
        where: { id: webhookId }
      }) as WebhookWithConfig;

      if (!webhook) {
        throw new AppError('Webhook not found');
      }

      // Parse webhook config
      const config = webhook.config ? JSON.parse(webhook.config) : {};
      const rateLimit = config.rateLimit || this.defaultRateLimit;

      // Check rate limit
      if (!this.checkRateLimit(webhookId, rateLimit)) {
        throw new AppError('Rate limit exceeded');
      }

      // Verify signature
      if (!this.verifySignature(webhook.secret, signature, payload)) {
        throw new AppError('Invalid webhook signature');
      }

      // Validate filters
      const filters = webhook.filters ? JSON.parse(webhook.filters as string) : null;
      if (filters && !this.passesFilters(payload, filters)) {
        throw new AppError('Payload does not match filters');
      }

      // Process webhook event
      await this.processWebhookEvent(webhook, payload);

      // Log success
      await this.logWebhookEvent(webhookId, 'success', attempt, payload);
    } catch (error) {
      // Log failure
      await this.logWebhookEvent(webhookId, 'failed', attempt, payload, undefined, (error as Error).message);

      // Send notification if configured
      if (webhook?.config) {
        const config = JSON.parse(webhook.config);
        if (config.notificationEmail) {
          await this.emailService.sendEmail({
            to: config.notificationEmail,
            subject: 'Webhook Event Failed',
            text: `Failed to process webhook event: ${(error as Error).message}`
          });
        }
      }

      throw error;
    }
  }

  private validatePayload(payload: any) {
    if (!payload || typeof payload !== 'object') {
      throw new AppError('Invalid payload: must be a non-null object');
    }

    // Add specific validation rules based on your payload structure
    const requiredFields = ['type', 'timestamp'];
    for (const field of requiredFields) {
      if (!(field in payload)) {
        throw new AppError(`Invalid payload: missing required field '${field}'`);
      }
    }

    // Validate timestamp
    if (isNaN(Date.parse(payload.timestamp))) {
      throw new AppError('Invalid payload: timestamp must be a valid date');
    }
  }
} 