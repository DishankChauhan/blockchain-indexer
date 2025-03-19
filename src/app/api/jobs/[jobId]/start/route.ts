import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import Bull from 'bull';
import Redis from 'ioredis';

// Initialize Redis and Bull queue
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const indexingQueue = new Bull('indexing', {
  redis: {
    port: 6379,
    host: 'localhost',
  },
});

export async function POST(
  req: Request,
  { params }: { params: { jobId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return new NextResponse('User not found', { status: 404 });
    }

    const { jobId } = params;

    // Get the job
    const job = await prisma.indexingJob.findFirst({
      where: {
        id: jobId,
        userId: user.id
      },
      include: {
        databaseConnection: true
      }
    });

    if (!job) {
      return new NextResponse('Job not found', { status: 404 });
    }

    // Add job to the queue
    await indexingQueue.add('start-indexing', {
      jobId: job.id,
      type: job.type,
      config: job.config,
      dbConnection: {
        host: job.databaseConnection.host,
        port: job.databaseConnection.port,
        database: job.databaseConnection.database,
        username: job.databaseConnection.username,
        password: job.databaseConnection.password
      }
    });

    // Update job status
    await prisma.indexingJob.update({
      where: { id: jobId },
      data: { 
        status: 'active',
        lastRunAt: new Date()
      }
    });

    return NextResponse.json({ message: 'Job started successfully' });
  } catch (error) {
    console.error('Start job error:', error);
    return new NextResponse('Failed to start job', { status: 500 });
  }
} 