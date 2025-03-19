import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { jobId, status, data } = body;

    // Verify webhook secret
    const webhookSecret = req.headers.get('x-webhook-secret');
    const job = await prisma.indexingJob.findUnique({
      where: { id: jobId },
      include: { webhooks: true }
    });

    if (!job || !job.webhooks[0] || job.webhooks[0].secret !== webhookSecret) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Update job status
    await prisma.indexingJob.update({
      where: { id: jobId },
      data: { status }
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: job.userId,
        type: 'indexing_update',
        message: `Indexing job ${jobId} status: ${status}`,
        status: 'unread',
        metadata: data
      }
    });

    return NextResponse.json({ message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Webhook error:', error);
    return new NextResponse('Failed to process webhook', { status: 500 });
  }
} 