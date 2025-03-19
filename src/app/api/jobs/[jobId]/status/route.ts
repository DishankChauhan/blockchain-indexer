import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { JobService } from '@/lib/services/jobService';
import { AppError } from '@/lib/utils/errorHandling';
import AppLogger from '@/lib/utils/logger';

const jobService = JobService.getInstance();

export async function GET(
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
    const status = await jobService.getJobStatus(jobId, userId);

    return NextResponse.json({ status });
  } catch (error) {
    AppLogger.error('Failed to get job status', error as Error, {
      component: 'JobStatusAPI',
      action: 'GET',
      path: `/api/jobs/${params.jobId}/status`,
      jobId: params.jobId
    });

    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 