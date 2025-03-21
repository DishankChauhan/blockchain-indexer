import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logError } from '@/lib/utils/serverLogger';
import indexingQueue from '@/lib/queue/worker';

export async function POST(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const jobId = params.jobId;

    // Get the job from the database
    const job = await prisma.indexingJob.findFirst({
      where: {
        id: jobId,
        userId: session.user.id
      }
    });

    if (!job) {
      return new NextResponse('Job not found', { status: 404 });
    }

    // Remove job from the queue
    const queuedJob = await indexingQueue.getJob(jobId);
    if (queuedJob) {
      await queuedJob.remove();
    }

    // Update job status in database
    await prisma.indexingJob.update({
      where: { id: job.id },
      data: { 
        status: 'stopped',
        progress: 0
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Failed to stop job', error as Error, {
      component: 'JobAPI',
      action: 'StopJob'
    });
    return NextResponse.json({ 
      success: false,
      error: 'Failed to stop job'
    }, { 
      status: 500 
    });
  }
} 