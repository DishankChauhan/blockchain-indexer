import sgMail from '@sendgrid/mail';
import AppLogger from './utils/logger';

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

const isEmailConfigured = !!process.env.SENDGRID_API_KEY;

if (isEmailConfigured) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!isEmailConfigured) {
    AppLogger.warn('SendGrid API key not configured', {
      component: 'EmailService',
      action: 'SendEmail',
      skipped: true,
      recipient: options.to
    });
    return false;
  }

  try {
    await sgMail.send({
      ...options,
      from: process.env.EMAIL_FROM || 'noreply@blockchainindexer.com',
    });
    
    AppLogger.info('Email sent successfully', {
      component: 'EmailService',
      action: 'SendEmail',
      recipient: options.to,
      subject: options.subject
    });
    
    return true;
  } catch (error) {
    AppLogger.error('Failed to send email', error as Error, {
      component: 'EmailService',
      action: 'SendEmail',
      recipient: options.to,
      subject: options.subject
    });
    return false;
  }
} 