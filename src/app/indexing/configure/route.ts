import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AppError } from '@/lib/utils/errorHandling';
import AppLogger from '@/lib/utils/logger';
import { DataProcessingService } from '@/lib/services/dataProcessingService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      AppLogger.warn('Unauthorized access attempt to configure indexing', {
        component: 'IndexingAPI',
        action: 'Configure'
      });
      throw new AppError('Unauthorized');
    }

    const userId = session.user?.id;
    if (!userId) {
      throw new AppError('User ID not found in session');
    }

    const body = await request.json();
    const { filters, categories, webhook, dbConnectionId } = body;

    if (!filters || !categories || !webhook || !dbConnectionId) {
      AppLogger.warn('Invalid configuration request', {
        component: 'IndexingAPI',
        action: 'Configure',
        userId,
        hasFilters: !!filters,
        hasCategories: !!categories,
        hasWebhook: !!webhook,
        hasDbConnection: !!dbConnectionId
      });
      throw new AppError('Missing required configuration fields');
    }

    // Verify database connection exists and belongs to user
    const dbConnection = await prisma.databaseConnection.findFirst({
      where: {
        id: dbConnectionId,
        userId
      }
    });

    if (!dbConnection) {
      throw new AppError('Database connection not found');
    }

    // Create indexing job in database
    const job = await prisma.indexingJob.create({
      data: {
        userId,
        dbConnectionId,
        type: 'blockchain',
        status: 'created',
        progress: 0,
        config: {
          filters,
          categories,
          webhook
        }
      }
    });

    // Start indexing process
    const processingService = DataProcessingService.getInstance();
    await processingService.startIndexing(job.id, {
      type: 'realtime',
      filters: {
        programId: filters.programIds?.[0],
        account: filters.accounts?.[0]
      },
      transformations: [],
      aggregations: []
    });

    AppLogger.info('Indexing configuration saved and started successfully', {
      component: 'IndexingAPI',
      action: 'Configure',
      userId,
      jobId: job.id
    });

    return NextResponse.json(job);
  } catch (error) {
    AppLogger.error('Failed to save indexing configuration', error as Error, {
      component: 'IndexingAPI',
      action: 'Configure',
      path: '/api/indexing/configure'
    });

    if (error instanceof AppError) {
      const statusCode = error.message.includes('Unauthorized') ? 401 :
                        error.message.includes('not found') ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status: statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
} 