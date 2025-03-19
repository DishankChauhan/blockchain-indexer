import { Pool } from 'pg';
import { IndexingJob, IndexingConfig } from '@/types';
import { AppError } from '@/lib/utils/errorHandling';
import { DatabaseService } from './databaseService';
import JobService from './jobService';

// Types for Helius API responses and requests
interface HeliusWebhookRequest {
  accountAddresses: string[];
  programIds: string[];
  webhookURL: string;
  webhookType: 'enhanced';
  authHeader: string;
  txnType: string[];
}

interface HeliusWebhookResponse {
  webhookId: string;
}

interface HeliusErrorResponse {
  message: string;
}

class HeliusError extends Error {
  constructor(message: string, public readonly details?: any) {
    super(message);
    this.name = 'HeliusError';
  }
}

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_API_URL = 'https://api.helius.xyz/v0';

export class HeliusService {
  private static instance: HeliusService;
  private dbService: DatabaseService;
  private jobService: JobService;
  private apiKey: string;
  private baseUrl: string;

  private constructor() {
    this.dbService = DatabaseService.getInstance();
    this.jobService = JobService.getInstance();
    this.apiKey = HELIUS_API_KEY || '';
    this.baseUrl = HELIUS_API_URL;
  }

  public static getInstance(): HeliusService {
    if (!HeliusService.instance) {
      HeliusService.instance = new HeliusService();
    }
    return HeliusService.instance;
  }

  /**
   * Creates a webhook for transaction monitoring
   */
  async createWebhook(params: {
    accountAddresses: string[];
    programIds: string[];
    webhookURL: string;
    webhookSecret: string;
  }): Promise<{ webhookId: string }> {
    const { accountAddresses, programIds, webhookURL, webhookSecret } = params;

    try {
      // Validate webhook URL
      if (!webhookURL || !webhookURL.startsWith('http')) {
        throw new HeliusError('Invalid webhook URL. Must be a valid HTTP(S) URL');
      }

      // Prepare request body
      const webhookRequest: HeliusWebhookRequest = {
        accountAddresses,
        programIds,
        webhookURL,
        webhookType: 'enhanced',
        authHeader: webhookSecret,
        txnType: ['any'],
      };

      // Make API request
      const response = await fetch(`${this.baseUrl}/webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(webhookRequest)
      });

      // Handle error responses
      if (!response.ok) {
        const errorData = await response.json() as HeliusErrorResponse;
        throw new HeliusError(
          `Webhook creation failed: ${errorData.message || response.statusText}`,
          { status: response.status, error: errorData }
        );
      }

      // Parse successful response
      const data = await response.json() as HeliusWebhookResponse;
      return { webhookId: data.webhookId };
    } catch (error) {
      if (error instanceof HeliusError) {
        throw error;
      }
      throw new HeliusError(
        `Failed to create webhook: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }

  /**
   * Deletes a webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/webhooks/${webhookId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json() as HeliusErrorResponse;
        throw new HeliusError(
          `Webhook deletion failed: ${errorData.message || response.statusText}`,
          { status: response.status, error: errorData }
        );
      }
    } catch (error) {
      if (error instanceof HeliusError) {
        throw error;
      }
      throw new HeliusError(
        `Failed to delete webhook: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }

  /**
   * Sets up indexing for a job by creating necessary database tables and webhook
   */
  async setupIndexing(job: IndexingJob, pool: Pool): Promise<void> {
    try {
      // Create necessary tables
      await this.createIndexingTables(pool, job.config);

      // Setup webhook if enabled
      if (job.config.webhook?.enabled && job.config.webhook?.url) {
        const { webhookId } = await this.createWebhook({
          accountAddresses: job.config.filters?.accounts || [],
          programIds: job.config.filters?.programIds || [],
          webhookURL: job.config.webhook.url,
          webhookSecret: job.config.webhook.secret || ''
        });

        // Update job metadata with webhook ID
        await this.updateJobMetadata(job.id, {
          webhookId,
          setupAt: new Date().toISOString()
        });
      }
    } catch (error) {
      throw new HeliusError(
        `Failed to setup indexing: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }

  /**
   * Creates necessary database tables for indexing based on job configuration
   */
  private async createIndexingTables(pool: Pool, config: IndexingConfig): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create tables based on enabled categories
      if (config.categories.transactions) {
        await client.query(`
          CREATE TABLE IF NOT EXISTS transactions (
            id SERIAL PRIMARY KEY,
            signature VARCHAR(100) UNIQUE NOT NULL,
            slot BIGINT NOT NULL,
            timestamp TIMESTAMP NOT NULL,
            success BOOLEAN NOT NULL,
            fee BIGINT NOT NULL,
            program_ids TEXT[],
            raw_data JSONB NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_transactions_signature ON transactions(signature);
          CREATE INDEX IF NOT EXISTS idx_transactions_slot ON transactions(slot);
          CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);
        `);
      }

      if (config.categories.nftEvents) {
        await client.query(`
          CREATE TABLE IF NOT EXISTS nft_events (
            id SERIAL PRIMARY KEY,
            signature VARCHAR(100) UNIQUE NOT NULL,
            mint_address TEXT NOT NULL,
            event_type TEXT NOT NULL,
            price NUMERIC,
            buyer TEXT,
            seller TEXT,
            timestamp TIMESTAMP NOT NULL,
            raw_data JSONB NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_nft_events_signature ON nft_events(signature);
          CREATE INDEX IF NOT EXISTS idx_nft_events_mint ON nft_events(mint_address);
          CREATE INDEX IF NOT EXISTS idx_nft_events_timestamp ON nft_events(timestamp);
        `);
      }

      if (config.categories.tokenTransfers) {
        await client.query(`
          CREATE TABLE IF NOT EXISTS token_transfers (
            id SERIAL PRIMARY KEY,
            signature VARCHAR(100) NOT NULL,
            token_address TEXT NOT NULL,
            from_address TEXT NOT NULL,
            to_address TEXT NOT NULL,
            amount NUMERIC NOT NULL,
            timestamp TIMESTAMP NOT NULL,
            raw_data JSONB NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(signature, token_address)
          );
          CREATE INDEX IF NOT EXISTS idx_token_transfers_signature ON token_transfers(signature);
          CREATE INDEX IF NOT EXISTS idx_token_transfers_token ON token_transfers(token_address);
          CREATE INDEX IF NOT EXISTS idx_token_transfers_timestamp ON token_transfers(timestamp);
        `);
      }

      if (config.categories.programInteractions) {
        await client.query(`
          CREATE TABLE IF NOT EXISTS program_interactions (
            id SERIAL PRIMARY KEY,
            signature VARCHAR(100) NOT NULL,
            program_id TEXT NOT NULL,
            instruction_data JSONB NOT NULL,
            timestamp TIMESTAMP NOT NULL,
            raw_data JSONB NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(signature, program_id)
          );
          CREATE INDEX IF NOT EXISTS idx_program_interactions_signature ON program_interactions(signature);
          CREATE INDEX IF NOT EXISTS idx_program_interactions_program ON program_interactions(program_id);
          CREATE INDEX IF NOT EXISTS idx_program_interactions_timestamp ON program_interactions(timestamp);
        `);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Updates job metadata with webhook information
   */
  private async updateJobMetadata(
    jobId: string,
    metadata: { webhookId: string; setupAt: string }
  ): Promise<void> {
    // Implementation depends on your job storage mechanism
    // This is a placeholder that should be implemented based on your needs
    console.log('Updating job metadata:', { jobId, metadata });
  }

  /**
   * Processes webhook data by inserting it into appropriate tables
   */
  async processWebhookData(pool: Pool, data: any[], config: IndexingConfig): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const transaction of data) {
        if (config.categories.transactions) {
          await this.insertTransaction(client, transaction);
        }
        if (config.categories.nftEvents && transaction.nftEvents) {
          await this.insertNFTEvents(client, transaction);
        }
        if (config.categories.tokenTransfers && transaction.tokenTransfers) {
          await this.insertTokenTransfers(client, transaction);
        }
        if (config.categories.programInteractions && transaction.programIds) {
          await this.insertProgramInteractions(client, transaction);
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw new HeliusError('Failed to process webhook data', error);
    } finally {
      client.release();
    }
  }

  private async insertTransaction(client: any, tx: any): Promise<void> {
    await client.query(
      `INSERT INTO transactions (
        signature, slot, timestamp, success, fee, program_ids, raw_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (signature) DO NOTHING`,
      [
        tx.signature,
        tx.slot,
        new Date(tx.timestamp * 1000),
        tx.success,
        tx.fee,
        tx.programIds,
        tx
      ]
    );
  }

  private async insertNFTEvents(client: any, tx: any): Promise<void> {
    for (const event of tx.nftEvents) {
      await client.query(
        `INSERT INTO nft_events (
          signature, mint_address, event_type, price, buyer, seller, timestamp, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (signature) DO NOTHING`,
        [
          tx.signature,
          event.mint,
          event.type,
          event.amount,
          event.buyer,
          event.seller,
          new Date(tx.timestamp * 1000),
          event
        ]
      );
    }
  }

  private async insertTokenTransfers(client: any, tx: any): Promise<void> {
    for (const transfer of tx.tokenTransfers) {
      await client.query(
        `INSERT INTO token_transfers (
          signature, token_address, from_address, to_address, amount, timestamp, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (signature, token_address) DO NOTHING`,
        [
          tx.signature,
          transfer.token,
          transfer.fromAddress,
          transfer.toAddress,
          transfer.amount,
          new Date(tx.timestamp * 1000),
          transfer
        ]
      );
    }
  }

  private async insertProgramInteractions(client: any, tx: any): Promise<void> {
    for (const programId of tx.programIds) {
      await client.query(
        `INSERT INTO program_interactions (
          signature, program_id, instruction_data, timestamp, raw_data
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (signature, program_id) DO NOTHING`,
        [
          tx.signature,
          programId,
          tx.instructions?.filter((i: any) => i.programId === programId) || [],
          new Date(tx.timestamp * 1000),
          tx
        ]
      );
    }
  }
} 