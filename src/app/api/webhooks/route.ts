import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { WebhookService, WebhookConfig } from '@/lib/services/webhookService';
import { AppError } from '@/lib/utils/errorHandling';
import AppLogger from '@/lib/utils/logger';
import { PrismaClient } from '@prisma/client';

const webhookService = WebhookService.getInstance();
const prisma = new PrismaClient();

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

    const webhooks = await webhookService.listWebhooks(userId);
    return NextResponse.json(webhooks);
  } catch (error) {
    AppLogger.error('Failed to list webhooks', error as Error, {
      component: 'WebhooksAPI',
      action: 'GET',
      path: '/api/webhooks'
    });

    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
    const { url, secret, retryCount, retryDelay, filters, notificationEmail } = body;

    if (!url || !secret) {
      throw new AppError('Missing required fields');
    }

    const config: WebhookConfig = {
      url,
      secret,
      retryCount,
      retryDelay,
      filters,
      notificationEmail
    };

    // Get the first active indexing job for the user
    const indexingJob = await prisma.indexingJob.findFirst({
      where: {
        userId,
        status: 'active'
      }
    });

    if (!indexingJob) {
      throw new AppError('No active indexing job found');
    }

    const webhook = await webhookService.createWebhook(userId, indexingJob.id, config);

    AppLogger.info('Webhook created successfully', {
      component: 'WebhooksAPI',
      action: 'POST',
      webhookId: webhook.id,
      userId,
      indexingJobId: indexingJob.id
    });

    return NextResponse.json(webhook);
  } catch (error) {
    AppLogger.error('Failed to create webhook', error as Error, {
      component: 'WebhooksAPI',
      action: 'POST',
      path: '/api/webhooks'
    });

    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 