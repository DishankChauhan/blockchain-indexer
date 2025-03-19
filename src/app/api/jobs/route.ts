import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { JobService } from '@/lib/services/jobService';
import { AppError } from '@/lib/utils/errorHandling';
import AppLogger from '@/lib/utils/logger';

const jobService = JobService.getInstance();

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      throw new AppError('Unauthorized');
    }

    const userId = session.user?.id;
    if (!userId) {
      throw new AppError('User ID not found in session');
    }

    const body = await request.json();
    const { dbConnectionId, config } = body;

    if (!dbConnectionId || !config) {
      throw new AppError('Missing required fields');
    }

    const job = await jobService.createJob(userId, dbConnectionId, config);

    return NextResponse.json(job);
  } catch (error) {
    AppLogger.error('Failed to create job', error as Error, {
      component: 'JobsAPI',
      action: 'POST',
      path: '/api/jobs'
    });

    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      throw new AppError('Unauthorized');
    }

    const userId = session.user?.id;
    if (!userId) {
      throw new AppError('User ID not found in session');
    }

    const jobs = await jobService.listJobs(userId);
    return NextResponse.json(jobs);
  } catch (error) {
    AppLogger.error('Failed to list jobs', error as Error, {
      component: 'JobsAPI',
      action: 'GET',
      path: '/api/jobs'
    });

    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 