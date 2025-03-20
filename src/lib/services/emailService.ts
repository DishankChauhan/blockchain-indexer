import sgMail from '@sendgrid/mail';
import { logError } from '@/lib/utils/serverLogger';
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
  private static instance: EmailService | null = null;
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
      logError('Failed to send email', error as Error, {
        component: 'EmailService',
        action: 'sendEmail',
        to: options.to,
        template: options.text
      });
      throw new AppError('Failed to send email');
    }
  }

  /**
   * Cleanup resources used by the service.
   * This includes cleaning up any open connections or resources.
   */
  public async cleanup(): Promise<void> {
    try {
      // Reset singleton instance
      EmailService.instance = null;
    } catch (error) {
      logError('Failed to cleanup EmailService', error as Error, {
        component: 'EmailService',
        action: 'cleanup'
      });
      // Don't throw here as this is a cleanup operation
    }
  }
} 