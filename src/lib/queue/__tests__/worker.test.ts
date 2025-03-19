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
    it('should process webhook job successfully', async () => {
      const result = await processWebhookJob(mockJob as Job);

      expect(result).toEqual({
        success: true,
        transactionsProcessed: 1,
      });

      expect(HeliusService.getInstance).toHaveBeenCalledWith(mockJob.data.userId);
      expect(AppLogger.info).toHaveBeenCalledWith(
        'Processing webhook job',
        expect.objectContaining({
          component: 'Worker',
          action: 'ProcessWebhookJob',
          jobId: mockJob.id,
        })
      );
    });

    it('should handle processing errors', async () => {
      const error = new Error('Processing failed');
      (HeliusService.getInstance as jest.Mock).mockReturnValue({
        handleWebhookData: jest.fn().mockRejectedValue(error),
      });

      await expect(processWebhookJob(mockJob as Job)).rejects.toThrow(error);

      expect(AppLogger.error).toHaveBeenCalledWith(
        'Failed to process webhook job',
        error,
        expect.objectContaining({
          component: 'Worker',
          action: 'ProcessWebhookJob',
          jobId: mockJob.id,
        })
      );
    });

    it('should handle partial success with errors', async () => {
      (HeliusService.getInstance as jest.Mock).mockReturnValue({
        handleWebhookData: jest.fn().mockResolvedValue({
          success: false,
          transactionsProcessed: 0,
          errors: [{
            signature: 'test-signature',
            error: 'Failed to process transaction',
          }],
        }),
      });

      const result = await processWebhookJob(mockJob as Job);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(AppLogger.warn).toHaveBeenCalledWith(
        'Webhook processing completed with errors',
        expect.objectContaining({
          component: 'Worker',
          action: 'ProcessWebhookJob',
          jobId: mockJob.id,
        })
      );
    });

    it('should validate job data', async () => {
      const invalidJob = {
        ...mockJob,
        data: {},
      };

      await expect(processWebhookJob(invalidJob as Job)).rejects.toThrow();
    });
  });
}); 