import axios from 'axios';
import { AppError } from '@/lib/utils/errorHandling';
import { DatabaseService } from './databaseService';
import { JobService } from './jobService';
import { IndexingJob } from '@/types';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_API_URL = `https://api.helius.xyz/v0`;

export class HeliusService {
  private static instance: HeliusService;
  private dbService: DatabaseService;
  private jobService: JobService;

  private constructor() {
    this.dbService = DatabaseService.getInstance();
    this.jobService = JobService.getInstance();
  }

  public static getInstance(): HeliusService {
    if (!HeliusService.instance) {
      HeliusService.instance = new HeliusService();
    }
    return HeliusService.instance;
  }

  private async createWebhook(
    jobId: string,
    webhookUrl: string,
    accountAddresses: string[]
  ): Promise<string> {
    try {
      const response = await axios.post(
        `${HELIUS_API_URL}/webhooks`,
        {
          webhookURL: webhookUrl,
          accountAddresses,
          transactionTypes: ['ANY'],
          webhookType: 'enhanced',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${HELIUS_API_KEY}`,
          },
        }
      );

      const responseData = response.data as { webhookID: string };
      return responseData.webhookID;
    } catch (error) {
      throw new AppError(
        'Failed to create Helius webhook'
      );
    }
  }

  private async deleteWebhook(webhookId: string): Promise<void> {
    try {
      await axios.delete(`${HELIUS_API_URL}/webhooks/${webhookId}`, {
        headers: {
          'Authorization': `Bearer ${HELIUS_API_KEY}`,
        },
      });
    } catch (error) {
      console.error('Failed to delete Helius webhook:', error);
    }
  }

  public async setupIndexing(job: IndexingJob): Promise<void> {
    try {
      const { config, dbConnectionId } = job;
      const pool = await this.dbService.getConnection(dbConnectionId, job.userId);

      // Create necessary tables if they don't exist
      await this.createIndexingTables(pool, config);

      // Setup webhook if enabled
      if (config.webhook.enabled && config.webhook.url) {
        const webhookId = await this.createWebhook(
          job.id,
          config.webhook.url,
          config.filters.accounts || []
        );

        // Save webhook ID
        await this.jobService.updateJobMetadata(job.id, {
          webhookId,
          setupAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        'Failed to setup indexing'
      );
    }
  }

  private async createIndexingTables(pool: any, config: any): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create tables based on enabled categories
      if (config.categories.transactions) {
        await client.query(`
          CREATE TABLE IF NOT EXISTS solana_transactions (
            signature TEXT PRIMARY KEY,
            block_time TIMESTAMP,
            slot BIGINT,
            success BOOLEAN,
            fee BIGINT,
            fee_payer TEXT,
            program_ids TEXT[],
            raw_data JSONB
          );
        `);
      }

      if (config.categories.nftEvents) {
        await client.query(`
          CREATE TABLE IF NOT EXISTS nft_events (
            signature TEXT PRIMARY KEY,
            block_time TIMESTAMP,
            mint_address TEXT,
            event_type TEXT,
            price NUMERIC,
            buyer TEXT,
            seller TEXT,
            raw_data JSONB
          );
        `);
      }

      if (config.categories.tokenTransfers) {
        await client.query(`
          CREATE TABLE IF NOT EXISTS token_transfers (
            signature TEXT,
            block_time TIMESTAMP,
            token_address TEXT,
            from_address TEXT,
            to_address TEXT,
            amount NUMERIC,
            raw_data JSONB,
            PRIMARY KEY (signature, token_address)
          );
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

  public async handleWebhookData(
    jobId: string,
    userId: string,
    data: any[]
  ): Promise<void> {
    try {
      const job = await this.jobService.getJob(jobId, userId);
      const pool = await this.dbService.getConnection(job.dbConnectionId, job.userId);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        for (const transaction of data) {
          await this.processTransaction(client, transaction, job.config);
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      throw new AppError(
        'Failed to process webhook data'
      );
    }
  }

  private async processTransaction(
    client: any,
    transaction: any,
    config: any
  ): Promise<void> {
    const {
      signature,
      timestamp,
      slot,
      success,
      fee,
      feePayer,
      programIds,
      nftEvents,
      tokenTransfers,
    } = transaction;

    // Insert transaction data if enabled
    if (config.categories.transactions) {
      await client.query(
        `
        INSERT INTO solana_transactions (
          signature, block_time, slot, success, fee, fee_payer, program_ids, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (signature) DO NOTHING
        `,
        [
          signature,
          new Date(timestamp * 1000),
          slot,
          success,
          fee,
          feePayer,
          programIds,
          transaction,
        ]
      );
    }

    // Process NFT events if enabled
    if (config.categories.nftEvents && nftEvents) {
      for (const event of nftEvents) {
        await client.query(
          `
          INSERT INTO nft_events (
            signature, block_time, mint_address, event_type, price, buyer, seller, raw_data
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (signature) DO NOTHING
          `,
          [
            signature,
            new Date(timestamp * 1000),
            event.mint,
            event.type,
            event.amount,
            event.buyer,
            event.seller,
            event,
          ]
        );
      }
    }

    // Process token transfers if enabled
    if (config.categories.tokenTransfers && tokenTransfers) {
      for (const transfer of tokenTransfers) {
        await client.query(
          `
          INSERT INTO token_transfers (
            signature, block_time, token_address, from_address, to_address, amount, raw_data
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (signature, token_address) DO NOTHING
          `,
          [
            signature,
            new Date(timestamp * 1000),
            transfer.token,
            transfer.fromAddress,
            transfer.toAddress,
            transfer.amount,
            transfer,
          ]
        );
      }
    }
  }

  public async cleanup(jobId: string, userId: string): Promise<void> {
    const job = await this.jobService.getJob(jobId, userId);
    const metadata: { webhookId?: string } = job.metadata || {};

    if (metadata.webhookId) {
      await this.deleteWebhook(metadata.webhookId);
    }
  }
} 