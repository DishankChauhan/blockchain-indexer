import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { JobService } from '@/lib/services/jobService';
import { AppError } from '@/lib/utils/errorHandling';
import AppLogger from '@/lib/utils/logger';

const jobService = JobService.getInstance();

export async function POST(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      throw new AppError('Unauthorized');
    }

    const userId = session.user?.id;
    if (!userId) {
      throw new AppError('User ID not found in session');
    }

    const { jobId } = params;
    const job = await jobService.resumeJob(jobId, userId);

    AppLogger.info('Job started successfully', {
      component: 'JobStartAPI',
      action: 'POST',
      jobId,
      userId
    });

    return NextResponse.json(job);
  } catch (error) {
    AppLogger.error('Failed to start job', error as Error, {
      component: 'JobStartAPI',
      action: 'POST',
      path: `/api/jobs/${params.jobId}/start`,
      jobId: params.jobId
    });

    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 