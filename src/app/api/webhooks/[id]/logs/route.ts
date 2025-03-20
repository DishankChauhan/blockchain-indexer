import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { WebhookService } from '@/lib/services/webhookService';
import { AppError } from '@/lib/utils/errorHandling';
import { logError, logInfo } from '@/lib/utils/serverLogger';

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
    const { searchParams } = new URL(request.url);
    
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;
    const status = searchParams.get('status') as 'success' | 'failed' | 'retrying' | undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;

    // Verify webhook ownership
    const webhook = await webhookService.getWebhook(id);
    if (!webhook || webhook.userId !== userId) {
      throw new AppError('Unauthorized');
    }

    const logs = await webhookService.getWebhookLogs(id, {
      startDate,
      endDate,
      status,
      limit,
      offset
    });

    logInfo('Webhook logs retrieved successfully', {
      message: 'Webhook logs retrieved successfully',
      service: 'WebhookLogsAPI',
      action: 'GET',
      webhookId: id,
      userId
    });

    return NextResponse.json(logs);
  } catch (error) {
    const err = error as Error;
    logError('Failed to get webhook logs', {
      message: err.message,
      name: err.name,
      stack: err.stack
    }, {
      service: 'WebhookLogsAPI',
      action: 'GET',
      path: `/api/webhooks/${params.id}/logs`,
      webhookId: params.id
    });

    if (error instanceof AppError) {
      const statusCode = error.message.includes('Unauthorized') ? 401 :
                        error.message.includes('not found') ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status: statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 