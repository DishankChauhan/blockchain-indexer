import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import JobService  from '@/lib/services/jobService';
import { AppError } from '@/lib/utils/errorHandling';
import AppLogger from '@/lib/utils/logger';

export async function GET(
  req: Request,
  { params }: { params: { jobId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      AppLogger.warn('Unauthorized access attempt to job details', {
        component: 'JobsAPI',
        action: 'GET',
        jobId: params.jobId
      });
      throw new AppError('Unauthorized');
    }

    const jobService = JobService.getInstance();
    const job = await jobService.getJob(
      params.jobId,
      session.user.email as string
    );

    AppLogger.info('Job details retrieved successfully', {
      component: 'JobsAPI',
      action: 'GET',
      jobId: params.jobId,
      userId: session.user.email
    });

    return NextResponse.json(job);
  } catch (error) {
    AppLogger.error('Failed to get job details', error as Error, {
      component: 'JobsAPI',
      action: 'GET',
      jobId: params.jobId,
      path: `/api/jobs/${params.jobId}`
    });

    if (error instanceof AppError) {
      const statusCode = error.message.includes('Unauthorized') ? 401 :
                        error.message.includes('not found') ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status: statusCode });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { jobId: string } }
) {
  let session;
  try {
    session = await getServerSession(authOptions);
    if (!session?.user) {
      AppLogger.warn('Unauthorized access attempt to job update', {
        component: 'JobsAPI',
        action: 'PATCH',
        jobId: params.jobId
      });
      throw new AppError('Unauthorized');
    }

    const body = await req.json();
    const { action } = body;

    if (!action || !['pause', 'resume', 'cancel'].includes(action)) {
      AppLogger.warn('Invalid job action requested', {
        component: 'JobsAPI',
        action: 'PATCH',
        jobId: params.jobId,
        requestedAction: action,
        userId: session.user.email
      });
      throw new AppError('Invalid action');
    }

    const jobService = JobService.getInstance();
    let job;

    switch (action) {
      case 'pause':
        job = await jobService.pauseJob(
          params.jobId,
          session.user.email as string
        );
        AppLogger.info('Job paused successfully', {
          component: 'JobsAPI',
          action: 'PauseJob',
          jobId: params.jobId,
          userId: session.user.email
        });
        break;
      case 'resume':
        job = await jobService.resumeJob(
          params.jobId,
          session.user.email as string
        );
        AppLogger.info('Job resumed successfully', {
          component: 'JobsAPI',
          action: 'ResumeJob',
          jobId: params.jobId,
          userId: session.user.email
        });
        break;
      case 'cancel':
        job = await jobService.cancelJob(
          params.jobId,
          session.user.email as string
        );
        AppLogger.info('Job cancelled successfully', {
          component: 'JobsAPI',
          action: 'CancelJob',
          jobId: params.jobId,
          userId: session.user.email
        });
        break;
    }

    return NextResponse.json(job);
  } catch (error) {
    AppLogger.error('Failed to update job', error as Error, {
      component: 'JobsAPI',
      action: 'PATCH',
      jobId: params.jobId,
      userId: session?.user?.email || undefined,
      path: `/api/jobs/${params.jobId}`
    });

    if (error instanceof AppError) {
      const statusCode = error.message.includes('Unauthorized') ? 401 :
                        error.message.includes('not found') ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status: statusCode });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { jobId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      AppLogger.warn('Unauthorized access attempt to delete job', {
        component: 'JobsAPI',
        action: 'DELETE',
        jobId: params.jobId
      });
      throw new AppError('Unauthorized');
    }

    const jobService = JobService.getInstance();
    await jobService.cancelJob(
      params.jobId,
      session.user.email as string
    );

    AppLogger.info('Job deleted successfully', {
      component: 'JobsAPI',
      action: 'DELETE',
      jobId: params.jobId,
      userId: session.user.email
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    AppLogger.error('Failed to delete job', error as Error, {
      component: 'JobsAPI',
      action: 'DELETE',
      jobId: params.jobId,
      path: `/api/jobs/${params.jobId}`
    });

    if (error instanceof AppError) {
      const statusCode = error.message.includes('Unauthorized') ? 401 :
                        error.message.includes('not found') ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status: statusCode });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 