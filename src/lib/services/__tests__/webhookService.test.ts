import { WebhookService, WebhookConfig } from '../webhookService';
import { HeliusService } from '../heliusService';
import { EmailService } from '../emailService';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../../utils/errorHandling';
import { createHmac } from 'crypto';

// Mock dependencies
jest.mock('../heliusService');
jest.mock('../emailService');
jest.mock('@prisma/client');

describe('WebhookService', () => {
  const mockUserId = 'test-user-id';
  let webhookService: WebhookService;
  let mockPrisma: jest.Mocked<PrismaClient>;

  // Helper function to generate signatures for testing
  const generateSignature = (secret: string, payload: any): string => {
    const hmac = createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Reset WebhookService instance
    WebhookService.resetInstance();

    // Initialize mocks
    mockPrisma = {
      webhook: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      },
      webhookLog: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      $disconnect: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<PrismaClient>;

    // Mock HeliusService
    (HeliusService.getInstance as jest.Mock).mockReturnValue({
      createWebhook: jest.fn().mockResolvedValue({ webhookId: 'test-webhook-id' }),
      deleteWebhook: jest.fn(),
      cleanup: jest.fn().mockResolvedValue(undefined),
    });

    // Mock EmailService
    (EmailService.getInstance as jest.Mock).mockReturnValue({
      sendEmail: jest.fn().mockResolvedValue(true),
      cleanup: jest.fn().mockResolvedValue(undefined),
    });

    // Initialize WebhookService with mocked Prisma client
    webhookService = WebhookService.getInstance(mockUserId, mockPrisma);
  });

  afterEach(async () => {
    // Cleanup after each test
    await webhookService.cleanup();
  });

  afterAll(async () => {
    // Final cleanup
    if (webhookService) {
      await webhookService.cleanup();
    }
    jest.clearAllTimers();
  });

  describe('getInstance', () => {
    it('should create a singleton instance', () => {
      const instance1 = WebhookService.getInstance(mockUserId);
      const instance2 = WebhookService.getInstance(mockUserId);
      expect(instance1).toBe(instance2);
    });

    it('should require userId parameter', () => {
      expect(() => WebhookService.getInstance('')).toThrow();
    });
  });

  describe('createWebhook', () => {
    const mockConfig: WebhookConfig = {
      url: 'https://test.com/webhook',
      secret: 'test-secret',
      retryCount: 3,
      retryDelay: 1000,
      filters: {
        programIds: ['program1'],
        accountIds: ['account1'],
      },
      rateLimit: {
        windowMs: 60000,
        maxRequests: 60,
      },
    };

    it('should create a webhook successfully', async () => {
      const mockWebhook = {
        id: 'test-webhook-id',
        url: mockConfig.url,
        secret: mockConfig.secret,
      };

      (mockPrisma.webhook.create as jest.Mock).mockResolvedValue(mockWebhook);

      const result = await webhookService.createWebhook(
        mockUserId,
        'test-job-id',
        mockConfig
      );

      expect(result).toEqual(mockWebhook);
      expect(HeliusService.getInstance).toHaveBeenCalledWith(mockUserId);
      expect(mockPrisma.webhook.create).toHaveBeenCalled();
    });

    it('should handle creation errors', async () => {
      (mockPrisma.webhook.create as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(webhookService.createWebhook(
        mockUserId,
        'test-job-id',
        mockConfig
      )).rejects.toThrow('Failed to create webhook');
    });
  });

  describe('handleWebhookEvent', () => {
    const mockPayload = {
      type: 'NFT_SALE',
      timestamp: new Date().toISOString(),
      data: {
        signature: 'test-signature',
      },
    };

    const mockSecret = 'test-secret';
    const mockSignature = generateSignature(mockSecret, mockPayload);

    it('should process webhook event successfully', async () => {
      const mockWebhook = {
        id: 'test-webhook-id',
        url: 'https://test.com/webhook',
        secret: mockSecret,
        retryCount: 3,
        config: JSON.stringify({
          rateLimit: { windowMs: 60000, maxRequests: 60 },
        }),
      };

      (mockPrisma.webhook.findUnique as jest.Mock).mockResolvedValue(mockWebhook);
      (mockPrisma.webhookLog.create as jest.Mock).mockResolvedValue({});

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      await expect(webhookService.handleWebhookEvent(
        'test-webhook-id',
        mockPayload,
        mockSignature
      )).resolves.not.toThrow();

      expect(mockPrisma.webhookLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            webhookId: 'test-webhook-id',
            status: 'success',
          }),
        })
      );
    });

    it('should handle rate limit exceeded', async () => {
      const mockWebhook = {
        id: 'test-webhook-id',
        url: 'https://test.com/webhook',
        secret: mockSecret,
        retryCount: 3,
        config: JSON.stringify({
          rateLimit: { windowMs: 60000, maxRequests: 1 },
        }),
      };

      (mockPrisma.webhook.findUnique as jest.Mock).mockResolvedValue(mockWebhook);

      // Call twice to trigger rate limit
      await webhookService.handleWebhookEvent(
        'test-webhook-id',
        mockPayload,
        mockSignature
      );

      await expect(webhookService.handleWebhookEvent(
        'test-webhook-id',
        mockPayload,
        mockSignature
      )).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle invalid signature', async () => {
      const mockWebhook = {
        id: 'test-webhook-id',
        url: 'https://test.com/webhook',
        secret: 'different-secret',
        retryCount: 3,
      };

      (mockPrisma.webhook.findUnique as jest.Mock).mockResolvedValue(mockWebhook);

      await expect(webhookService.handleWebhookEvent(
        'test-webhook-id',
        mockPayload,
        mockSignature
      )).rejects.toThrow('Invalid webhook signature');
    });

    it('should retry on failure', async () => {
      const mockWebhook = {
        id: 'test-webhook-id',
        url: 'https://test.com/webhook',
        secret: mockSecret,
        retryCount: 3,
        retryDelay: 100,
      };

      (mockPrisma.webhook.findUnique as jest.Mock).mockResolvedValue(mockWebhook);

      global.fetch = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true });

      await expect(webhookService.handleWebhookEvent(
        'test-webhook-id',
        mockPayload,
        mockSignature
      )).resolves.not.toThrow();

      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getWebhookLogs', () => {
    it('should retrieve webhook logs successfully', async () => {
      const mockLogs = [
        {
          id: 1,
          webhookId: 'test-webhook-id',
          status: 'success',
          timestamp: new Date(),
        },
      ];

      (mockPrisma.webhookLog.findMany as jest.Mock).mockResolvedValue(mockLogs);

      const result = await webhookService.getWebhookLogs('test-webhook-id', {
        limit: 10,
        offset: 0,
      });

      expect(result).toEqual(mockLogs);
      expect(mockPrisma.webhookLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { webhookId: 'test-webhook-id' },
        })
      );
    });

    it('should handle log retrieval errors', async () => {
      (mockPrisma.webhookLog.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(webhookService.getWebhookLogs('test-webhook-id'))
        .rejects.toThrow('Failed to get webhook logs');
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources successfully', async () => {
      await expect(webhookService.cleanup()).resolves.not.toThrow();
      expect(HeliusService.getInstance(mockUserId).cleanup).toHaveBeenCalled();
      expect(EmailService.getInstance().cleanup).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      const mockError = new Error('Cleanup failed');
      (HeliusService.getInstance(mockUserId).cleanup as jest.Mock).mockRejectedValue(mockError);
      
      await expect(webhookService.cleanup()).resolves.not.toThrow();
    });
  });

  describe('notification handling', () => {
    const mockPayload = {
      type: 'NFT_SALE',
      timestamp: new Date().toISOString(),
      data: {
        signature: 'test-signature',
      },
    };

    const mockSecret = 'test-secret';
    const mockSignature = generateSignature(mockSecret, mockPayload);

    it('should send notification on webhook failure', async () => {
      const mockWebhook = {
        id: 'test-webhook-id',
        url: 'https://test.com/webhook',
        secret: mockSecret,
        config: JSON.stringify({
          notificationEmail: 'test@example.com',
          rateLimit: { windowMs: 60000, maxRequests: 60 },
        }),
      };

      (mockPrisma.webhook.findUnique as jest.Mock).mockResolvedValue(mockWebhook);
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(webhookService.handleWebhookEvent(
        'test-webhook-id',
        mockPayload,
        mockSignature
      )).rejects.toThrow('Network error');

      expect(EmailService.getInstance().sendEmail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Webhook Event Failed',
        text: expect.stringContaining('Network error')
      });
    });
  });

  describe('filter validation', () => {
    const mockPayload = {
      type: 'NFT_SALE',
      programId: 'program1',
      accountId: 'account1',
      timestamp: new Date().toISOString(),
    };

    const mockSecret = 'test-secret';
    const mockSignature = generateSignature(mockSecret, mockPayload);

    it('should apply filters correctly', async () => {
      const mockWebhook = {
        id: 'test-webhook-id',
        url: 'https://test.com/webhook',
        secret: mockSecret,
        filters: JSON.stringify({
          programIds: ['program1'],
          accountIds: ['account1'],
          eventTypes: ['NFT_SALE'],
        }),
        config: JSON.stringify({
          rateLimit: { windowMs: 60000, maxRequests: 60 },
        }),
      };

      (mockPrisma.webhook.findUnique as jest.Mock).mockResolvedValue(mockWebhook);
      global.fetch = jest.fn().mockResolvedValue({ ok: true });

      await expect(webhookService.handleWebhookEvent(
        'test-webhook-id',
        mockPayload,
        mockSignature
      )).resolves.not.toThrow();
    });

    it('should reject non-matching filters', async () => {
      const mockWebhook = {
        id: 'test-webhook-id',
        url: 'https://test.com/webhook',
        secret: mockSecret,
        filters: JSON.stringify({
          programIds: ['different-program'],
          accountIds: ['different-account'],
          eventTypes: ['DIFFERENT_TYPE'],
        }),
        config: JSON.stringify({
          rateLimit: { windowMs: 60000, maxRequests: 60 },
        }),
      };

      (mockPrisma.webhook.findUnique as jest.Mock).mockResolvedValue(mockWebhook);

      await expect(webhookService.handleWebhookEvent(
        'test-webhook-id',
        mockPayload,
        mockSignature
      )).rejects.toThrow('Payload does not match filters');
    });
  });

  describe('retry delay calculation', () => {
    const mockPayload = {
      type: 'NFT_SALE',
      timestamp: new Date().toISOString(),
    };

    const mockSecret = 'test-secret';
    const mockSignature = generateSignature(mockSecret, mockPayload);

    it('should calculate exponential backoff correctly', async () => {
      const mockWebhook = {
        id: 'test-webhook-id',
        url: 'https://test.com/webhook',
        secret: mockSecret,
        retryCount: 3,
        retryDelay: 1000,
        config: JSON.stringify({
          rateLimit: { windowMs: 60000, maxRequests: 60 },
        }),
      };

      (mockPrisma.webhook.findUnique as jest.Mock).mockResolvedValue(mockWebhook);
      global.fetch = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true });

      const startTime = Date.now();
      await webhookService.handleWebhookEvent(
        'test-webhook-id',
        mockPayload,
        mockSignature
      );
      const endTime = Date.now();

      // Should have waited at least 3000ms (1000 + 2000)
      expect(endTime - startTime).toBeGreaterThanOrEqual(3000);
      expect(fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('signature verification', () => {
    it('should handle malformed signatures', async () => {
      const mockWebhook = {
        id: 'test-webhook-id',
        url: 'https://test.com/webhook',
        secret: 'test-secret',
      };

      (mockPrisma.webhook.findUnique as jest.Mock).mockResolvedValue(mockWebhook);

      await expect(webhookService.handleWebhookEvent(
        'test-webhook-id',
        { type: 'test' },
        'invalid-signature-format'
      )).rejects.toThrow('Invalid webhook signature');
    });

    it('should handle empty signatures', async () => {
      const mockWebhook = {
        id: 'test-webhook-id',
        url: 'https://test.com/webhook',
        secret: 'test-secret',
      };

      (mockPrisma.webhook.findUnique as jest.Mock).mockResolvedValue(mockWebhook);

      await expect(webhookService.handleWebhookEvent(
        'test-webhook-id',
        { type: 'test' },
        ''
      )).rejects.toThrow('Invalid webhook signature');
    });
  });
}); 