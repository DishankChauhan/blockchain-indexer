import { NextResponse } from 'next/server';
import { WebhookService } from '@/lib/services/webhookService';
import { AppError } from '@/lib/utils/errorHandling';
import AppLogger from '@/lib/utils/logger';
import { verifyWebhookSignature } from '@/lib/webhookUtils';

export async function POST(request: Request) {
  try {
    const signature = request.headers.get('x-signature');
    const timestamp = request.headers.get('x-timestamp');
    const body = await request.json();
    const { webhookId, payload } = body;

    if (!webhookId || !payload) {
      AppLogger.warn('Invalid webhook request', {
        component: 'WebhookAPI',
        action: 'ProcessWebhook',
        webhookId: webhookId || 'missing',
        hasPayload: !!payload
      });
      throw new AppError('Invalid webhook request');
    }

    // Verify webhook signature
    if (!verifyWebhookSignature(payload, signature, timestamp)) {
      AppLogger.warn('Invalid webhook signature', {
        component: 'WebhookAPI',
        action: 'VerifySignature',
        webhookId,
        hasSignature: !!signature,
        hasTimestamp: !!timestamp
      });
      throw new AppError('Invalid webhook signature');
    }

    const webhookService = WebhookService.getInstance();
    await webhookService.handleWebhookEvent(webhookId, payload, signature || '');

    AppLogger.info('Webhook processed successfully', {
      component: 'WebhookAPI',
      action: 'ProcessWebhook',
      webhookId
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    AppLogger.error('Failed to process webhook', error as Error, {
      component: 'WebhookAPI',
      action: 'ProcessWebhook',
      path: '/api/webhook'
    });

    if (error instanceof AppError) {
      const statusCode = error.message.includes('Invalid signature') ? 401 :
                        error.message.includes('not found') ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status: statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 