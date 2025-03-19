import { Pool } from 'pg';
import { IndexingJob, IndexingConfig } from '@/types';
import { AppError } from '@/lib/utils/errorHandling';
import { DatabaseService } from './databaseService';
import JobService from './jobService';
import AppLogger from '@/lib/utils/logger';
import { SecretsManager } from '@/lib/utils/secrets';
import { RateLimiter } from '@/lib/utils/rateLimiter';
import { CircuitBreaker } from '@/lib/utils/circuitBreaker';
import {
  HeliusTransaction,
  HeliusWebhookData,
  HeliusWebhookRequest,
  HeliusWebhookResponse,
  HeliusErrorResponse,
  HeliusProcessingResult
} from '@/lib/types/helius';
import { NFTBidService } from './nftBidService';
import { NFTPriceService } from './nftPriceService';
import { LendingService } from './lendingService';
import { TokenPriceService } from './tokenPriceService';

class HeliusError extends Error {
  constructor(message: string, public readonly details?: any) {
    super(message);
    this.name = 'HeliusError';
  }
}

const HELIUS_API_URL = 'https://api.helius.xyz/v0';

interface JobMetadata {
  lastProcessedTimestamp: number;
  processedCount: number;
  errorCount: number;
}

export class HeliusService {
  private static instance: HeliusService;
  private readonly dbService: DatabaseService;
  private readonly userId: string;
  private jobService: JobService;
  private secretsManager: SecretsManager;
  private rateLimiter: RateLimiter;
  private circuitBreaker: CircuitBreaker;
  private baseUrl: string;

  private constructor(userId: string) {
    this.dbService = DatabaseService.getInstance();
    this.userId = userId;
    this.jobService = JobService.getInstance();
    this.secretsManager = SecretsManager.getInstance();
    this.rateLimiter = RateLimiter.getInstance();
    this.circuitBreaker = CircuitBreaker.getInstance();
    this.baseUrl = HELIUS_API_URL;
  }

  public static getInstance(userId: string): HeliusService {
    if (!HeliusService.instance) {
      HeliusService.instance = new HeliusService(userId);
    }
    return HeliusService.instance;
  }

  private async getApiKey(): Promise<string> {
    try {
      return await this.secretsManager.getSecret('HELIUS_API_KEY');
    } catch (error) {
      const apiKey = process.env.HELIUS_API_KEY;
      if (!apiKey) {
        throw new AppError('Helius API key not found');
      }
      await this.secretsManager.setSecret('HELIUS_API_KEY', apiKey);
      return apiKey;
    }
  }

  private async makeRequest<T>(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<T> {
    // Check rate limit
    if (!(await this.rateLimiter.waitForToken('helius'))) {
      throw new AppError('Rate limit exceeded for Helius API');
    }

    return this.circuitBreaker.executeWithRetry('helius', async () => {
      const apiKey = await this.getApiKey();
      const url = new URL(endpoint, this.baseUrl);
      url.searchParams.append('api-key', apiKey);

      const response = await fetch(url.toString(), {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorData = await response.json() as HeliusErrorResponse;
        throw new HeliusError(errorData.message || 'API request failed', {
          status: response.status,
          statusText: response.statusText,
        });
      }

      return await response.json() as T;
    });
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

      // Get API key
      const apiKey = await this.getApiKey();

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
          'Authorization': `Bearer ${apiKey}`
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
      const apiKey = await this.getApiKey();
      
      const response = await fetch(`${this.baseUrl}/webhooks/${webhookId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiKey}`
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
    AppLogger.info('Updating job metadata', {
      component: 'HeliusService',
      action: 'updateJobMetadata',
      jobId,
      metadata: JSON.stringify(metadata)
    });
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

  public async handleWebhookData(
    jobId: string,
    userId: string,
    data: HeliusWebhookData[]
  ): Promise<HeliusProcessingResult> {
    try {
      AppLogger.info('Processing webhook data', {
        component: 'HeliusService',
        action: 'handleWebhookData',
        jobId,
        userId,
        dataCount: data.length
      });

      let transactionsProcessed = 0;
      const errors: Array<{ signature: string; error: string }> = [];

      for (const transaction of data) {
        try {
          // Validate transaction data
          if (!transaction.signature || !transaction.timestamp) {
            throw new Error('Invalid transaction data: missing required fields');
          }

          // Process based on transaction type
          switch (transaction.type) {
            case 'NFT_SALE':
              await this.processNFTTransaction(transaction, userId);
              break;
            case 'TOKEN_TRANSFER':
              await this.processTokenTransfer(transaction, userId);
              break;
            case 'PROGRAM_INTERACTION':
              await this.processProgramInteraction(transaction, userId);
              break;
            case 'LENDING_PROTOCOL':
              await this.processLendingProtocol(transaction, userId);
              break;
            default:
              await this.processGenericTransaction(transaction, userId);
          }

          transactionsProcessed++;
        } catch (error) {
          AppLogger.error('Failed to process transaction', error as Error, {
            component: 'HeliusService',
            action: 'handleWebhookData',
            jobId,
            signature: transaction.signature
          });

          errors.push({
            signature: transaction.signature,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Log processing stats
      AppLogger.info('Webhook data processing completed', {
        component: 'HeliusService',
        action: 'handleWebhookData',
        jobId,
        transactionsProcessed,
        errorCount: errors.length
      });

      return {
        success: errors.length === 0,
        transactionsProcessed,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      AppLogger.error('Failed to handle webhook data', error as Error, {
        component: 'HeliusService',
        action: 'handleWebhookData',
        jobId,
        userId
      });
      throw error;
    }
  }

  private async processNFTTransaction(transaction: HeliusWebhookData, connectionId: string): Promise<void> {
    try {
      // Process NFT events
      const nftEvents = transaction.events.filter(event => 
        event.type === 'NFT_SALE' || 
        event.type === 'NFT_LISTING' || 
        event.type === 'NFT_GLOBAL_LISTING' ||
        event.type === 'NFT_CANCEL_LISTING' ||
        event.type === 'BID_PLACED' ||
        event.type === 'BID_CANCELLED' ||
        event.type === 'BID_ACCEPTED'
      );

      if (!nftEvents.length) {
        return;
      }

      // Get database pool for the connection
      const pool = await this.dbService.getConnection(connectionId, this.userId);
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        // Process NFT bids
        const bidService = NFTBidService.getInstance();
        await bidService.processBidEvent(transaction, client);

        // Process NFT prices
        const priceService = NFTPriceService.getInstance();
        await priceService.processPriceEvent(transaction, client);

        // Process other NFT events
        for (const event of nftEvents) {
          const eventData = event.data as Record<string, any>;
          await client.query(
            `INSERT INTO nft_events (
              signature,
              mint_address,
              event_type,
              price,
              buyer,
              seller,
              timestamp,
              raw_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (signature) DO NOTHING`,
            [
              transaction.signature,
              eventData.mint || eventData.mintAddress,
              event.type,
              eventData.amount || eventData.price || 0,
              eventData.buyer || eventData.newOwner,
              eventData.seller || eventData.owner,
              new Date(transaction.timestamp),
              event
            ]
          );
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      AppLogger.error('Failed to process NFT transaction', error as Error, {
        component: 'HeliusService',
        action: 'processNFTTransaction',
        signature: transaction.signature
      });
      throw error;
    }
  }

  private async processTokenTransfer(transaction: HeliusWebhookData, connectionId: string): Promise<void> {
    try {
      if (!transaction.nativeTransfers?.length) {
        throw new Error('No token transfers found in transaction');
      }

      // Get database pool for the connection
      const pool = await this.dbService.getConnection(connectionId, this.userId);
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        // Process native SOL transfers
        for (const transfer of transaction.nativeTransfers) {
          await client.query(
            `INSERT INTO token_transfers (
              signature,
              token_address,
              from_address,
              to_address,
              amount,
              timestamp,
              raw_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (signature, token_address) DO NOTHING`,
            [
              transaction.signature,
              'SOL', // Native SOL transfers
              transfer.fromUserAccount,
              transfer.toUserAccount,
              transfer.amount / 1e9, // Convert lamports to SOL
              new Date(transaction.timestamp),
              transfer
            ]
          );
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      AppLogger.error('Failed to process token transfer', error as Error, {
        component: 'HeliusService',
        action: 'processTokenTransfer',
        signature: transaction.signature
      });
      throw error;
    }
  }

  private async processProgramInteraction(transaction: HeliusWebhookData, connectionId: string): Promise<void> {
    try {
      if (!transaction.accountData?.length) {
        throw new Error('No program interactions found in transaction');
      }

      // Get database pool for the connection
      const pool = await this.dbService.getConnection(connectionId, this.userId);
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        for (const interaction of transaction.accountData) {
          await client.query(
            `INSERT INTO program_interactions (
              signature,
              program_id,
              instruction_data,
              timestamp,
              raw_data
            ) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (signature, program_id) DO NOTHING`,
            [
              transaction.signature,
              interaction.program,
              interaction.data,
              new Date(transaction.timestamp),
              interaction
            ]
          );
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      AppLogger.error('Failed to process program interaction', error as Error, {
        component: 'HeliusService',
        action: 'processProgramInteraction',
        signature: transaction.signature
      });
      throw error;
    }
  }

  private async processLendingProtocol(transaction: HeliusWebhookData, connectionId: string): Promise<void> {
    try {
      // Get database pool for the connection
      const pool = await this.dbService.getConnection(connectionId, this.userId);
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        // Process lending protocol events
        const lendingService = LendingService.getInstance();
        await lendingService.processLendingEvent(transaction, client);

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      AppLogger.error('Failed to process lending protocol transaction', error as Error, {
        component: 'HeliusService',
        action: 'processLendingProtocol',
        signature: transaction.signature
      });
      throw error;
    }
  }

  private async processGenericTransaction(transaction: HeliusWebhookData, connectionId: string): Promise<void> {
    try {
      // Get database pool for the connection
      const pool = await this.dbService.getConnection(connectionId, this.userId);
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        // Store the basic transaction data
        await client.query(
          `INSERT INTO transactions (
            signature,
            slot,
            timestamp,
            success,
            fee,
            program_ids,
            raw_data
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (signature) DO NOTHING`,
          [
            transaction.signature,
            transaction.slot,
            new Date(transaction.timestamp),
            transaction.status === 'success',
            transaction.fee,
            transaction.accountData.map(acc => acc.program),
            transaction
          ]
        );

        // Process token prices if this is a DEX/aggregator transaction
        const tokenPriceService = TokenPriceService.getInstance();
        await tokenPriceService.processPriceEvent(transaction, client);

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      AppLogger.error('Failed to process generic transaction', error as Error, {
        component: 'HeliusService',
        action: 'processGenericTransaction',
        signature: transaction.signature
      });
      throw error;
    }
  }
} 