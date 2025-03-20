import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logError, logInfo } from '@/lib/utils/serverLogger';

export async function POST(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { jobId } = params;

    // Verify job exists and belongs to user
    const job = await prisma.indexingJob.findFirst({
      where: {
        id: jobId,
        userId: session.user.id
      }
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Check if job is running
    if (job.status !== 'running') {
      return NextResponse.json(
        { error: 'Job is not running' },
        { status: 400 }
      );
    }

    // Update job status
    const updatedJob = await prisma.indexingJob.update({
      where: {
        id: jobId
      },
      data: {
        status: 'stopped',
        updatedAt: new Date()
      }
    });

    logInfo('Successfully stopped job', {
      component: 'JobsAPI',
      action: 'Stop',
      userId: session.user.id,
      jobId
    });

    return NextResponse.json(updatedJob);
  } catch (error) {
    logError('Failed to stop job', error as Error, {
      component: 'JobsAPI',
      action: 'Stop'
    });
    return NextResponse.json(
      { error: 'Failed to stop job' },
      { status: 500 }
    );
  }
} 