import crypto from 'crypto';

export function verifyWebhookSignature(
  payload: any,
  signature: string | null,
  timestamp: string | null
): boolean {
  if (!signature || !timestamp || !process.env.WEBHOOK_SECRET) {
    return false;
  }

  const message = `${timestamp}.${JSON.stringify(payload)}`;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(message)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
} 