import prisma from '@/lib/prisma';
import sgMail from '@sendgrid/mail';
import { handleError, IndexingError } from '@/lib/utils/errorHandler';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export type NotificationType = 'error' | 'warning' | 'info' | 'success';
export type NotificationChannel = 'email' | 'webhook' | 'database';

interface NotificationOptions {
  userId?: string;
  channel?: NotificationChannel[];
  priority?: 'low' | 'medium' | 'high';
  metadata?: Record<string, any>;
}

const EMAIL_TEMPLATES = {
  error: {
    subject: 'Error Alert - Blockchain Indexer',
    color: '#DC2626',
  },
  warning: {
    subject: 'Warning Notice - Blockchain Indexer',
    color: '#F59E0B',
  },
  info: {
    subject: 'Information Update - Blockchain Indexer',
    color: '#3B82F6',
  },
  success: {
    subject: 'Success Notification - Blockchain Indexer',
    color: '#10B981',
  },
};

export async function sendNotification(
  message: string,
  type: NotificationType,
  options: NotificationOptions = {}
) {
  const { userId, channel = ['database'], priority = 'medium', metadata } = options;

  try {
    // Store notification in database
    const notification = await prisma.notification.create({
      data: {
        message,
        type,
        priority,
        userId,
        channel,
        metadata,
        status: 'unread',
      },
    });

    // Send email notifications if configured
    if (channel.includes('email') && process.env.SENDGRID_API_KEY) {
      await sendEmailNotification(message, type, userId);
    }

    // Send webhook notifications if configured
    if (channel.includes('webhook') && userId) {
      await sendWebhookNotification(message, type, userId);
    }

    return notification;
  } catch (error) {
    throw new IndexingError(
      'Failed to send notification',
      'NOTIFICATION_FAILED',
      { message, type, options, error }
    );
  }
}

async function sendEmailNotification(
  message: string,
  type: NotificationType,
  userId?: string
) {
  if (!userId || !process.env.SENDGRID_API_KEY) return;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (!user?.email) {
      throw new IndexingError(
        'User email not found',
        'EMAIL_NOT_FOUND',
        { userId }
      );
    }

    const template = EMAIL_TEMPLATES[type];
    const html = generateEmailTemplate(message, type, user.name);

    const msg = {
      to: user.email,
      from: process.env.EMAIL_FROM || 'noreply@blockchainindexer.com',
      subject: template.subject,
      html,
    };

    await sgMail.send(msg);
  } catch (error) {
    throw new IndexingError(
      'Failed to send email notification',
      'EMAIL_SEND_FAILED',
      { userId, message, type, error }
    );
  }
}

async function sendWebhookNotification(
  message: string,
  type: NotificationType,
  userId: string
) {
  try {
    const webhookEndpoints = await prisma.notificationWebhook.findMany({
      where: {
        userId,
        enabled: true,
      },
    });

    const failedEndpoints: string[] = [];
    const timestamp = new Date().toISOString();

    await Promise.all(
      webhookEndpoints.map(async (endpoint) => {
        try {
          const response = await fetch(endpoint.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Secret': endpoint.secret,
              'X-Timestamp': timestamp,
            },
            body: JSON.stringify({
              message,
              type,
              timestamp,
              metadata: {
                webhookId: endpoint.id,
                userId,
              },
            }),
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
        } catch (error) {
          failedEndpoints.push(endpoint.url);
          // Log the error but don't throw to allow other webhooks to process
          await handleError(error as Error, userId, {
            component: 'webhookNotification',
            endpoint: endpoint.url,
          });
        }
      })
    );

    if (failedEndpoints.length > 0) {
      throw new IndexingError(
        'Some webhook notifications failed',
        'WEBHOOK_PARTIAL_FAILURE',
        { failedEndpoints }
      );
    }
  } catch (error) {
    throw new IndexingError(
      'Failed to send webhook notifications',
      'WEBHOOK_SEND_FAILED',
      { userId, message, type, error }
    );
  }
}

function generateEmailTemplate(message: string, type: NotificationType, userName?: string): string {
  const template = EMAIL_TEMPLATES[type];
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          .container { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${template.color}; color: white; padding: 20px; border-radius: 5px; }
          .content { padding: 20px; background-color: #f9fafb; border-radius: 5px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 0.875rem; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${template.subject}</h1>
          </div>
          <div class="content">
            ${userName ? `<p>Hello ${userName},</p>` : ''}
            <p>${message}</p>
          </div>
          <div class="footer">
            <p>This is an automated message from Blockchain Indexer. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;
} 