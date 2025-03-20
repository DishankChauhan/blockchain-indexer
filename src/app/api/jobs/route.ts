import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { DatabaseService } from '@/lib/services/databaseService';
import { logError, logInfo } from '@/lib/utils/serverLogger';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const jobs = await prisma.indexingJob.findMany({
      where: {
        userId: session.user.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    logInfo('Successfully fetched jobs', {
      component: 'JobsAPI',
      action: 'GET',
      userId: session.user.id,
      jobCount: jobs.length
    });

    return NextResponse.json(jobs);
  } catch (error) {
    logError('Failed to fetch jobs', error as Error, {
      component: 'JobsAPI',
      action: 'GET'
    });
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const data = await request.json();
    const { name, startSlot, endSlot, dbConnectionId, categories } = data;

    // Validate required fields
    if (!name || !dbConnectionId || startSlot === undefined || endSlot === undefined || !categories) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate slot range
    if (startSlot < 0 || endSlot < 0 || startSlot >= endSlot) {
      return NextResponse.json(
        { error: 'Invalid slot range' },
        { status: 400 }
      );
    }

    // Verify database connection exists and belongs to user
    const dbConnection = await prisma.databaseConnection.findFirst({
      where: {
        id: dbConnectionId,
        userId: session.user.id
      }
    });

    if (!dbConnection) {
      return NextResponse.json(
        { error: 'Database connection not found' },
        { status: 404 }
      );
    }

    // Create the job
    const job = await prisma.indexingJob.create({
      data: {
        userId: session.user.id,
        dbConnectionId,
        type: 'blockchain-indexer',
        status: 'pending',
        progress: 0,
        config: {
          name,
          startSlot,
          endSlot,
          categories
        }
      }
    });

    logInfo('Successfully created job', {
      component: 'JobsAPI',
      action: 'POST',
      userId: session.user.id,
      jobId: job.id
    });

    return NextResponse.json(job);
  } catch (error) {
    logError('Failed to create job', error as Error, {
      component: 'JobsAPI',
      action: 'POST'
    });
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 }
    );
  }
} 