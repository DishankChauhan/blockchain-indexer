import { NextResponse } from 'next/server';
import { HeliusService } from '@/lib/services/heliusService';
import { AppError } from '@/lib/utils/errorHandling';
import AppLogger from '@/lib/utils/logger';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/options';

const WEBHOOK_SECRET = process.env.HELIUS_WEBHOOK_SECRET;

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const heliusService = HeliusService.getInstance(session.user.id);

    // Verify webhook signature
    const signature = req.headers.get('x-signature');
    if (!signature || signature !== WEBHOOK_SECRET) {
      AppLogger.warn('Invalid webhook signature', {
        component: 'HeliusWebhook',
        action: 'ValidateSignature',
        receivedSignature: signature || 'none'
      });
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { jobId, userId, data } = body;

    if (!jobId || !userId || !Array.isArray(data)) {
      AppLogger.warn('Invalid webhook payload', {
        component: 'HeliusWebhook',
        action: 'ValidatePayload',
        jobId: jobId || 'missing',
        userId: userId || 'missing',
        hasData: !!data,
        isDataArray: Array.isArray(data)
      });
      return NextResponse.json(
        { error: 'Invalid webhook payload' },
        { status: 400 }
      );
    }

    await heliusService.handleWebhookData(jobId, userId, data);

    AppLogger.info('Webhook data processed successfully', {
      component: 'HeliusWebhook',
      action: 'ProcessData',
      jobId,
      userId,
      dataLength: data.length
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    AppLogger.error('Failed to process webhook data', error as Error, {
      component: 'HeliusWebhook',
      action: 'ProcessData',
      path: '/api/webhook/helius'
    });

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 