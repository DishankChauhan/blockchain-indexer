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

    return NextResponse.json(webhook);
  } catch (error) {
    console.error('Failed to get webhook:', error);
    return NextResponse.json(
      { error: 'Failed to get webhook' },
      { status: 500 }
    );
  }
}

export async function PUT(
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

    const body = await request.json();
    const webhookService = WebhookService.getInstance();
    
    const updatedWebhook = await webhookService.updateWebhook(params.id, {
      url: body.url,
      secret: body.secret,
      retryCount: body.retryCount,
      retryDelay: body.retryDelay,
      filters: body.filters,
    });

    return NextResponse.json(updatedWebhook);
  } catch (error) {
    console.error('Failed to update webhook:', error);
    return NextResponse.json(
      { error: 'Failed to update webhook' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    await webhookService.deleteWebhook(params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete webhook:', error);
    return NextResponse.json(
      { error: 'Failed to delete webhook' },
      { status: 500 }
    );
  }
} 