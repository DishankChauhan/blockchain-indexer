import { NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/webhookUtils';
import { processTransactions } from '@/lib/processors/transactionProcessor';
import { handleError, IndexingError } from '@/lib/utils/errorHandler';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const signature = request.headers.get('x-signature');
    
    if (!signature) {
      throw new IndexingError(
        'Missing webhook signature',
        'WEBHOOK_VERIFICATION_FAILED',
        { headers: Object.fromEntries(request.headers) }
      );
    }
    // Get webhook configuration from database
   // ... existing code ...
   const webhook = await prisma.webhook.findFirst({
    where: { heliusWebhookId: body.webhookId }
  });
// ... existing code ...

    if (!webhook) {
      throw new IndexingError(
        'Invalid webhook ID',
        'WEBHOOK_VERIFICATION_FAILED',
        { webhookId: body.webhookId }
      );
    }

    // Verify webhook signature
    const isValid = await verifyWebhookSignature(
      JSON.stringify(body),
      signature,
      webhook.secret
    );

    if (!isValid) {
      throw new IndexingError(
        'Invalid webhook signature',
        'WEBHOOK_VERIFICATION_FAILED',
        { signature }
      );
    }

    // Process transactions
    await processTransactions(body.transactions, webhook.indexingJobId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorResponse = await handleError(error as Error, undefined, {
      endpoint: 'webhook/helius',
      method: 'POST'
    });

    return NextResponse.json(errorResponse, { status: 500 });
  }
} 