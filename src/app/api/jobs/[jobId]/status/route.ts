import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logError } from '@/lib/utils/serverLogger';
import prisma from '@/lib/prisma';

interface Props {
  params: { jobId: string }
}

export async function GET(req: Request, { params }: Props) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const job = await prisma.indexingJob.findFirst({
      where: {
        id: params.jobId,
        userId: session.user.id
      },
      select: {
        id: true,
        status: true,
        progress: true,
        lastRunAt: true,
        updatedAt: true
      }
    });

    if (!job) {
      return new NextResponse('Job not found', { status: 404 });
    }

    return NextResponse.json({ data: job });
  } catch (error) {
    logError('Failed to get job status', error as Error, {
      component: 'JobStatusAPI',
      action: 'GET',
      jobId: params.jobId
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 