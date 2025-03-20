import { AppError } from './errorHandling';
import { logError, logInfo, logWarn } from './serverLogger';
import crypto from 'crypto';

interface EncryptedSecret {
  iv: string;
  encryptedData: string;
}

export class SecretsManager {
  private static instance: SecretsManager;
  private encryptionKey: Buffer;
  private secrets: Map<string, string> = new Map();
  private rotationSchedule: Map<string, number> = new Map();

  private constructor() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new AppError('Encryption key not found in environment variables');
    }
    // Use SHA-256 to ensure key is proper length
    this.encryptionKey = crypto.createHash('sha256').update(key).digest();
  }

  public static getInstance(): SecretsManager {
    if (!SecretsManager.instance) {
      SecretsManager.instance = new SecretsManager();
    }
    return SecretsManager.instance;
  }

  private encrypt(text: string): EncryptedSecret {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return {
      iv: iv.toString('hex'),
      encryptedData: encrypted
    };
  }

  private decrypt(encrypted: EncryptedSecret): string {
    const iv = Buffer.from(encrypted.iv, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    let decrypted = decipher.update(encrypted.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  public async setSecret(key: string, value: string, rotationPeriodDays: number = 30): Promise<void> {
    try {
      const encrypted = this.encrypt(value);
      this.secrets.set(key, JSON.stringify(encrypted));
      this.rotationSchedule.set(key, Date.now() + (rotationPeriodDays * 24 * 60 * 60 * 1000));

      logInfo('Secret stored successfully', {
        message: `Secret stored successfully for key ${key}. Rotation due: ${new Date(this.rotationSchedule.get(key) || 0).toISOString()}`
      });
    } catch (error) {
      const err = error as Error;
      logError('Failed to store secret', {
        message: err.message,
        name: err.name,
        stack: err.stack
      });
      throw new AppError('Failed to store secret');
    }
  }

  public async getSecret(key: string): Promise<string> {
    try {
      const encryptedValue = this.secrets.get(key);
      if (!encryptedValue) {
        throw new AppError(`Secret not found: ${key}`);
      }

      const encrypted = JSON.parse(encryptedValue) as EncryptedSecret;
      const decrypted = this.decrypt(encrypted);

      // Check if rotation is needed
      const rotationDue = this.rotationSchedule.get(key);
      if (rotationDue && Date.now() > rotationDue) {
        logWarn('Secret rotation needed', {
          message: `Secret rotation needed for key ${key}. Due date: ${new Date(rotationDue).toISOString()}`
        });
      }

      return decrypted;
    } catch (error) {
      const err = error as Error;
      logError('Failed to retrieve secret', {
        message: err.message,
        name: err.name,
        stack: err.stack
      });
      throw new AppError('Failed to retrieve secret');
    }
  }

  public async rotateSecret(key: string, newValue: string, rotationPeriodDays: number = 30): Promise<void> {
    try {
      await this.setSecret(key, newValue, rotationPeriodDays);
      logInfo('Secret rotated successfully', {
        message: `Secret rotated successfully for key ${key}. Next rotation due: ${new Date(this.rotationSchedule.get(key) || 0).toISOString()}`
      });
    } catch (error) {
      const err = error as Error;
      logError('Failed to rotate secret', {
        message: err.message,
        name: err.name,
        stack: err.stack
      });
      throw new AppError('Failed to rotate secret');
    }
  }
} 