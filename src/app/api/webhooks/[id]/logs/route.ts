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
    const { searchParams } = new URL(request.url);
    
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;
    const status = searchParams.get('status') as 'success' | 'failed' | 'retrying' | undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;

    const logs = await webhookService.getWebhookLogs(id, {
      startDate,
      endDate,
      status,
      limit,
      offset
    });

    return NextResponse.json(logs);
  } catch (error) {
    AppLogger.error('Failed to get webhook logs', error as Error, {
      component: 'WebhookLogsAPI',
      action: 'GET',
      path: `/api/webhooks/${params.id}/logs`,
      webhookId: params.id
    });

    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 