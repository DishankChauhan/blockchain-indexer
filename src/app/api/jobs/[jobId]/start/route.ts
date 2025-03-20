import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logError, logInfo } from '@/lib/utils/serverLogger';
import prisma from '@/lib/prisma';

interface Props {
  params: { jobId: string }
}

export async function POST(req: Request, { params }: Props) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const job = await prisma.indexingJob.findFirst({
      where: {
        id: params.jobId,
        userId: session.user.id
      }
    });

    if (!job) {
      return new NextResponse('Job not found', { status: 404 });
    }

    const updatedJob = await prisma.indexingJob.update({
      where: { id: params.jobId },
      data: {
        status: 'active',
        lastRunAt: new Date()
      }
    });

    logInfo('Job started successfully', {
      component: 'JobStartAPI',
      action: 'POST',
      jobId: params.jobId
    });

    return NextResponse.json({ data: updatedJob });
  } catch (error) {
    logError('Failed to start job', error as Error, {
      component: 'JobStartAPI',
      action: 'POST',
      jobId: params.jobId
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 