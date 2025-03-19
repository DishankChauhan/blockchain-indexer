import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { WebhookService } from '@/lib/services/webhookService';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const webhooks = await prisma.webhook.findMany({
      where: {
        userId: session.user.id,
      },
    });

    return NextResponse.json(webhooks);
  } catch (error) {
    console.error('Failed to get webhooks:', error);
    return NextResponse.json(
      { error: 'Failed to get webhooks' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const webhookService = WebhookService.getInstance();
    
    const webhook = await webhookService.createWebhook(session.user.id, body.url, {
      secret: body.secret,
      retryCount: body.retryCount,
      retryDelay: body.retryDelay,
      filters: body.filters,
      url: ''
    });

    return NextResponse.json(webhook);
  } catch (error) {
    console.error('Failed to create webhook:', error);
    return NextResponse.json(
      { error: 'Failed to create webhook' },
      { status: 500 }
    );
  }
} 