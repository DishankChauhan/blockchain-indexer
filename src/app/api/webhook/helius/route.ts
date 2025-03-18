import { NextResponse } from 'next/server';
import { HeliusService } from '@/lib/services/heliusService';
import { AppError } from '@/lib/utils/errorHandling';

const WEBHOOK_SECRET = process.env.HELIUS_WEBHOOK_SECRET;

export async function POST(req: Request) {
  try {
    // Verify webhook signature
    const signature = req.headers.get('x-signature');
    if (!signature || signature !== WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { jobId, userId, data } = body;

    if (!jobId || !userId || !Array.isArray(data)) {
      return NextResponse.json(
        { error: 'Invalid webhook payload' },
        { status: 400 }
      );
    }

    const heliusService = HeliusService.getInstance();
    await heliusService.handleWebhookData(jobId, userId, data);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);

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