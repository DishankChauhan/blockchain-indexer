import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { WebhookService } from '@/lib/services/webhookService';
import { AppError } from '@/lib/utils/errorHandling';
import { logError, logInfo } from '@/lib/utils/serverLogger';
import prisma from '@/lib/db';

// Initialize webhookService in each request handler to ensure we have the correct userId
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      throw new AppError('Unauthorized');
    }

    const userId = session.user?.id;
    if (!userId) {
      throw new AppError('User ID not found in session');
    }

    const webhookService = WebhookService.getInstance(userId);
    const { id } = params;
    const webhook = await webhookService.getWebhook(id);

    if (!webhook) {
      throw new AppError('Webhook not found');
    }

    if (webhook.userId !== userId) {
      throw new AppError('Unauthorized');
    }

    return NextResponse.json(webhook);
  } catch (error) {
    const err = error as Error;
    logError('Failed to get webhook', {
      message: err.message,
      name: err.name,
      stack: err.stack
    }, {
      service: 'WebhookAPI',
      action: 'GET',
      path: `/api/webhooks/${params.id}`,
      webhookId: params.id
    });

    if (error instanceof AppError) {
      const statusCode = error.message.includes('not found') ? 404 :
                        error.message.includes('Unauthorized') ? 403 : 401;
      return NextResponse.json({ error: error.message }, { status: statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      throw new AppError('Unauthorized');
    }

    const userId = session.user?.id;
    if (!userId) {
      throw new AppError('User ID not found in session');
    }

    const webhookService = WebhookService.getInstance(userId);
    const { id } = params;
    const webhook = await webhookService.getWebhook(id);

    if (!webhook) {
      throw new AppError('Webhook not found');
    }

    if (webhook.userId !== userId) {
      throw new AppError('Unauthorized');
    }

    const body = await request.json();
    const { url, secret, retryCount, retryDelay, filters } = body;

    // Update webhook in database directly since WebhookService doesn't have an update method
    const updatedWebhook = await prisma.webhook.update({
      where: { id },
      data: {
        url,
        secret,
        retryCount,
        retryDelay,
        filters: JSON.stringify(filters ?? {})
      }
    });

    logInfo('Webhook updated successfully', {
      message: 'Webhook updated successfully',
      service: 'WebhookAPI',
      action: 'PUT',
      webhookId: id,
      userId
    });

    return NextResponse.json(updatedWebhook);
  } catch (error) {
    const err = error as Error;
    logError('Failed to update webhook', {
      message: err.message,
      name: err.name,
      stack: err.stack
    }, {
      service: 'WebhookAPI',
      action: 'PUT',
      path: `/api/webhooks/${params.id}`,
      webhookId: params.id
    });

    if (error instanceof AppError) {
      const statusCode = error.message.includes('not found') ? 404 :
                        error.message.includes('Unauthorized') ? 403 : 401;
      return NextResponse.json({ error: error.message }, { status: statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      throw new AppError('Unauthorized');
    }

    const userId = session.user?.id;
    if (!userId) {
      throw new AppError('User ID not found in session');
    }

    const webhookService = WebhookService.getInstance(userId);
    const { id } = params;
    const webhook = await webhookService.getWebhook(id);

    if (!webhook) {
      throw new AppError('Webhook not found');
    }

    if (webhook.userId !== userId) {
      throw new AppError('Unauthorized');
    }

    await webhookService.deleteWebhook(id);

    logInfo('Webhook deleted successfully', {
      message: 'Webhook deleted successfully',
      service: 'WebhookAPI',
      action: 'DELETE',
      webhookId: id,
      userId
    });

    return NextResponse.json({ message: 'Webhook deleted successfully' });
  } catch (error) {
    const err = error as Error;
    logError('Failed to delete webhook', {
      message: err.message,
      name: err.name,
      stack: err.stack
    }, {
      service: 'WebhookAPI',
      action: 'DELETE',
      path: `/api/webhooks/${params.id}`,
      webhookId: params.id
    });

    if (error instanceof AppError) {
      const statusCode = error.message.includes('not found') ? 404 :
                        error.message.includes('Unauthorized') ? 403 : 401;
      return NextResponse.json({ error: error.message }, { status: statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 