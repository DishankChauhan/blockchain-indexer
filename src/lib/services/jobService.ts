import { Queue } from 'bull';
import Redis from 'ioredis';
import prisma from '@/lib/db';
import { AppError } from '@/lib/utils/errorHandling';
import { IndexingJob, IndexingConfig } from '@/types';

// Initialize Redis client
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
import Bull from 'bull';

// Initialize Bull queue
const jobQueue = new Bull('indexing-jobs', process.env.REDIS_URL || 'redis://localhost:6379', {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: false,
    removeOnFail: false,
  },
});

export class JobService {
  updateJobMetadata(id: string, arg1: { webhookId: string; setupAt: string; }) {
    throw new Error('Method not implemented.');
  }
  private static instance: JobService;

  private constructor() {
    this.setupQueueHandlers();
  }

  public static getInstance(): JobService {
    if (!JobService.instance) {
      JobService.instance = new JobService();
    }
    return JobService.instance;
  }

  private setupQueueHandlers() {
    jobQueue.on('error', (error) => {
      console.error('Job queue error:', error);
    });

    jobQueue.on('failed', async (job, error) => {
      try {
        await prisma.indexingJob.update({
          where: { id: job.data.jobId },
          data: {
            status: 'error',
            config: {
              ...job.data.config,
              error: error.message,
              failedAt: new Date().toISOString()
            }
          }
        });
      } catch (dbError) {
        console.error('Failed to update job status:', dbError);
      }
    });
  }

  public async createJob(
    userId: string,
    dbConnectionId: string,
    config: IndexingConfig
  ): Promise<IndexingJob> {
    try {
      // Validate database connection
      const connection = await prisma.databaseConnection.findFirst({
        where: { id: dbConnectionId, userId },
      });
      if (!connection) {
        throw new AppError('Database connection not found');
      }

      // Create job record
      const job = await prisma.indexingJob.create({
        data: {
          userId,
          type: this.determineJobType(config),
          status: 'pending',
          config: config as any // Type assertion needed due to Json type in schema
        },
      });

      // Add job to queue
      await jobQueue.add(
        'process-indexing',
        {
          jobId: job.id,
          config,
          dbConnectionId,
        },
        {
          jobId: job.id,
        }
      );

      return {
        ...job,
        metadata: {},
        dbConnectionId,
        category: this.determineJobType(config)
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create indexing job');
    }
  }

  public async getJob(jobId: string, userId: string): Promise<IndexingJob> {
    const job = await prisma.indexingJob.findFirst({
      where: { id: jobId, userId },
    });
    
    if (!job) {
      throw new AppError('Job not found');
    }

    return {
      ...job,
      metadata: {},
      dbConnectionId: '',
      category: this.determineJobType(job.config as unknown as IndexingConfig)
    };
  }

  public async listJobs(userId: string): Promise<IndexingJob[]> {
    const jobs = await prisma.indexingJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return jobs.map(job => ({
      ...job,
      metadata: {},
      dbConnectionId: '',
      category: this.determineJobType(job.config as unknown as IndexingConfig)
    }));
  }

  public async pauseJob(jobId: string, userId: string): Promise<IndexingJob> {
    const job = await this.getJob(jobId, userId);
    await jobQueue.pause();
    
    const updatedJob = await prisma.indexingJob.update({
      where: { id: jobId },
      data: { status: 'paused' },
    });

    return {
      ...updatedJob,
      metadata: {},
      dbConnectionId: '',
      category: this.determineJobType(updatedJob.config as unknown as IndexingConfig)
    };
  }

  public async resumeJob(jobId: string, userId: string): Promise<IndexingJob> {
    const job = await this.getJob(jobId, userId);
    await jobQueue.resume();
    
    const updatedJob = await prisma.indexingJob.update({
      where: { id: jobId },
      data: { status: 'active' },
    });

    return {
      ...updatedJob,
      metadata: {},
      dbConnectionId: '',
      category: this.determineJobType(updatedJob.config as unknown as IndexingConfig)
    };
  }

  public async cancelJob(jobId: string, userId: string): Promise<IndexingJob> {
    const job = await this.getJob(jobId, userId);
    await jobQueue.removeJobs(jobId);
    
    const updatedJob = await prisma.indexingJob.update({
      where: { id: jobId },
      data: { status: 'cancelled' },
    });

    return {
      ...updatedJob,
      metadata: {},
      dbConnectionId: '',
      category: this.determineJobType(updatedJob.config as unknown as IndexingConfig)
    };
  }

  private determineJobType(config: IndexingConfig): string {
    const enabledCategories = Object.entries(config.categories)
      .filter(([_, enabled]) => enabled)
      .map(([category]) => category);

    return enabledCategories.length === 1
      ? enabledCategories[0]
      : 'multiple';
  }

  public async getJobStatus(jobId: string, userId: string): Promise<{
    status: string;
    progress?: number;
    error?: string;
  }> {
    const [job, queueJob] = await Promise.all([
      this.getJob(jobId, userId),
      jobQueue.getJob(jobId),
    ]);

    const progress = await queueJob?.progress();
    const config = job.config as IndexingConfig & { error?: string };

    return {
      status: job.status,
      progress: progress || 0,
      error: config.error
    };
  }

  public async cleanup(): Promise<void> {
    await jobQueue.close();
    await redis.quit();
  }
}