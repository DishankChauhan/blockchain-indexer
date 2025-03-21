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

    // Get the job and its associated database connection
    const job = await prisma.indexingJob.findFirst({
      where: {
        id: jobId,
        userId: session.user.id
      }
    });

    if (!job) {
      return new NextResponse('Job not found', { status: 404 });
    }

    // Get the database connection
    const dbConnection = await prisma.databaseConnection.findUnique({
      where: { id: job.dbConnectionId }
    });

    if (!dbConnection) {
      return new NextResponse('No database connection found for this job', { status: 400 });
    }

    // Add job to the queue
    await indexingQueue.add('start-indexing', {
      jobId: job.id,
      config: job.config,
      userId: session.user.id,
      dbConnection: {
        id: dbConnection.id,
        host: dbConnection.host,
        port: dbConnection.port,
        database: dbConnection.database,
        username: dbConnection.username,
        password: dbConnection.password
      }
    });

    // Update job status in database
    await prisma.indexingJob.update({
      where: { id: job.id },
      data: { 
        status: 'active',
        progress: 0
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Failed to start job', error as Error, {
      component: 'JobAPI',
      action: 'StartJob'
    });
    return NextResponse.json({ 
      success: false,
      error: 'Failed to start job'
    }, { 
      status: 500 
    });
  }
} 