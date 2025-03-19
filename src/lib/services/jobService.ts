import Bull, { Job } from 'bull';
import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { AppError } from '@/lib/utils/errorHandling';
import { IndexingJob, IndexingConfig } from '@/types';

const prisma = new PrismaClient();

type JobStatus = 'error' | 'pending' | 'active' | 'paused';

class JobService {
  public async getJobStatus(jobId: string, userId: string): Promise<JobStatus> {
    const job = await prisma.indexingJob.findFirst({
      where: { id: jobId, userId },
      select: { status: true }
    });
    
    if (!job) {
      throw new AppError('Job not found');
    }

    return job.status as JobStatus;
  }

  private static instance: JobService;
  private redis: Redis;
  private jobQueue: Bull.Queue;

  private constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.jobQueue = new Bull('indexing-jobs', {
      redis: process.env.REDIS_URL || 'redis://localhost:6379',
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
    this.setupQueueHandlers();
  }

  public static getInstance(): JobService {
    if (!JobService.instance) {
      JobService.instance = new JobService();
    }
    return JobService.instance;
  }

  private setupQueueHandlers(): void {
    this.jobQueue.on('error', (error: Error) => {
      console.error('Job queue error:', error);
    });

    this.jobQueue.on('failed', async (job: Job, error: Error) => {
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

  private determineJobType(config: IndexingConfig): string {
    const enabledCategories = Object.entries(config.categories)
      .filter(([_, enabled]) => enabled)
      .map(([category]) => category);

    return enabledCategories.length === 1 ? enabledCategories[0] : 'multiple';
  }

  public async createJob(
    userId: string,
    dbConnectionId: string,
    config: IndexingConfig
  ): Promise<IndexingJob> {
    try {
      const connection = await prisma.databaseConnection.findFirst({
        where: { id: dbConnectionId, userId },
      });

      if (!connection) {
        throw new AppError('Database connection not found');
      }

      const job = await prisma.indexingJob.create({
        data: {
          userId,
          dbConnectionId,
          type: this.determineJobType(config),
          status: 'pending' as JobStatus,
          config: config as any
        },
      });

      await this.jobQueue.add(
        'process-indexing',
        {
          jobId: job.id,
          config,
          dbConnectionId,
        },
        { jobId: job.id }
      );

      return {
        ...job,
        metadata: {},
        dbConnectionId,
        category: this.determineJobType(config),
        config,
        status: job.status as JobStatus
      };
    } catch (error) {
      throw new AppError('Failed to create job');
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
      category: this.determineJobType(job.config as unknown as IndexingConfig),
      config: job.config as unknown as IndexingConfig,
      status: job.status as JobStatus
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
      category: this.determineJobType(job.config as unknown as IndexingConfig),
      config: job.config as unknown as IndexingConfig,
      status: job.status as JobStatus
    }));
  }

  public async pauseJob(jobId: string, userId: string): Promise<IndexingJob> {
    // Verify job exists and belongs to user
    await this.getJob(jobId, userId);
    await this.jobQueue.pause();
    
    const updatedJob = await prisma.indexingJob.update({
      where: { id: jobId },
      data: { status: 'paused' },
    });

    return {
      ...updatedJob,
      metadata: {},
      dbConnectionId: '',
      category: this.determineJobType(updatedJob.config as unknown as IndexingConfig),
      config: updatedJob.config as unknown as IndexingConfig,
      status: updatedJob.status as JobStatus
    };
  }

  public async resumeJob(jobId: string, userId: string): Promise<IndexingJob> {
    // Verify job exists and belongs to user
    await this.getJob(jobId, userId);
    await this.jobQueue.resume();
    
    const updatedJob = await prisma.indexingJob.update({
      where: { id: jobId },
      data: { status: 'active' },
    });

    return {
      ...updatedJob,
      metadata: {},
      dbConnectionId: '',
      category: this.determineJobType(updatedJob.config as unknown as IndexingConfig),
      config: updatedJob.config as unknown as IndexingConfig,
      status: updatedJob.status as JobStatus
    };
  }

  public async cancelJob(jobId: string, userId: string): Promise<IndexingJob> {
    // Verify job exists and belongs to user
    await this.getJob(jobId, userId);
    await this.jobQueue.removeJobs(jobId);
    
    const updatedJob = await prisma.indexingJob.update({
      where: { id: jobId },
      data: { status: 'cancelled' },
    });

    return {
      ...updatedJob,
      metadata: {},
      dbConnectionId: '',
      category: this.determineJobType(updatedJob.config as unknown as IndexingConfig),
      config: updatedJob.config as unknown as IndexingConfig,
      status: updatedJob.status as JobStatus
    };
  }

  public async updateJobMetadata(
    jobId: string, 
    metadata: { webhookId: string; setupAt: string; }
  ): Promise<void> {
    await prisma.indexingJob.update({
      where: { id: jobId },
      data: { 
        config: {
          webhookId: metadata.webhookId,
          setupAt: metadata.setupAt
        }
      }
    });
  }

  public async cleanup(): Promise<void> {
    await this.jobQueue.close();
    await this.redis.quit();
  }
}

export default JobService; 