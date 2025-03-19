import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import JobService  from '@/lib/services/jobService';
import { AppError } from '@/lib/utils/errorHandling';

export async function GET(
  req: Request,
  { params }: { params: { jobId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const jobService = JobService.getInstance();
    const job = await jobService.getJob(
      params.jobId,
      session.user.email as string
    );

    return NextResponse.json(job);
  } catch (error) {
    console.error('Get job error:', error);

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
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
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { action } = body;

    if (!action || !['pause', 'resume', 'cancel'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    const jobService = JobService.getInstance();
    let job;

    switch (action) {
      case 'pause':
        job = await jobService.pauseJob(
          params.jobId,
          session.user.email as string
        );
        break;
      case 'resume':
        job = await jobService.resumeJob(
          params.jobId,
          session.user.email as string
        );
        break;
      case 'cancel':
        job = await jobService.cancelJob(
          params.jobId,
          session.user.email as string
        );
        break;
    }

    return NextResponse.json(job);
  } catch (error) {
    console.error('Update job error:', error);

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
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
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const jobService = JobService.getInstance();
    await jobService.cancelJob(
      params.jobId,
      session.user.email as string
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete job error:', error);

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 