import { NextRequest, NextResponse } from 'next/server';
import { HeliusService } from '@/lib/services/heliusService';
import { logError, logInfo, logWarn } from '@/lib/utils/serverLogger';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const WEBHOOK_SECRET = process.env.HELIUS_WEBHOOK_SECRET;
const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const webhookId = request.headers.get('x-webhook-id');
    const webhookSignature = request.headers.get('x-signature');
    const body = await request.json();

    if (!webhookId || !webhookSignature || !body) {
      logWarn('Missing required webhook components', {
        component: 'HeliusWebhook',
        action: 'ValidateRequest',
        webhookId,
        hasSignature: !!webhookSignature,
        hasBody: !!body
      });
      return NextResponse.json({ error: 'Missing required webhook components' }, { status: 400 });
    }

    // Verify webhook signature
    if (webhookSignature !== WEBHOOK_SECRET) {
      logWarn('Invalid webhook signature', {
        component: 'HeliusWebhook',
        action: 'ValidateSignature',
        webhookId
      });
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    // Get the job associated with this webhook
    const job = await prisma.indexingJob.findFirst({
      where: {
        config: {
          path: ['webhook', 'id'],
          equals: webhookId
        }
      }
    });

    if (!job) {
      logWarn('No job found for webhook', {
        component: 'HeliusWebhook',
        action: 'FindJob',
        webhookId
      });
      return NextResponse.json({ error: 'No job found for webhook' }, { status: 404 });
    }

    const heliusService = HeliusService.getInstance(job.userId);
    const result = await heliusService.handleWebhookData(job.id, job.userId, [body]);

    logInfo('Webhook data processed successfully', {
      component: 'HeliusWebhook',
      action: 'ProcessData',
      webhookId,
      jobId: job.id,
      transactionsProcessed: result.transactionsProcessed
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Failed to process webhook data', error as Error, {
      component: 'HeliusWebhook',
      action: 'ProcessWebhook'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
} 