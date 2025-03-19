import { JobService } from '../jobService';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import Bull from 'bull';
import { jest } from '@jest/globals';
import { IndexingConfig, IndexingJob, DatabaseConnection } from '@/types';
import { AppError } from '@/lib/utils/errorHandling';

// Mock Redis
class MockRedis {
  disconnect = jest.fn();
  on = jest.fn();
  once = jest.fn();
  removeListener = jest.fn();
  constructor() {
    return this;
  }
}

// Mock Bull
jest.mock('bull');

// Mock Redis
jest.mock('ioredis', () => {
  return {
    Redis: jest.fn().mockImplementation(() => new MockRedis()),
  };
});

// Create mock data
const mockIndexingJob: IndexingJob = {
  id: 'test-job-id',
  status: 'pending',
  userId: 'test-user-id',
  dbConnectionId: 'test-db-connection',
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
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockDatabaseConnection: DatabaseConnection = {
  id: 'test-db-connection',
  userId: 'test-user-id',
  host: 'localhost',
  port: 5432,
  database: 'test_db',
  username: 'test_user',
  password: 'test_pass',
  status: 'active',
  lastConnectedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock PrismaClient
const mockPrisma = {
  indexingJob: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  databaseConnection: {
    findFirst: jest.fn(),
  },
  $disconnect: jest.fn(),
};

// Setup mock implementations
mockPrisma.indexingJob.findFirst.mockResolvedValue(mockIndexingJob);
mockPrisma.indexingJob.create.mockResolvedValue(mockIndexingJob);
mockPrisma.indexingJob.update.mockResolvedValue(mockIndexingJob);
mockPrisma.databaseConnection.findFirst.mockResolvedValue(mockDatabaseConnection);

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

describe('JobService', () => {
  let jobService: JobService;
  const mockConfig = mockIndexingJob.config;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset JobService instance
    (JobService as any).instance = null;
    
    // Setup default mock implementations
    mockPrisma.indexingJob.findFirst.mockResolvedValue(mockIndexingJob);
    mockPrisma.databaseConnection.findFirst.mockResolvedValue(mockDatabaseConnection);
    
    // Get JobService instance
    jobService = JobService.getInstance();
  });

  describe('getInstance', () => {
    it('should create a singleton instance', () => {
      const instance1 = JobService.getInstance();
      const instance2 = JobService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getJobStatus', () => {
    it('should return job status if found', async () => {
      mockPrisma.indexingJob.findFirst.mockResolvedValueOnce(mockIndexingJob);

      const status = await jobService.getJobStatus('test-job-id', 'test-user-id');
      expect(status).toBe('pending');
      expect(mockPrisma.indexingJob.findFirst).toHaveBeenCalledWith({
        where: { id: 'test-job-id', userId: 'test-user-id' },
        select: { status: true },
      });
    });

    it('should throw error if job not found', async () => {
      mockPrisma.indexingJob.findFirst.mockResolvedValueOnce(null);

      await expect(jobService.getJobStatus('non-existent-id', 'test-user-id'))
        .rejects
        .toThrow('Job not found');
    });
  });

  describe('job control operations', () => {
    it('should pause job', async () => {
      mockPrisma.indexingJob.findFirst.mockResolvedValueOnce({
        ...mockIndexingJob,
        status: 'active',
      });

      await jobService.pauseJob('test-job-id', 'test-user-id');
      expect(mockPrisma.indexingJob.update).toHaveBeenCalledWith({
        where: { id: 'test-job-id' },
        data: { status: 'paused' },
      });
    });

    it('should resume job', async () => {
      mockPrisma.indexingJob.findFirst.mockResolvedValueOnce({
        ...mockIndexingJob,
        status: 'paused',
      });

      await jobService.resumeJob('test-job-id', 'test-user-id');
      expect(mockPrisma.indexingJob.update).toHaveBeenCalledWith({
        where: { id: 'test-job-id' },
        data: { status: 'active' },
      });
    });

    it('should cancel job', async () => {
      mockPrisma.indexingJob.findFirst.mockResolvedValueOnce({
        ...mockIndexingJob,
        status: 'active',
      });

      await jobService.cancelJob('test-job-id', 'test-user-id');
      expect(mockPrisma.indexingJob.update).toHaveBeenCalledWith({
        where: { id: 'test-job-id' },
        data: { status: 'error' },
      });
    });
  });

  describe('createJob', () => {
    it('should create a job successfully', async () => {
      mockPrisma.databaseConnection.findFirst.mockResolvedValueOnce(mockDatabaseConnection);
      mockPrisma.indexingJob.create.mockResolvedValueOnce(mockIndexingJob);

      const job = await jobService.createJob(
        'test-user-id',
        'test-db-connection',
        mockConfig
      );

      expect(job).toEqual(mockIndexingJob);
    });

    it('should throw error if database connection not found', async () => {
      mockPrisma.databaseConnection.findFirst.mockResolvedValueOnce(null);

      await expect(jobService.createJob(
        'test-user-id',
        'test-db-connection',
        mockConfig
      )).rejects.toThrow('Database connection not found');
    });
  });
}); 