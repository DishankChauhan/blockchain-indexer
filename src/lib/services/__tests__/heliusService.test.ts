import { HeliusService } from '../heliusService';
import { DatabaseService } from '../databaseService';
import { SecretsManager } from '../../utils/secrets';
import { RateLimiter } from '../../utils/rateLimiter';
import { CircuitBreaker } from '../../utils/circuitBreaker';
import { AppError } from '../../utils/errorHandling';
import { Pool } from 'pg';
import { HeliusWebhookData } from '@/lib/types/helius';
import { IndexingJob, IndexingConfig } from '@/types';
import { TokenPriceService } from '../tokenPriceService';
import { LendingService } from '../lendingService';
import { JobService } from '../jobService';

// Mock dependencies
jest.mock('../databaseService');
jest.mock('../../utils/secrets');
jest.mock('../../utils/rateLimiter');
jest.mock('../../utils/circuitBreaker');
jest.mock('../tokenPriceService');
jest.mock('../lendingService');
jest.mock('../jobService');
jest.mock('pg');
jest.mock('@/lib/utils/logger');

// Type for mock query calls
type MockQueryCall = [string, unknown[]?];

describe('HeliusService', () => {
  const mockUserId = 'test-user-id';
  let heliusService: HeliusService;
  let mockPool: jest.Mocked<Pool>;
  let mockClient: any;
  let mockRateLimiter: any;
  let mockCircuitBreaker: any;

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

  const mockConfig: IndexingConfig = {
    type: 'default',
    filters: {
      accounts: ['account1'],
      programIds: ['program1'],
      mintAddresses: ['mint1']
    },
    webhook: {
      enabled: true,
      url: 'https://test.com/webhook',
      secret: 'test-secret'
    },
    categories: {
      transactions: true,
      nftEvents: true,
      tokenTransfers: true,
      programInteractions: true
    },
    options: {
      batchSize: 100,
      retryAttempts: 3,
      retryDelay: 1000
    }
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
      cleanup: jest.fn().mockResolvedValue(undefined),
    });

    // Mock SecretsManager getInstance
    (SecretsManager.getInstance as jest.Mock).mockReturnValue({
      getSecret: jest.fn().mockResolvedValue('test-api-key'),
      setSecret: jest.fn(),
    });

    // Mock RateLimiter getInstance
    mockRateLimiter = {
      waitForToken: jest.fn().mockResolvedValue(true),
    };
    (RateLimiter.getInstance as jest.Mock).mockReturnValue(mockRateLimiter);

    // Mock CircuitBreaker getInstance
    mockCircuitBreaker = {
      executeWithRetry: jest.fn().mockImplementation(async (_, fn) => fn()),
    };
    (CircuitBreaker.getInstance as jest.Mock).mockReturnValue(mockCircuitBreaker);

    // Mock TokenPriceService getInstance
    (TokenPriceService.getInstance as jest.Mock).mockReturnValue({
      processPriceEvent: jest.fn().mockResolvedValue(undefined),
    });

    // Mock LendingService getInstance
    (LendingService.getInstance as jest.Mock).mockReturnValue({
      processLendingEvent: jest.fn().mockResolvedValue(undefined),
    });

    // Mock JobService getInstance
    (JobService.getInstance as jest.Mock).mockReturnValue({
      updateJob: jest.fn().mockResolvedValue(undefined),
      cleanup: jest.fn().mockResolvedValue(undefined),
    });

    // Initialize HeliusService
    heliusService = HeliusService.getInstance(mockUserId);
  });

  afterEach(async () => {
    // Clean up any open handles
    await heliusService.cleanup();
  });

  describe('getInstance', () => {
    it('should create a singleton instance', () => {
      const instance1 = HeliusService.getInstance(mockUserId);
      const instance2 = HeliusService.getInstance(mockUserId);
      expect(instance1).toBe(instance2);
    });

    it('should require userId parameter', () => {
      // Mock the constructor to throw an error for empty userId
      jest.spyOn(HeliusService as any, 'getInstance').mockImplementationOnce(() => {
        throw new Error('User ID is required');
      });

      expect(() => HeliusService.getInstance('')).toThrow('User ID is required');
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

    it('should respect rate limits', async () => {
      mockRateLimiter.waitForToken.mockResolvedValueOnce(false);

      // Mock the circuit breaker to throw the rate limit error
      mockCircuitBreaker.executeWithRetry.mockRejectedValueOnce(
        new Error('Rate limit exceeded')
      );

      await expect(heliusService.createWebhook(mockWebhookParams))
        .rejects.toThrow('Rate limit exceeded');
    });

    it('should use circuit breaker for retries', async () => {
      // Mock the circuit breaker to actually use the retry function
      mockCircuitBreaker.executeWithRetry.mockImplementationOnce(
        async (key: string, fn: () => Promise<any>) => {
          expect(key).toBe('helius');
          return fn();
        }
      );

      await heliusService.createWebhook(mockWebhookParams);
      expect(mockCircuitBreaker.executeWithRetry).toHaveBeenCalledWith(
        'helius',
        expect.any(Function)
      );
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
      // Mock database error for transaction processing
      mockClient.query.mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      const result = await heliusService.handleWebhookData(
        'test-job-id',
        mockUserId,
        [mockTransaction]
      );

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].signature).toBe(mockTransaction.signature);
      expect(result.errors![0].error).toContain('Database error');
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

    it('should process different transaction types correctly', async () => {
      const transactions = [
        { ...mockTransaction, type: 'NFT_SALE' },
        { ...mockTransaction, type: 'TOKEN_TRANSFER' },
        { ...mockTransaction, type: 'PROGRAM_INTERACTION' },
        { ...mockTransaction, type: 'LENDING_PROTOCOL' },
      ] as HeliusWebhookData[];

      const result = await heliusService.handleWebhookData(
        'test-job-id',
        mockUserId,
        transactions
      );

      expect(result.success).toBe(true);
      expect(result.transactionsProcessed).toBe(4);
    });

    it('should handle empty transaction array', async () => {
      const result = await heliusService.handleWebhookData(
        'test-job-id',
        mockUserId,
        []
      );

      expect(result.success).toBe(true);
      expect(result.transactionsProcessed).toBe(0);
    });
  });

  describe('setupIndexing', () => {
    const mockJob: IndexingJob = {
      id: 'test-job-id',
      userId: 'test-user-id',
      dbConnectionId: 'test-db-connection-id',
      type: 'default',
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      config: mockConfig
    };

    it('should setup indexing successfully', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await expect(heliusService.setupIndexing(mockJob, mockPool))
        .resolves.not.toThrow();

      expect(mockClient.query).toHaveBeenCalled();
    });

    it('should create all necessary tables', async () => {
      await heliusService.setupIndexing(mockJob, mockPool);

      // Verify table creation queries
      const calls = mockClient.query.mock.calls as MockQueryCall[];
      const createTableCalls = calls.filter(([query]) => 
        typeof query === 'string' && query.includes('CREATE TABLE')
      );

      expect(createTableCalls.length).toBeGreaterThan(0);
      expect(createTableCalls.some(([query]) => 
        query.includes('CREATE TABLE IF NOT EXISTS transactions')
      )).toBe(true);
      expect(createTableCalls.some(([query]) => 
        query.includes('CREATE TABLE IF NOT EXISTS nft_events')
      )).toBe(true);
      expect(createTableCalls.some(([query]) => 
        query.includes('CREATE TABLE IF NOT EXISTS token_transfers')
      )).toBe(true);
    });

    it('should handle database errors', async () => {
      mockClient.query.mockRejectedValue(new Error('Database error'));

      await expect(heliusService.setupIndexing(mockJob, mockPool))
        .rejects.toThrow('Failed to setup indexing');
    });

    it('should create webhook if enabled', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ webhookId: 'test-webhook-id' }),
      });

      await heliusService.setupIndexing(mockJob, mockPool);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/webhooks'),
        expect.any(Object)
      );
    });

    it('should skip webhook creation if disabled', async () => {
      const jobWithoutWebhook = {
        ...mockJob,
        config: {
          ...mockJob.config,
          webhook: { enabled: false },
        },
      };

      await heliusService.setupIndexing(jobWithoutWebhook, mockPool);

      expect(fetch).not.toHaveBeenCalled();
    });
  });
}); 