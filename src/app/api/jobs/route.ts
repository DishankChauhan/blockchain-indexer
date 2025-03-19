import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return new NextResponse('User not found', { status: 404 });
    }

    const { type, config } = await req.json();

    // Get the first active database connection
    const connection = await prisma.databaseConnection.findFirst({
      where: {
        userId: user.id,
        status: 'active'
      }
    });

    if (!connection) {
      return new NextResponse('No active database connection found', { status: 400 });
    }

    // Create the indexing job
    const job = await prisma.indexingJob.create({
      data: {
        userId: user.id,
        dbConnectionId: connection.id,
        type,
        config,
        status: 'pending'
      }
    });

    return NextResponse.json({
      message: 'Indexing job created successfully',
      job: {
        id: job.id,
        type: job.type,
        status: job.status,
        createdAt: job.createdAt
      }
    });
  } catch (error) {
    console.error('Create job error:', error);
    return new NextResponse('Failed to create indexing job', { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return new NextResponse('User not found', { status: 404 });
    }

    const jobs = await prisma.indexingJob.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        databaseConnection: {
          select: {
            database: true,
            host: true
          }
        }
      }
    });

    return NextResponse.json(jobs);
  } catch (error) {
    console.error('List jobs error:', error);
    return new NextResponse('Failed to list indexing jobs', { status: 500 });
  }
} 