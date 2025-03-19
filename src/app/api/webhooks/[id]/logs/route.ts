import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { WebhookService } from '@/lib/services/webhookService';
import { prisma } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const webhook = await prisma.webhook.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    const webhookService = WebhookService.getInstance();
    const { searchParams } = new URL(request.url);
    
    const logs = await webhookService.getWebhookLogs(params.id, {
      startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined,
      endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined,
      status: searchParams.get('status') as any,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Failed to get webhook logs:', error);
    return NextResponse.json(
      { error: 'Failed to get webhook logs' },
      { status: 500 }
    );
  }
} 