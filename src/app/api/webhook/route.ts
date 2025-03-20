import { NextResponse } from 'next/server';
import { WebhookService } from '@/lib/services/webhookService';
import { logError, logInfo, logWarn } from '@/lib/utils/serverLogger';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const signature = req.headers.get('x-signature');

    if (!body || !signature) {
      logWarn('Invalid webhook request', {
        component: 'WebhookAPI',
        action: 'POST'
      });
      return new NextResponse('Invalid request', { status: 400 });
    }

    const webhookService = WebhookService.getInstance();
    const isValid = await webhookService.verifySignature(body, signature);

    if (!isValid) {
      logWarn('Invalid webhook signature', {
        component: 'WebhookAPI',
        action: 'POST'
      });
      return new NextResponse('Invalid signature', { status: 401 });
    }

    await webhookService.handleWebhook(body);

    logInfo('Webhook processed successfully', {
      component: 'WebhookAPI',
      action: 'POST'
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Failed to process webhook', error as Error, {
      component: 'WebhookAPI',
      action: 'POST'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 