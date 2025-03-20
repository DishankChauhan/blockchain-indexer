import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { WebhookService, WebhookConfig } from '@/lib/services/webhookService';
import { AppError } from '@/lib/utils/errorHandling';
import { logError, logInfo } from '@/lib/utils/serverLogger';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const webhooks = await prisma.webhook.findMany({
      where: {
        userId: session.user.id
      },
      select: {
        id: true,
        url: true,
        secret: true,
        status: true,
        filters: true,
        config: true,
        createdAt: true,
        updatedAt: true,
        indexingJob: {
          select: {
            id: true,
            type: true,
            status: true
          }
        }
      }
    });

    return NextResponse.json({
      data: webhooks,
      status: 200
    });
  } catch (error) {
    await logError('Failed to fetch webhooks', error as Error, {
      component: 'WebhooksAPI',
      action: 'GET'
    });
    return NextResponse.json({ 
      data: null, 
      status: 500,
      error: 'Internal Server Error' 
    }, { 
      status: 500 
    });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { url, secret, indexingJobId, filters } = body;

    if (!url || !secret || !indexingJobId) {
      throw new AppError('Missing required fields', 400);
    }

    // Verify the indexing job belongs to the user
    const job = await prisma.indexingJob.findFirst({
      where: {
        id: indexingJobId,
        userId: session.user.id
      }
    });

    if (!job) {
      throw new AppError('Indexing job not found', 404);
    }

    const webhookConfig: WebhookConfig = {
      url,
      secret,
      filters: filters || {},
      retryCount: 3,
      retryDelay: 1000
    };

    const webhookService = WebhookService.getInstance(session.user.id);
    const webhook = await webhookService.createWebhook(session.user.id, indexingJobId, webhookConfig);
    await logInfo('Webhook created successfully', {
      component: 'WebhooksAPI',
      action: 'POST',
      webhookId: webhook.id
    });

    return NextResponse.json({
      data: webhook,
      status: 201
    });
  } catch (error) {
    await logError('Failed to create webhook', error as Error, {
      component: 'WebhooksAPI',
      action: 'POST'
    });
    
    if (error instanceof AppError) {
      return NextResponse.json({ 
        data: null, 
        status: error.statusCode,
        error: error.message 
      }, { 
        status: error.statusCode 
      });
    }

    return NextResponse.json({ 
      data: null, 
      status: 500,
      error: 'Internal Server Error' 
    }, { 
      status: 500 
    });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const webhookId = searchParams.get('id');

    if (!webhookId) {
      throw new AppError('Webhook ID is required', 400);
    }

    // Verify the webhook belongs to the user
    const webhook = await prisma.webhook.findFirst({
      where: {
        id: webhookId,
        userId: session.user.id
      }
    });

    if (!webhook) {
      throw new AppError('Webhook not found', 404);
    }

    const webhookService = WebhookService.getInstance(session.user.id);
    await webhookService.deleteWebhook(webhookId);
    await logInfo('Webhook deleted successfully', {
      component: 'WebhooksAPI',
      action: 'DELETE',
      webhookId
    });

    return NextResponse.json({
      data: { success: true },
      status: 200
    });
  } catch (error) {
    await logError('Failed to delete webhook', error as Error, {
      component: 'WebhooksAPI',
      action: 'DELETE'
    });
    
    if (error instanceof AppError) {
      return NextResponse.json({ 
        data: null, 
        status: error.statusCode,
        error: error.message 
      }, { 
        status: error.statusCode 
      });
    }

    return NextResponse.json({ 
      data: null, 
      status: 500,
      error: 'Internal Server Error' 
    }, { 
      status: 500 
    });
  }
} 