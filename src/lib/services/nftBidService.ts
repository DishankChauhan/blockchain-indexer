import { Pool } from 'pg';
import { logError, logInfo } from '@/lib/utils/serverLogger';
import { AppError } from '@/lib/utils/errorHandling';
import { HeliusWebhookData } from '../types/helius';
import { RateLimiter } from 'limiter';

export interface NFTBid {
  mintAddress: string;
  bidderAddress: string;
  bidAmount: number;
  marketplace: string;
  currency: string;
  status: 'active' | 'cancelled' | 'accepted' | 'expired';
  expiryTime?: Date;
  timestamp: Date;
  signature: string;
  rawData: any;
}

export interface ActiveBids {
  mintAddress: string;
  marketplace: string;
  currency: string;
  totalBids: number;
  minBid: number;
  maxBid: number;
  avgBid: number;
  bids: Array<{
    bidder: string;
    amount: number;
    timestamp: Date;
  }>;
}

export class NFTBidService {
  private static instance: NFTBidService | undefined;
  private readonly baseUrl: string;
  private readonly marketplacePrograms: Map<string, string>;

  private constructor() {
    this.baseUrl = process.env.HELIUS_API_URL || 'https://api.helius.xyz/v0';
    this.marketplacePrograms = new Map([
      ['M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K', 'Magic Eden'],
      ['HYPERfwdTjyJ2SCaKHmpF2MtrXqWxrsotYDsTrshHWq8', 'HyperSpace'],
      ['TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAsbdwmHbN', 'Tensor'],
      ['CJsLwbP1iu5DuUikHEJnLfANgKy6stB2uFgvBBHoyxwz', 'Solanart']
    ]);
  }

  public static getInstance(): NFTBidService {
    if (!NFTBidService.instance) {
      NFTBidService.instance = new NFTBidService();
    }
    return NFTBidService.instance;
  }

  public async fetchAndStoreData(pool: Pool): Promise<void> {
    try {
      logInfo('Starting NFT bid data fetch', {
        component: 'NFTBidService',
        action: 'fetchAndStoreData'
      });

      // Get API key from environment
      const apiKey = process.env.HELIUS_API_KEY;
      if (!apiKey) {
        throw new AppError('HELIUS_API_KEY not found in environment');
      }

      // Initialize rate limiter for API calls
      const rateLimiter = new RateLimiter({
        tokensPerInterval: 50,
        interval: 'second'
      });

      // Get the latest processed timestamp
      const lastProcessed = await this.getLastProcessedTimestamp(pool);
      const currentTime = Math.floor(Date.now() / 1000);

      // Fetch data in batches
      const batchSize = 100;
      let startTime = lastProcessed || (currentTime - 24 * 60 * 60); // Start from 24 hours ago if no last processed
      
      while (startTime < currentTime) {
        // Wait for rate limit token
        await rateLimiter.removeTokens(1);

        const endTime = Math.min(startTime + 3600, currentTime); // Process 1 hour at a time
        
        // Fetch bid events from Helius API
        const response = await fetch(`${this.baseUrl}/nft-events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            query: {
              types: ['NFT_BID', 'NFT_BID_CANCELLED', 'NFT_BID_ACCEPTED'],
              timeStart: startTime,
              timeEnd: endTime
            },
            options: {
              limit: batchSize
            }
          })
        });

        if (!response.ok) {
          throw new AppError(`Failed to fetch NFT events: ${response.statusText}`);
        }

        const events = await response.json();
        
        // Process events in transaction
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          for (const event of events) {
            const bid: NFTBid = {
              mintAddress: event.nft.mint,
              bidderAddress: event.bidder,
              bidAmount: event.amount,
              marketplace: this.getMarketplace(event),
              currency: event.currency || 'SOL',
              status: this.getBidStatus(event.type),
              expiryTime: event.expiryTime ? new Date(event.expiryTime) : undefined,
              timestamp: new Date(event.timestamp * 1000),
              signature: event.signature,
              rawData: event
            };

            await client.query(`
              INSERT INTO nft_bids (
                signature,
                mint_address,
                bidder_address,
                bid_amount,
                marketplace,
                status,
                expires_at,
                timestamp,
                raw_data
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT (signature) DO UPDATE SET
                status = EXCLUDED.status,
                raw_data = EXCLUDED.raw_data
            `, [
              bid.signature,
              bid.mintAddress,
              bid.bidderAddress,
              bid.bidAmount,
              bid.marketplace,
              bid.status,
              bid.expiryTime,
              bid.timestamp,
              bid.rawData
            ]);
          }

          // Update last processed timestamp
          await client.query(`
            INSERT INTO indexer_state (key, value, updated_at)
            VALUES ('nft_bids_last_processed', $1, NOW())
            ON CONFLICT (key) DO UPDATE SET
              value = EXCLUDED.value,
              updated_at = EXCLUDED.updated_at
          `, [endTime.toString()]);

          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }

        // Update start time for next batch
        startTime = endTime;

        logInfo('Processed NFT bid batch', {
          component: 'NFTBidService',
          action: 'fetchAndStoreData',
          startTime,
          endTime,
          eventsProcessed: events.length
        });
      }

      logInfo('Completed NFT bid data fetch', {
        component: 'NFTBidService',
        action: 'fetchAndStoreData'
      });
    } catch (error) {
      logError('Failed to fetch and store NFT bid data', error as Error, {
        component: 'NFTBidService',
        action: 'fetchAndStoreData'
      });
      throw new AppError('Failed to fetch and store NFT bid data');
    }
  }

  private async getLastProcessedTimestamp(pool: Pool): Promise<number | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT value::bigint as timestamp
        FROM indexer_state
        WHERE key = 'nft_bids_last_processed'
      `);
      return result.rows[0]?.timestamp || null;
    } finally {
      client.release();
    }
  }

  public async processBidEvent(
    webhookData: HeliusWebhookData,
    client: Pool
  ): Promise<void> {
    try {
      logInfo('Processing NFT bid events', {
        component: 'NFTBidService',
        action: 'processBidEvent',
        signature: webhookData.signature
      });

      // Extract bid data from webhook
      const bidData = this.extractBidData(webhookData);
      if (!bidData) return;

      // Insert or update bid data
      await this.upsertBid(bidData, client);

    } catch (error) {
      logError('Failed to process bid event', error as Error, {
        component: 'NFTBidService',
        action: 'processBidEvent',
        signature: webhookData.signature
      });
      throw error;
    }
  }

  private extractBidData(webhookData: HeliusWebhookData): any {
    // Implementation of bid data extraction
    return null;
  }

  public async getActiveBids(mintAddress: string, pool: Pool): Promise<any> {
    try {
      const result = await pool.query(`
        SELECT * FROM active_nft_bids
        WHERE mint_address = $1
      `, [mintAddress]);

      return result.rows[0]?.bids || [];
    } catch (error) {
      logError('Failed to get active bids', error as Error, {
        component: 'NFTBidService',
        action: 'getActiveBids',
        mintAddress
      });
      throw error;
    }
  }

  private async upsertBid(bidData: any, client: Pool): Promise<void> {
    try {
      logInfo('Processed NFT bid', {
        component: 'NFTBidService',
        action: 'upsertBid',
        mintAddress: bidData.mintAddress
      });

      // Implementation of bid upsert logic
    } catch (error) {
      logError('Failed to upsert bid', error as Error, {
        component: 'NFTBidService',
        action: 'upsertBid',
        mintAddress: bidData.mintAddress
      });
      throw error;
    }
  }

  public async cleanup(): Promise<void> {
    NFTBidService.instance = undefined;
  }

  private getMarketplace(transaction: HeliusWebhookData): string {
    // Check program interactions to determine marketplace
    for (const account of transaction.accountData) {
      const marketplace = this.marketplacePrograms.get(account.program);
      if (marketplace) {
        return marketplace;
      }
    }
    return 'Unknown';
  }

  private getBidStatus(eventType: string): NFTBid['status'] {
    switch (eventType) {
      case 'BID_PLACED':
        return 'active';
      case 'BID_CANCELLED':
        return 'cancelled';
      case 'BID_ACCEPTED':
        return 'accepted';
      default:
        return 'expired';
    }
  }
} 