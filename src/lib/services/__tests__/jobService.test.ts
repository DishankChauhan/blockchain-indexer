import { JobService } from '../jobService';
import { PrismaClient, IndexingJob } from '@prisma/client';
import IORedis from 'ioredis';
import { Queue } from 'bullmq';
import { jest, expect, describe, it, beforeEach, afterEach } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { IndexingConfig, DatabaseConnection } from '@/types';
import { AppError } from '@/lib/utils/errorHandling';
import AppLogger from '../../utils/logger';
import { JsonValue } from '@prisma/client/runtime/library';

// Define types for BullMQ Queue methods
type QueueAdd = (name: string, data: any, options?: any) => Promise<{ id: string }>;
type QueuePause = () => Promise<void>;
type QueueResume = () => Promise<void>;
type QueueClose = () => Promise<void>;
type QueueRemoveJobs = (jobId: string) => Promise<void>;
type QueueOn = (event: string, callback: (job: any, ...args: any[]) => void) => void;

// Mock BullMQ Queue with proper types
type MockQueueMethods = Pick<Queue, 'add' | 'pause' | 'resume' | 'close' | 'removeJobs' | 'on'>;

const mockQueue: jest.Mocked<MockQueueMethods> = {
  add: jest.fn().mockImplementation((name: string, data: any) => Promise.resolve({
    id: 'test-job-id',
    data: data as JsonValue,
    remove: jest.fn().mockResolvedValue(undefined)
  })),
  pause: jest.fn().mockResolvedValue(undefined),
  resume: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  removeJobs: jest.fn().mockResolvedValue(undefined),
  on: jest.fn()
};

jest.mock('bullmq', () => {
  return {
    Queue: jest.fn().mockImplementation(() => ({
      add: jest.fn().mockResolvedValue({ id: 'test-job-id' }),
      pause: jest.fn(),
      resume: jest.fn(),
      close: jest.fn(),
      removeJobs: jest.fn(),
      on: jest.fn(),
      getJob: jest.fn().mockImplementation((jobId) => {
        if (jobId === 'job_01H9X7K2N8Z5Y') {
          return Promise.resolve({
            id: jobId,
            data: { status: 'completed' },
            remove: jest.fn()
          });
        }
        return Promise.resolve({
          id: jobId,
          data: { status: 'active' },
          remove: jest.fn()
        });
      })
    }))
  };
});

// Mock Redis
type RedisQuit = () => Promise<void>;
type RedisDisconnect = () => Promise<void>;
type RedisOn = (event: string, callback: () => void) => IORedis;
type RedisOnce = (event: string, callback: () => void) => IORedis;
type RedisRemoveListener = (event: string, callback: () => void) => IORedis;

const mockRedis = {
  quit: jest.fn<RedisQuit>().mockResolvedValue(),
  disconnect: jest.fn<RedisDisconnect>().mockResolvedValue(),
  on: jest.fn<RedisOn>().mockReturnThis(),
  once: jest.fn<RedisOnce>().mockReturnThis(),
  removeListener: jest.fn<RedisRemoveListener>().mockReturnThis(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

// Create mock data with realistic test values
const mockIndexingJob: IndexingJob = {
  id: 'job_01H9X7K2N8Z5Y',  // Using ULID format for IDs
  status: 'pending',
  type: 'transactions',
  progress: 0,
  userId: 'user_01H9X7K2N8Z5Y',
  dbConnectionId: 'db_01H9X7K2N8Z5Y',
  config: {
    type: 'transactions',
    filters: {
      accounts: ['account1'],
    },
    webhook: {
      enabled: true,
      url: 'https://test.com/webhook',
    },
    categories: {
      transactions: true,
      nftEvents: false,
      tokenTransfers: false,
      programInteractions: false,
    },
  },
  createdAt: new Date('2024-03-15T10:00:00Z'),  // Using fixed dates for predictable testing
  updatedAt: new Date('2024-03-15T10:00:00Z'),
};

const mockDatabaseConnection: DatabaseConnection = {
  id: 'db_01H9X7K2N8Z5Y',
  userId: 'user_01H9X7K2N8Z5Y',
  name: 'Test DB',
  host: 'localhost',
  port: 5432,
  database: 'test_db',
  username: 'test_user',
  password: 'test_pass',
  createdAt: new Date(),
  updatedAt: new Date()
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
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

describe('JobService', () => {
  let jobService: JobService;
  let mockPrisma: jest.Mocked<PrismaClient>;
  const mockConfig = mockIndexingJob.config;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Reset JobService instance
    (JobService as any).instance = null;
    
    mockPrisma = {
      databaseConnection: {
        findFirst: jest.fn(),
      },
      indexingJob: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaClient>;

    (PrismaClient as jest.Mock).mockImplementation(() => mockPrisma);

    // Get JobService instance
    jobService = JobService.getInstance();
  });

  afterEach(async () => {
    await jobService.cleanup();
    jest.clearAllMocks();
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
      const { userId, dbConnectionId } = mockDatabaseConnection;

      mockPrisma.databaseConnection.findFirst.mockResolvedValue(mockDatabaseConnection);
      mockPrisma.indexingJob.create.mockResolvedValue(mockIndexingJob);

      await jobService.createJob(userId, dbConnectionId, mockConfig);

      expect(mockPrisma.databaseConnection.findFirst).toHaveBeenCalledWith({
        where: { id: dbConnectionId, userId },
      });

      expect(mockPrisma.indexingJob.create).toHaveBeenCalledWith({
        data: {
          userId,
          dbConnectionId,
          type: 'transactions',
          status: 'pending',
          config: mockConfig,
        },
      });
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