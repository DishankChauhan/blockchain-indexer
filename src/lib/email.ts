import sgMail from '@sendgrid/mail';

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
    console.warn('SendGrid API key not configured. Skipping email notification.');
    return false;
  }

  try {
    await sgMail.send({
      ...options,
      from: process.env.EMAIL_FROM || 'noreply@blockchainindexer.com',
    });
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
} 