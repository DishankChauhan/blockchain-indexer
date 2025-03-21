import Bull from 'bull';
import { DatabaseService } from '../../services/databaseService';
import { HeliusService } from '../../services/heliusService';
import AppLogger from '../../utils/logger';
import { processWebhookJob } from '../worker';
import { Job } from 'bull';

// Mock dependencies
jest.mock('bull');
jest.mock('../../services/databaseService');
jest.mock('../../services/heliusService');
jest.mock('../../utils/logger');

describe('Worker Queue', () => {
  let mockJob: Partial<Job>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Initialize mock job
    mockJob = {
      id: 'test-job-id',
      data: {
        webhookId: 'test-webhook-id',
        userId: 'test-user-id',
        payload: {
          signature: 'test-signature',
          type: 'NFT_SALE',
          timestamp: Date.now(),
        },
      },
    };

    // Mock HeliusService
    (HeliusService.getInstance as jest.Mock).mockReturnValue({
      handleWebhookData: jest.fn().mockResolvedValue({
        success: true,
        transactionsProcessed: 1,
      }),
    });
  });

  describe('processWebhookJob', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should process webhook data successfully', async () => {
      const mockJob = {
        data: {
          webhookId: 'test-webhook-id',
          userId: 'test-user-id',
          payload: {
            signature: 'test-signature',
            timestamp: Date.now(),
          },
        },
      } as Job;

      (HeliusService.getInstance as jest.Mock).mockReturnValue({
        handleWebhookData: jest.fn().mockResolvedValue({
          success: true,
          transactionsProcessed: 1,
        }),
      });

      const result = await processWebhookJob(mockJob);
      expect(result.success).toBe(true);
      expect(result.transactionsProcessed).toBe(1);
    });

    it('should handle webhook processing errors', async () => {
      const mockJob = {
        data: {
          webhookId: 'test-webhook-id',
          userId: 'test-user-id',
          payload: {
            signature: 'test-signature',
            timestamp: Date.now(),
          },
        },
      } as Job;

      const mockError = new Error('Processing failed');
      (HeliusService.getInstance as jest.Mock).mockReturnValue({
        handleWebhookData: jest.fn().mockRejectedValue(mockError),
      });

      await expect(processWebhookJob(mockJob)).rejects.toThrow('Processing failed');
    });

    it('should validate job data', async () => {
      const invalidJob = {
        data: {
          // Missing required fields
        },
      } as Job;

      await expect(processWebhookJob(invalidJob)).rejects.toThrow('Invalid job data');
    });
  });
}); 