import { NextRequest, NextResponse } from 'next/server';
import { WebhookService } from '@/lib/services/webhookService';
import { logError, logWarn } from '@/lib/utils/serverLogger';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const signature = request.headers.get('x-signature');
    const webhookId = request.headers.get('x-webhook-id');

    if (!signature || !webhookId) {
      logWarn('Missing required webhook components', {
        component: 'WebhookAPI',
        action: 'ValidateRequest',
        hasSignature: !!signature,
        hasWebhookId: !!webhookId
      });
      return NextResponse.json({ error: 'Missing required components' }, { status: 400 });
    }

    const webhookService = WebhookService.getInstance(session.user.id);
    await webhookService.handleWebhookEvent(webhookId, body, signature);

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Failed to process webhook', error as Error, {
      component: 'WebhookAPI',
      action: 'ProcessWebhook'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 