import { Queue } from 'bullmq';
import { PrismaClient, IndexingJob, Prisma } from '@prisma/client';
import { AppError } from '../utils/errorHandling';
import { IndexingConfig } from '@/types';
import AppLogger from '../utils/logger';

export class JobService {
  private static instance: JobService;
  private prisma: PrismaClient;
  private jobQueue: Queue;

  private constructor() {
    this.prisma = new PrismaClient();
    this.jobQueue = new Queue('indexing-jobs', {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      }
    });
  }

  public static getInstance(): JobService {
    if (!JobService.instance) {
      JobService.instance = new JobService();
    }
    return JobService.instance;
  }

  public async createJob(userId: string, dbConnectionId: string, config: IndexingConfig): Promise<IndexingJob> {
    try {
      // Check if database connection exists
      const dbConnection = await this.prisma.databaseConnection.findFirst({
        where: { id: dbConnectionId, userId },
      });

      if (!dbConnection) {
        throw new AppError('Database connection not found');
      }

      // Create job in database
      const job = await this.prisma.indexingJob.create({
        data: {
          userId,
          dbConnectionId,
          config: config as unknown as Prisma.InputJsonValue,
          status: 'created',
          type: config.type,
          progress: 0,
        },
      });

      // Add job to queue
      await this.jobQueue.add(job.id, {
        jobId: job.id,
        userId,
        config,
      });

      return job;
    } catch (error) {
      AppLogger.error('Failed to create job', error as Error);
      throw new AppError('Failed to create job');
    }
  }

  public async getJobStatus(jobId: string, userId: string): Promise<string> {
    const job = await this.prisma.indexingJob.findFirst({
      where: { id: jobId, userId },
      select: { status: true },
    });

    if (!job) {
      throw new AppError('Job not found');
    }

    return job.status;
  }

  public async pauseJob(jobId: string, userId: string): Promise<void> {
    const job = await this.prisma.indexingJob.findFirst({
      where: { id: jobId, userId },
    });

    if (!job) {
      throw new AppError('Job not found');
    }

    if (job.status !== 'active') {
      throw new AppError('Job is not active');
    }

    await this.jobQueue.pause();
    await this.prisma.indexingJob.update({
      where: { id: jobId },
      data: { status: 'paused' },
    });
  }

  public async resumeJob(jobId: string, userId: string): Promise<void> {
    const job = await this.prisma.indexingJob.findFirst({
      where: { id: jobId, userId },
    });

    if (!job) {
      throw new AppError('Job not found');
    }

    if (job.status !== 'paused') {
      throw new AppError('Job is not paused');
    }

    await this.jobQueue.resume();
    await this.prisma.indexingJob.update({
      where: { id: jobId },
      data: { status: 'active' },
    });
  }

  public async cancelJob(jobId: string, userId: string): Promise<void> {
    const job = await this.prisma.indexingJob.findFirst({
      where: { id: jobId, userId },
    });

    if (!job) {
      throw new AppError('Job not found');
    }

    if (job.status === 'completed' || job.status === 'cancelled') {
      throw new AppError('Job is already cancelled or completed');
    }

    const queuedJob = await this.jobQueue.getJob(jobId);
    if (queuedJob) {
      await queuedJob.remove();
    }

    await this.prisma.indexingJob.update({
      where: { id: jobId },
      data: { status: 'cancelled' },
    });
  }

  public async cleanup(): Promise<void> {
    try {
      await this.jobQueue.close();
      await this.prisma.$disconnect();
    } catch (error) {
      AppLogger.error('Failed to cleanup JobService', error as Error);
      throw error;
    }
  }
} 