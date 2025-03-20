import { PrismaClient, Prisma } from '@prisma/client';
import { Queue, Worker } from 'bullmq';
import { AppError } from '../utils/errorHandling';
import { logError } from '../utils/serverLogger';
import { HeliusService } from './heliusService';
import { IndexingConfig } from '@/types';

export class JobService {
  private static instance: JobService | null = null;
  private readonly prisma: PrismaClient;
  private readonly jobQueue: Queue;
  private readonly worker: Worker;

  private constructor() {
    this.prisma = new PrismaClient();
    this.jobQueue = new Queue('indexing-jobs', {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      }
    });

    this.worker = new Worker('indexing-jobs', async (job) => {
      try {
        // Process job here
        await this.processJob(job);
      } catch (error) {
        logError('Job queue error', error as Error, {
          component: 'JobService',
          action: 'processJob',
          jobId: job.id
        });
        throw error;
      }
    });

    this.worker.on('failed', async (job, err) => {
      try {
        await this.prisma.indexingJob.update({
          where: { id: job.id },
          data: { status: 'failed' }
        });
      } catch (dbError) {
        logError('Failed to update job status', dbError as Error, {
          component: 'JobService',
          action: 'updateJobStatus',
          jobId: job.id
        });
      }
    });
  }

  public static getInstance(): JobService {
    if (!JobService.instance) {
      JobService.instance = new JobService();
    }
    return JobService.instance;
  }

  private async processJob(job: any): Promise<void> {
    // Implementation of job processing logic
  }

  public async createJob(userId: string, config: IndexingConfig): Promise<any> {
    try {
      const job = await this.prisma.indexingJob.create({
        data: {
          userId,
          config: config as unknown as Prisma.JsonValue,
          status: 'pending',
          type: config.type || 'default'
        }
      });

      await this.jobQueue.add('process-job', {
        jobId: job.id,
        userId,
        config
      });

      return job;
    } catch (error) {
      logError('Failed to create job', error as Error, {
        component: 'JobService',
        action: 'createJob',
        userId
      });
      throw new AppError('Failed to create job');
    }
  }

  public async cleanup(): Promise<void> {
    await this.jobQueue.close();
    await this.worker.close();
    await this.prisma.$disconnect();
    JobService.instance = null;
  }
} 