import { HeliusService } from '../heliusService';
import { DatabaseService } from '../databaseService';
import { SecretsManager } from '../../utils/secrets';
import { RateLimiter } from '../../utils/rateLimiter';
import { CircuitBreaker } from '../../utils/circuitBreaker';
import { AppError } from '../../utils/errorHandling';
import { Pool } from 'pg';
import { HeliusWebhookData } from '@/lib/types/helius';
import { IndexingJob } from '@/types';

// Mock dependencies
jest.mock('../databaseService');
jest.mock('../../utils/secrets');
jest.mock('../../utils/rateLimiter');
jest.mock('../../utils/circuitBreaker');
jest.mock('pg');

describe('HeliusService', () => {
  const mockUserId = 'test-user-id';
  let heliusService: HeliusService;
  let mockPool: jest.Mocked<Pool>;
  let mockClient: any;

  const mockTransaction: HeliusWebhookData = {
      accountData: [{
          account: 'test-account',
          program: 'test-program',
          data: {},
          type: ''
      }],
      events: [{
          type: 'NFT_SALE',
          data: {
              mint: 'test-mint',
              price: 1000,
              buyer: 'buyer-address',
              seller: 'seller-address',
          },
          source: ''
      }],
      fee: 5000,
      nativeTransfers: [{
          fromUserAccount: 'from-account',
          toUserAccount: 'to-account',
          amount: 1000000000, // 1 SOL in lamports
      }],
      signature: 'test-signature',
      slot: 12345,
      status: 'success',
      timestamp: Date.now(),
      type: '',
      sourceAddress: ''
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Initialize mocks
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
      end: jest.fn(),
    } as unknown as jest.Mocked<Pool>;

    // Mock DatabaseService getInstance
    (DatabaseService.getInstance as jest.Mock).mockReturnValue({
      getConnection: jest.fn().mockResolvedValue(mockPool),
    });

    // Mock SecretsManager getInstance
    (SecretsManager.getInstance as jest.Mock).mockReturnValue({
      getSecret: jest.fn().mockResolvedValue('test-api-key'),
      setSecret: jest.fn(),
    });

    // Mock RateLimiter getInstance
    (RateLimiter.getInstance as jest.Mock).mockReturnValue({
      waitForToken: jest.fn().mockResolvedValue(true),
    });

    // Mock CircuitBreaker getInstance
    (CircuitBreaker.getInstance as jest.Mock).mockReturnValue({
      executeWithRetry: jest.fn().mockImplementation((_, fn) => fn()),
    });

    // Initialize HeliusService
    heliusService = HeliusService.getInstance(mockUserId);
  });

  describe('getInstance', () => {
    it('should create a singleton instance', () => {
      const instance1 = HeliusService.getInstance(mockUserId);
      const instance2 = HeliusService.getInstance(mockUserId);
      expect(instance1).toBe(instance2);
    });

    it('should require userId parameter', () => {
      expect(() => HeliusService.getInstance('')).toThrow();
    });
  });

  describe('createWebhook', () => {
    const mockWebhookParams = {
      accountAddresses: ['address1'],
      programIds: ['program1'],
      webhookURL: 'https://test.com/webhook',
      webhookSecret: 'secret123',
    };

    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ webhookId: 'test-webhook-id' }),
      });
    });

    it('should create a webhook successfully', async () => {
      const result = await heliusService.createWebhook(mockWebhookParams);
      expect(result).toEqual({ webhookId: 'test-webhook-id' });
      expect(fetch).toHaveBeenCalled();
    });

    it('should throw error for invalid webhook URL', async () => {
      await expect(heliusService.createWebhook({
        ...mockWebhookParams,
        webhookURL: 'invalid-url',
      })).rejects.toThrow('Invalid webhook URL');
    });

    it('should handle API errors', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: jest.fn().mockResolvedValue({ message: 'Invalid request' }),
      });

      await expect(heliusService.createWebhook(mockWebhookParams))
        .rejects.toThrow('Webhook creation failed');
    });
  });

  describe('handleWebhookData', () => {
    it('should process webhook data successfully', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      const result = await heliusService.handleWebhookData(
        'test-job-id',
        mockUserId,
        [mockTransaction]
      );

      expect(result.success).toBe(true);
      expect(result.transactionsProcessed).toBe(1);
      expect(result.errors).toBeUndefined();
    });

    it('should handle transaction processing errors', async () => {
      mockClient.query.mockRejectedValue(new Error('Database error'));

      const result = await heliusService.handleWebhookData(
        'test-job-id',
        mockUserId,
        [mockTransaction]
      );

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].signature).toBe(mockTransaction.signature);
    });

    it('should handle invalid transaction data', async () => {
      const invalidTransaction = {
        ...mockTransaction,
        timestamp: undefined,
      } as unknown as HeliusWebhookData;

      const result = await heliusService.handleWebhookData(
        'test-job-id',
        mockUserId,
        [invalidTransaction]
      );

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('setupIndexing', () => {
    const mockJob: IndexingJob = {
      id: 'test-job-id',
      userId: 'test-user-id',
      dbConnectionId: 'test-db-connection-id',
      category: 'blockchain',
      status: 'pending',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      config: {
        filters: {
          programIds: ['program1'],
          accounts: ['account1'],
          includeMints: true,
          includeMetadata: true,
          startSlot: 0,
        },
        webhook: {
          enabled: true,
          url: 'https://test.com/webhook',
          secret: 'test-secret',
        },
        categories: {
          transactions: true,
          nftEvents: true,
          tokenTransfers: true,
          programInteractions: true,
          accountActivity: false,
          defiTransactions: false,
          governance: false,
        },
      },
    };

    it('should setup indexing successfully', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await expect(heliusService.setupIndexing(mockJob, mockPool))
        .resolves.not.toThrow();

      expect(mockClient.query).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockClient.query.mockRejectedValue(new Error('Database error'));

      await expect(heliusService.setupIndexing(mockJob, mockPool))
        .rejects.toThrow('Failed to setup indexing');
    });
  });
}); 