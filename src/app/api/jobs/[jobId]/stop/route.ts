import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import JobService from '@/lib/services/jobService';

export async function POST(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    console.log('Session:', session); // Debug log

    if (!session) {
      console.log('No session found');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!session.user) {
      console.log('No user in session');
      return NextResponse.json({ error: 'No user found' }, { status: 401 });
    }

    if (!session.user.id) {
      console.log('No user ID in session');
      return NextResponse.json({ error: 'No user ID found' }, { status: 401 });
    }

    const jobService = JobService.getInstance();
    const job = await jobService.cancelJob(params.jobId, session.user.id);

    return NextResponse.json(job);
  } catch (error) {
    console.error('Failed to stop job:', error);
    return NextResponse.json(
      { error: 'Failed to stop job' },
      { status: 500 }
    );
  }
} 