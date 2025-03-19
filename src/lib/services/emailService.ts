import sgMail from '@sendgrid/mail';
import AppLogger from '@/lib/utils/logger';
import { AppError } from '@/lib/utils/errorHandling';

// Initialize SendGrid with API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export class EmailService {
  private static instance: EmailService;
  private readonly fromEmail: string;

  private constructor() {
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@your-domain.com';
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      await sgMail.send({
        to: options.to,
        from: this.fromEmail,
        subject: options.subject,
        text: options.text,
        html: options.html || options.text
      });
      return true;
    } catch (error) {
      AppLogger.error('Failed to send email', error as Error, {
        component: 'EmailService',
        action: 'sendEmail',
        to: options.to,
        template: options.text
      });
      throw new AppError('Failed to send email');
    }
  }
} 