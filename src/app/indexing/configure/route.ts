import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { IndexingCategory } from '@/types';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { dbConnectionId, category, config } = body;

    // Validate the database connection exists and belongs to the user
    const dbConnection = await prisma.databaseConnection.findFirst({
      where: {
        id: dbConnectionId,
        userId: session.user?.email ?? '',
      },
    });

    if (!dbConnection) {
      return NextResponse.json(
        { error: 'Database connection not found' },
        { status: 404 }
      );
    }

    // Create the indexing job
    const indexingJob = await prisma.indexingJob.create({
      data: {
        userId: session.user.email as string,
        dbConnectionId,
        category,
        config,
        status: 'pending',
      },
    });

    // Here you would typically start the indexing process
    // For example, create a Bull job or trigger a webhook subscription

    return NextResponse.json({
      message: 'Indexing configured successfully',
      job: {
        id: indexingJob.id,
        status: indexingJob.status,
        category: indexingJob.category,
      },
    });
  } catch (error) {
    console.error('Indexing configuration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 