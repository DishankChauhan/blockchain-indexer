import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AppError } from '@/lib/utils/errorHandling';
import AppLogger from '@/lib/utils/logger';
import { DataProcessingService } from '@/lib/services/dataProcessingService';

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
    const { filters, categories, webhook } = body;

    if (!filters || !categories || !webhook) {
      AppLogger.warn('Invalid configuration request', {
        component: 'IndexingAPI',
        action: 'Configure',
        userId,
        hasFilters: !!filters,
        hasCategories: !!categories,
        hasWebhook: !!webhook
      });
      throw new AppError('Missing required configuration fields');
    }

    const processingService = DataProcessingService.getInstance();
    const config = await processingService.configureIndexing(userId, {
      filters,
      categories,
      webhook
    });

    AppLogger.info('Indexing configuration saved successfully', {
      component: 'IndexingAPI',
      action: 'Configure',
      userId,
      configId: config.id
    });

    return NextResponse.json(config);
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
  }
} 