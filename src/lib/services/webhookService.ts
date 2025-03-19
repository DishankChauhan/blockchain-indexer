import { PrismaClient, Prisma, Webhook } from '@prisma/client';
import { WebhookLog } from '@prisma/client';
import { AppError } from '../utils/errorHandling';
import AppLogger from '../utils/logger';
import { HeliusService } from './heliusService';
import { EmailService } from './emailService';
import { createHmac } from 'crypto';

const prisma = new PrismaClient();

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
}

export class WebhookService {
  updateWebhook(id: string, arg1: { url: any; secret: any; retryCount: any; retryDelay: any; filters: any; }) {
    throw new Error('Method not implemented.');
  }
  private static instance: WebhookService;
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

  private constructor(userId: string) {
    this.userId = userId;
    this.heliusService = HeliusService.getInstance(userId);
    this.emailService = EmailService.getInstance();
    // Clean up expired rate limit entries every minute
    setInterval(() => this.cleanupRateLimits(), 60000);
  }

  private cleanupRateLimits() {
    const now = Date.now();
    this.rateLimitMap.forEach((info, webhookId) => {
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
    return true;
  }

  public static getInstance(userId: string): WebhookService {
    if (!WebhookService.instance) {
      WebhookService.instance = new WebhookService(userId);
    }
    return WebhookService.instance;
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
      const webhook = await prisma.webhook.create({
        data: {
          indexingJobId,
          userId,
          url: config.url,
          secret: config.secret,
          retryCount: config.retryCount ?? 3,
          retryDelay: config.retryDelay ?? 1000,
          heliusWebhookId: heliusWebhook.webhookId,
          filters: config.filters ?? {},
          status: 'active'
        } as Prisma.WebhookUncheckedCreateInput
      });

      return webhook;
    } catch (error) {
      AppLogger.error('Failed to create webhook', error as Error, {
        component: 'WebhookService',
        action: 'createWebhook',
        userId: userId
      });
      throw new AppError('Failed to create webhook');
    }
  }

  async deleteWebhook(id: string) {
    try {
      const webhook = await prisma.webhook.findUnique({
        where: { id }
      });

      if (!webhook) {
        throw new Error('Webhook not found');
      }

      // Delete webhook from Helius
      await this.heliusService.deleteWebhook(webhook.heliusWebhookId);

      // Delete webhook from database
      await prisma.webhook.delete({
        where: { id }
      });
    } catch (error) {
      AppLogger.error('Failed to delete webhook', error as Error, {
        component: 'WebhookService',
        action: 'deleteWebhook',
        webhookId: id
      });
      throw new AppError('Failed to delete webhook');
    }
  }

  async getWebhook(id: string) {
    try {
      const webhook = await prisma.webhook.findUnique({
        where: { id }
      });

      if (!webhook) {
        throw new Error('Webhook not found');
      }
      const logs = await prisma.webhookLog.findMany({
        where: { webhookId: id },
        orderBy: { timestamp: 'desc' },
        take: 10
      });

      return { ...webhook, logs };
    } catch (error) {
      AppLogger.error('Failed to get webhook', error as Error, {
        component: 'WebhookService',
        action: 'getWebhook',
        webhookId: id
      });
      throw new AppError('Failed to get webhook');
    }
  }

  async listWebhooks(userId: string) {
    try {
      const webhooks = await prisma.webhook.findMany({
        where: { userId }
      });

      const webhooksWithLogs = await Promise.all(
        webhooks.map(async (webhook) => {
          const latestLog = await prisma.webhookLog.findFirst({
            where: { webhookId: webhook.id },
            orderBy: { timestamp: 'desc' }
          });
          return { ...webhook, logs: latestLog ? [latestLog] : [] };
        })
      );

      return webhooksWithLogs;
    } catch (error) {
      AppLogger.error('Failed to list webhooks', error as Error, {
        component: 'WebhookService',
        action: 'listWebhooks',
        userId: userId
      });
      throw new AppError('Failed to list webhooks');
    }
  }

  async logWebhookEvent(webhookId: string, status: string, attempt: number, payload: any, response?: any, error?: string) {
    try {
      const log = await prisma.webhookLog.create({
        data: {
          webhookId,
          status,
          attempt,
          payload,
          response: response || undefined,
          error: error || undefined
        }
      });

      return log;
    } catch (err) {
      AppLogger.error('Failed to log webhook event', err as Error, {
        component: 'WebhookService',
        action: 'logWebhookEvent',
        webhookId,
        status,
        error
      });
      // Don't throw here as this is a logging operation
    }
  }

  async handleWebhookEvent(webhookId: string, payload: any, signature: string) {
    try {
      const webhook = await prisma.webhook.findUnique({
        where: { id: webhookId }
      }) as WebhookWithConfig;

      if (!webhook) {
        throw new AppError('Webhook not found');
      }

      // Parse config
      const webhookConfig = webhook.config ? JSON.parse(webhook.config) : {};

      // Check rate limit
      if (!this.checkRateLimit(webhookId, webhookConfig.rateLimit)) {
        const error = new AppError('Rate limit exceeded');
        await this.logWebhookEvent(webhookId, 'failed', 1, payload, undefined, error.message);
        await this.sendNotification(webhook, webhookConfig, 'Rate limit exceeded for webhook');
        throw error;
      }

      // Verify signature
      if (!this.verifySignature(webhook.secret, payload, signature)) {
        throw new AppError('Invalid webhook signature');
      }

      // Validate payload
      this.validatePayload(payload);

      // Process the webhook event
      await this.processWebhookEvent(webhook, payload);
      await this.logWebhookEvent(webhookId, 'success', 1, payload, undefined, undefined);
    } catch (error) {
      await this.logWebhookEvent(webhookId, 'failed', 1, payload, undefined, (error as Error).message);
      const webhook = await prisma.webhook.findUnique({
        where: { id: webhookId }
      }) as WebhookWithConfig;

      if (webhook) {
        const webhookConfig = webhook.config ? JSON.parse(webhook.config) : {};
        await this.sendNotification(webhook, webhookConfig, `Webhook error: ${(error as Error).message}`);
        if (webhook.retryCount > 0) {
          await this.scheduleRetry(webhook, payload, 1);
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

  private async processWebhookEvent(webhook: any, payload: any) {
    try {
      // Apply filters
      if (!this.passesFilters(payload, webhook.filters)) {
        return;
      }

      // Make HTTP request to webhook URL
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': this.generateSignature(webhook.secret, payload),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      throw new AppError(`Failed to process webhook event: ${error}`);
    }
  }

  private async scheduleRetry(webhook: any, payload: any, attempt: number) {
    const retryDelay = this.calculateRetryDelay(attempt, webhook.retryDelay);
    
    setTimeout(async () => {
      try {
        await this.processWebhookEvent(webhook, payload);
       
        // Log successful retry
        await this.logWebhookEvent(webhook.id, 'success', attempt + 1, payload, undefined, undefined);
      } catch (error) {
        // Log failed retry
        await this.logWebhookEvent(webhook.id, 'failed', attempt + 1, payload, undefined, (error as Error).message);

        // Schedule next retry if not exceeded max attempts
        if (attempt < webhook.retryCount) {
          await this.scheduleRetry(webhook, payload, attempt + 1);
        }
      }
    }, retryDelay);
  }

  private calculateRetryDelay(attempt: number, baseDelay: number): number {
    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
  }

  private verifySignature(secret: string, payload: any, signature: string): boolean {
    const hmac = createHmac('sha256', secret);
    const calculatedSignature = hmac.update(JSON.stringify(payload)).digest('hex');
    return calculatedSignature === signature;
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
      const logs = await prisma.webhookLog.findMany({
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
      await prisma.webhookLog.create({
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
      AppLogger.error('Failed to send webhook notification', error as Error, {
        component: 'WebhookService',
        action: 'sendNotification',
        webhookId: webhook.id,
        url: webhook.url
      });
      throw new AppError('Failed to send webhook notification');
    }
  }
} 