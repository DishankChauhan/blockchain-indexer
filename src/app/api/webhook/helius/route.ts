import { NextResponse } from 'next/server';
import { HeliusService } from '@/lib/services/heliusService';
import { logError, logInfo, logWarn } from '@/lib/utils/serverLogger';

const WEBHOOK_SECRET = process.env.HELIUS_WEBHOOK_SECRET;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const signature = req.headers.get('x-signature');
    const webhookId = req.headers.get('x-webhook-id');

    if (!signature || !webhookId) {
      logWarn('Invalid webhook signature', {
        component: 'HeliusWebhookAPI',
        action: 'POST',
        hasSignature: !!signature,
        hasWebhookId: !!webhookId
      });
      return new NextResponse('Invalid signature', { status: 401 });
    }

    if (!body || !Array.isArray(body)) {
      logWarn('Invalid webhook payload', {
        component: 'HeliusWebhookAPI',
        action: 'POST',
        webhookId
      });
      return new NextResponse('Invalid payload', { status: 400 });
    }

    const heliusService = HeliusService.getInstance();
    const result = await heliusService.handleWebhookData(body, webhookId);

    logInfo('Webhook data processed successfully', {
      component: 'HeliusWebhookAPI',
      action: 'POST',
      webhookId,
      transactionsProcessed: result.transactionsProcessed,
      errorsEncountered: result.errorsEncountered
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Failed to process webhook data', error as Error, {
      component: 'HeliusWebhookAPI',
      action: 'POST'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 