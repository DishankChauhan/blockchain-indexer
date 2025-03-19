import { PrismaClient, Prisma } from '@prisma/client';
import { AppError } from '@/lib/utils/errorHandling';
import { HeliusService } from './heliusService';
import { createHmac } from 'crypto';

const prisma = new PrismaClient();

export interface WebhookConfig {
  url: string;
  secret: string;
  retryCount?: number;
  retryDelay?: number;
  filters?: any;
}

export interface WebhookLog {
  id: string;
  webhookId: string;
  status: 'success' | 'failed' | 'retrying';
  attempt: number;
  payload: any;
  response?: any;
  error?: string;
  timestamp: Date;
}

export class WebhookService {
  updateWebhook(id: string, arg1: { url: any; secret: any; retryCount: any; retryDelay: any; filters: any; }) {
    throw new Error('Method not implemented.');
  }
  private static instance: WebhookService;
  private readonly maxRetries = 5;
  private readonly initialRetryDelay = 1000; // 1 second
  private heliusService: HeliusService;

  private constructor() {
    this.heliusService = HeliusService.getInstance();
  }

  public static getInstance(): WebhookService {
    if (!WebhookService.instance) {
      WebhookService.instance = new WebhookService();
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
      console.error('Error creating webhook:', error);
      throw error;
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
      console.error('Error deleting webhook:', error);
      throw error;
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
      console.error('Error getting webhook:', error);
      throw error;
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
      console.error('Error listing webhooks:', error);
      throw error;
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
      console.error('Error logging webhook event:', err);
      throw err;
    }
  }

  async handleWebhookEvent(webhookId: string, payload: any, signature: string) {
    try {
      const webhook = await prisma.webhook.findUnique({
        where: { id: webhookId },
      });

      if (!webhook) {
        throw new AppError('Webhook not found');
      }

      // Verify signature
      if (!this.verifySignature(webhook.secret, payload, signature)) {
        throw new AppError('Invalid webhook signature');
      }

      // Process the webhook event
      await this.processWebhookEvent(webhook, payload);
      // Log successful event
      await this.logWebhookEvent(webhookId, 'success', 1, payload, undefined, undefined);
    } catch (error) {
      // Log failed event
      await this.logWebhookEvent(webhookId, 'failed', 1, payload, undefined, (error as Error).message);
      const webhookData = await prisma.webhook.findUnique({
        where: { id: webhookId },
      });

      // Retry if configured
      if (webhookData && webhookData.retryCount > 0) {
        await this.scheduleRetry(webhookData, payload, 1);
      }

      throw error;
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
} 