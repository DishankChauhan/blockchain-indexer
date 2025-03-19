import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { WebhookService } from '@/lib/services/webhookService';
import { AppError } from '@/lib/utils/errorHandling';
import AppLogger from '@/lib/utils/logger';

const webhookService = WebhookService.getInstance();

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
    AppLogger.error('Failed to get webhook', error as Error, {
      component: 'WebhookAPI',
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

    const updatedWebhook = await webhookService.updateWebhook(id, {
      url,
      secret,
      retryCount,
      retryDelay,
      filters
    });

    AppLogger.info('Webhook updated successfully', {
      component: 'WebhookAPI',
      action: 'PUT',
      webhookId: id,
      userId
    });

    return NextResponse.json(updatedWebhook);
  } catch (error) {
    AppLogger.error('Failed to update webhook', error as Error, {
      component: 'WebhookAPI',
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

    const { id } = params;
    const webhook = await webhookService.getWebhook(id);

    if (!webhook) {
      throw new AppError('Webhook not found');
    }

    if (webhook.userId !== userId) {
      throw new AppError('Unauthorized');
    }

    await webhookService.deleteWebhook(id);

    AppLogger.info('Webhook deleted successfully', {
      component: 'WebhookAPI',
      action: 'DELETE',
      webhookId: id,
      userId
    });

    return NextResponse.json({ message: 'Webhook deleted successfully' });
  } catch (error) {
    AppLogger.error('Failed to delete webhook', error as Error, {
      component: 'WebhookAPI',
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