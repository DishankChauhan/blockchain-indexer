import { JobService } from '../jobService';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import Bull from 'bull';
import { jest, expect, describe, it, beforeEach } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { IndexingConfig, IndexingJob, DatabaseConnection } from '@/types';
import { AppError } from '@/lib/utils/errorHandling';

// Define types for Bull Queue methods
type QueueAdd = (data: any, options?: any) => Promise<{ id: string }>;
type QueuePause = () => Promise<void>;
type QueueResume = () => Promise<void>;
type QueueClose = () => Promise<void>;
type QueueRemoveJobs = (jobId: string) => Promise<void>;
type QueueOn = (event: string, callback: (job: any, ...args: any[]) => void) => void;

// Mock Bull Queue with proper types
const mockQueue = {
  add: jest.fn<QueueAdd>().mockResolvedValue({ id: 'test-job' }),
  pause: jest.fn<QueuePause>().mockResolvedValue(),
  resume: jest.fn<QueueResume>().mockResolvedValue(),
  close: jest.fn<QueueClose>().mockResolvedValue(),
  removeJobs: jest.fn<QueueRemoveJobs>().mockResolvedValue(),
  on: jest.fn<QueueOn>().mockImplementation((event, callback) => {
    // Store the callback for testing if needed
    return mockQueue;
  }),
};

jest.mock('bull', () => {
  return jest.fn().mockImplementation(() => mockQueue);
});

// Mock Redis with event handlers
class MockRedis {
  disconnect = jest.fn();
  on = jest.fn().mockReturnThis();
  once = jest.fn().mockReturnThis();
  removeListener = jest.fn().mockReturnThis();
  constructor() {
    return this;
  }
}

// Mock Redis
jest.mock('ioredis', () => {
  return {
    Redis: jest.fn().mockImplementation(() => new MockRedis()),
  };
});

// Create mock data with realistic test values
const mockIndexingJob: IndexingJob = {
  id: 'job_01H9X7K2N8Z5Y',  // Using ULID format for IDs
  status: 'pending' as const,  // Using const assertion to ensure correct type
  userId: 'user_01H9X7K2N8Z5Y',
  dbConnectionId: 'db_01H9X7K2N8Z5Y',
  category: 'transactions',
  metadata: {},
  config: {
    categories: {
      transactions: true,
      tokenTransfers: false,
      nftEvents: false,
      defiTransactions: false,
      accountActivity: false,
      programInteractions: false,
      governance: false,
    },
    filters: {
      includeMetadata: false,
      includeMints: false,
    },
    webhook: {
      enabled: false,
    },
  },
  createdAt: new Date('2024-03-15T10:00:00Z'),  // Using fixed dates for predictable testing
  updatedAt: new Date('2024-03-15T10:00:00Z'),
};

const mockDatabaseConnection: DatabaseConnection = {
  id: 'db_01H9X7K2N8Z5Y',
  userId: 'user_01H9X7K2N8Z5Y',
  host: 'test-db.example.com',
  port: 5432,
  database: 'blockchain_index',
  username: 'test_user',
  password: 'test_password_hash',  // In real tests, use a consistent hash
  status: 'active',
  lastConnectedAt: new Date('2024-03-15T10:00:00Z'),
  createdAt: new Date('2024-03-15T10:00:00Z'),
  updatedAt: new Date('2024-03-15T10:00:00Z'),
};

// Define types for Prisma methods
type IndexingJobFindFirst = (args: any) => Promise<IndexingJob | null>;
type IndexingJobCreate = (args: any) => Promise<IndexingJob>;
type IndexingJobUpdate = (args: any) => Promise<IndexingJob>;
type DatabaseConnectionFindFirst = (args: any) => Promise<DatabaseConnection | null>;

// Mock PrismaClient with proper typing
const mockPrisma = {
  indexingJob: {
    findFirst: jest.fn<IndexingJobFindFirst>().mockResolvedValue(mockIndexingJob),
    create: jest.fn<IndexingJobCreate>().mockResolvedValue(mockIndexingJob),
    update: jest.fn<IndexingJobUpdate>().mockResolvedValue(mockIndexingJob),
  },
  databaseConnection: {
    findFirst: jest.fn<DatabaseConnectionFindFirst>().mockResolvedValue(mockDatabaseConnection),
  },
  $disconnect: jest.fn(),
};

// Mock PrismaClient constructor
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

describe('JobService', () => {
  let jobService: JobService;
  const mockConfig = mockIndexingJob.config;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Reset JobService instance
    (JobService as any).instance = null;
    
    // Get JobService instance
    jobService = JobService.getInstance();
  });

  describe('getInstance', () => {
    it('should create a singleton instance', () => {
      const instance1 = JobService.getInstance();
      const instance2 = JobService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should initialize with default configuration', () => {
      const instance = JobService.getInstance();
      expect(instance).toBeInstanceOf(JobService);
      // Add more specific assertions about the instance configuration
    });
  });

  describe('getJobStatus', () => {
    it('should return job status if found', async () => {
      const jobId = 'job_01H9X7K2N8Z5Y';
      const userId = 'user_01H9X7K2N8Z5Y';

      mockPrisma.indexingJob.findFirst.mockResolvedValueOnce(mockIndexingJob);

      const status = await jobService.getJobStatus(jobId, userId);
      
      expect(status).toBe('pending');
      expect(mockPrisma.indexingJob.findFirst).toHaveBeenCalledWith({
        where: { id: jobId, userId },
        select: { status: true },
      });
      expect(mockPrisma.indexingJob.findFirst).toHaveBeenCalledTimes(1);
    });

    it('should throw error if job not found', async () => {
      const jobId = 'non_existent_job';
      const userId = 'user_01H9X7K2N8Z5Y';

      mockPrisma.indexingJob.findFirst.mockResolvedValueOnce(null);

      await expect(jobService.getJobStatus(jobId, userId))
        .rejects
        .toThrow(new AppError('Job not found'));
      
      expect(mockPrisma.indexingJob.findFirst).toHaveBeenCalledWith({
        where: { id: jobId, userId },
        select: { status: true },
      });
      expect(mockPrisma.indexingJob.findFirst).toHaveBeenCalledTimes(1);
    });
  });

  describe('job control operations', () => {
    describe('pauseJob', () => {
      it('should pause an active job', async () => {
        const activeJob = { ...mockIndexingJob, status: 'active' as const };
        mockPrisma.indexingJob.findFirst.mockResolvedValueOnce(activeJob);
        mockPrisma.indexingJob.update.mockResolvedValueOnce({ ...activeJob, status: 'paused' as const });

        await jobService.pauseJob('job_01H9X7K2N8Z5Y', 'user_01H9X7K2N8Z5Y');

        expect(mockPrisma.indexingJob.update).toHaveBeenCalledWith({
          where: { id: 'job_01H9X7K2N8Z5Y' },
          data: { status: 'paused' },
        });
        expect(mockQueue.pause).toHaveBeenCalled();
      });

      it('should throw error when trying to pause a non-active job', async () => {
        const pausedJob = { ...mockIndexingJob, status: 'paused' as const };
        mockPrisma.indexingJob.findFirst.mockResolvedValueOnce(pausedJob);

        await expect(jobService.pauseJob('job_01H9X7K2N8Z5Y', 'user_01H9X7K2N8Z5Y'))
          .rejects
          .toThrow(new AppError('Job is not active'));
      });
    });

    describe('resumeJob', () => {
      it('should resume a paused job', async () => {
        const pausedJob = { ...mockIndexingJob, status: 'paused' as const };
        mockPrisma.indexingJob.findFirst.mockResolvedValueOnce(pausedJob);
        mockPrisma.indexingJob.update.mockResolvedValueOnce({ ...pausedJob, status: 'active' as const });

        await jobService.resumeJob('job_01H9X7K2N8Z5Y', 'user_01H9X7K2N8Z5Y');

        expect(mockPrisma.indexingJob.update).toHaveBeenCalledWith({
          where: { id: 'job_01H9X7K2N8Z5Y' },
          data: { status: 'active' },
        });
        expect(mockQueue.resume).toHaveBeenCalled();
      });

      it('should throw error when trying to resume a non-paused job', async () => {
        const activeJob = { ...mockIndexingJob, status: 'active' as const };
        mockPrisma.indexingJob.findFirst.mockResolvedValueOnce(activeJob);

        await expect(jobService.resumeJob('job_01H9X7K2N8Z5Y', 'user_01H9X7K2N8Z5Y'))
          .rejects
          .toThrow(new AppError('Job is not paused'));
      });
    });

    describe('cancelJob', () => {
      it('should cancel an active job', async () => {
        const activeJob = { ...mockIndexingJob, status: 'active' as const };
        mockPrisma.indexingJob.findFirst.mockResolvedValueOnce(activeJob);
        mockPrisma.indexingJob.update.mockResolvedValueOnce({ ...activeJob, status: 'error' as const });

        await jobService.cancelJob('job_01H9X7K2N8Z5Y', 'user_01H9X7K2N8Z5Y');

        expect(mockPrisma.indexingJob.update).toHaveBeenCalledWith({
          where: { id: 'job_01H9X7K2N8Z5Y' },
          data: { status: 'error' },
        });
        expect(mockQueue.close).toHaveBeenCalled();
      });

      it('should throw error when trying to cancel a completed job', async () => {
        const completedJob = { ...mockIndexingJob, status: 'error' as const };
        mockPrisma.indexingJob.findFirst.mockResolvedValueOnce(completedJob);

        await expect(jobService.cancelJob('job_01H9X7K2N8Z5Y', 'user_01H9X7K2N8Z5Y'))
          .rejects
          .toThrow(new AppError('Job is already cancelled or completed'));
      });
    });
  });

  describe('createJob', () => {
    it('should create a job successfully', async () => {
      const userId = 'user_01H9X7K2N8Z5Y';
      const dbConnectionId = 'db_01H9X7K2N8Z5Y';

      mockPrisma.databaseConnection.findFirst.mockResolvedValueOnce(mockDatabaseConnection);
      mockPrisma.indexingJob.create.mockResolvedValueOnce(mockIndexingJob);

      const job = await jobService.createJob(userId, dbConnectionId, mockConfig);

      expect(mockPrisma.databaseConnection.findFirst).toHaveBeenCalledWith({
        where: { id: dbConnectionId, userId },
      });
      expect(mockPrisma.indexingJob.create).toHaveBeenCalledWith({
        data: {
          userId,
          dbConnectionId,
          type: 'transactions',
          status: 'pending',
          config: mockConfig
        },
      });
      expect(job).toEqual(mockIndexingJob);
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it('should throw error if database connection not found', async () => {
      const userId = 'user_01H9X7K2N8Z5Y';
      const dbConnectionId = 'non_existent_db';

      mockPrisma.databaseConnection.findFirst.mockResolvedValueOnce(null);

      await expect(jobService.createJob(userId, dbConnectionId, mockConfig))
        .rejects
        .toThrow(new AppError('Database connection not found'));
      
      expect(mockPrisma.databaseConnection.findFirst).toHaveBeenCalledWith({
        where: { id: dbConnectionId, userId },
      });
      expect(mockPrisma.indexingJob.create).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should throw error if job creation fails', async () => {
      const userId = 'user_01H9X7K2N8Z5Y';
      const dbConnectionId = 'db_01H9X7K2N8Z5Y';

      mockPrisma.databaseConnection.findFirst.mockResolvedValueOnce(mockDatabaseConnection);
      mockPrisma.indexingJob.create.mockRejectedValueOnce(new Error('Database error'));

      await expect(jobService.createJob(userId, dbConnectionId, mockConfig))
        .rejects
        .toThrow('Database error');
      
      expect(mockPrisma.databaseConnection.findFirst).toHaveBeenCalledWith({
        where: { id: dbConnectionId, userId },
      });
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });
}); 