import { Pool, PoolClient } from 'pg';
import { logError, logInfo } from '@/lib/utils/serverLogger';
import { AppError } from '@/lib/utils/errorHandling';
import { HeliusWebhookData } from '../types/helius';
import { RateLimiter } from 'limiter';

export interface NFTPrice {
  mintAddress: string;
  price: number;
  marketplace: string;
  sellerAddress?: string;
  status: 'listed' | 'sold' | 'cancelled';
  timestamp: Date;
  signature: string;
  rawData: any;
}

export interface CurrentPrice {
  mintAddress: string;
  prices: Array<{
    marketplace: string;
    currency: string;
    listPrice: number;
    seller: string;
    listTimestamp: Date;
    lastSalePrice?: number;
    lastSaleTimestamp?: Date;
  }>;
}

export class NFTPriceService {
  private static instance: NFTPriceService | null = null;
  private readonly baseUrl: string;
  private readonly marketplacePrograms: Map<string, string>;
  private readonly rateLimiter: RateLimiter;

  private constructor() {
    this.baseUrl = process.env.HELIUS_API_URL || 'https://api.helius.xyz/v0';
    this.marketplacePrograms = new Map([
      ['M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K', 'Magic Eden'],
      ['HYPERfwdTjyJ2SCaKHmpF2MtrXqWxrsotYDsTrshHWq8', 'HyperSpace'],
      ['TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAsbdwmHbN', 'Tensor'],
      ['CJsLwbP1iu5DuUikHEJnLfANgKy6stB2uFgvBBHoyxwz', 'Solanart']
    ]);
    this.rateLimiter = new RateLimiter({
      tokensPerInterval: 50,
      interval: 'second',
      fireImmediately: true
    });
  }

  public static getInstance(): NFTPriceService {
    if (!NFTPriceService.instance) {
      NFTPriceService.instance = new NFTPriceService();
    }
    return NFTPriceService.instance;
  }

  public async fetchAndStoreData(dbPool: Pool): Promise<void> {
    try {
      logInfo('Starting NFT price data fetch', {
        component: 'NFTPriceService',
        action: 'fetchAndStoreData'
      });

      // Get API key from environment
      const apiKey = process.env.HELIUS_API_KEY;
      if (!apiKey) {
        throw new AppError('HELIUS_API_KEY not found in environment');
      }

      // Get the latest processed timestamp
      const lastProcessed = await this.getLastProcessedTimestamp(dbPool);
      const currentTime = Math.floor(Date.now() / 1000);

      // Fetch data in batches
      const batchSize = 100;
      let startTime = lastProcessed || (currentTime - 24 * 60 * 60); // Start from 24 hours ago if no last processed
      
      while (startTime < currentTime) {
        // Wait for rate limit token
        await this.rateLimiter.removeTokens(1);

        const endTime = Math.min(startTime + 3600, currentTime); // Process 1 hour at a time
        
        // Fetch price events from Helius API
        const response = await fetch(`${this.baseUrl}/nft-events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            query: {
              types: ['NFT_LISTING', 'NFT_SALE', 'NFT_CANCEL_LISTING'],
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
        const client = await dbPool.connect();
        try {
          await client.query('BEGIN');

          for (const event of events) {
            const price: NFTPrice = {
              mintAddress: event.nft.mint,
              price: event.amount,
              marketplace: this.getMarketplace(event),
              sellerAddress: event.seller,
              status: this.getPriceStatus(event.type),
              timestamp: new Date(event.timestamp * 1000),
              signature: event.signature,
              rawData: event.raw
            };

            await this.insertPriceData(price, client);
          }

          // Update last processed timestamp
          await client.query(`
            INSERT INTO indexer_state (key, value, updated_at)
            VALUES ('nft_prices_last_processed', $1, NOW())
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

        logInfo('Processed NFT price batch', {
          component: 'NFTPriceService',
          action: 'fetchAndStoreData',
          startTime,
          endTime,
          eventsProcessed: events.length
        });
      }

      logInfo('Completed NFT price data fetch', {
        component: 'NFTPriceService',
        action: 'fetchAndStoreData'
      });
    } catch (error) {
      logError('Failed to fetch and store NFT price data', error as Error, {
        component: 'NFTPriceService',
        action: 'fetchAndStoreData'
      });
      throw new AppError('Failed to fetch and store NFT price data');
    }
  }

  private async getLastProcessedTimestamp(dbPool: Pool): Promise<number | null> {
    try {
      const result = await dbPool.query(`
        SELECT value::bigint as timestamp
        FROM indexer_state
        WHERE key = 'nft_prices_last_processed'
      `);
      return result.rows[0]?.timestamp || null;
    } catch (error) {
      logError('Failed to get last processed timestamp', error as Error, {
        component: 'NFTPriceService',
        action: 'getLastProcessedTimestamp'
      });
      return null;
    }
  }

  private getMarketplace(event: any): string {
    // Check program interactions to determine marketplace
    for (const account of event.accountData || []) {
      const marketplace = this.marketplacePrograms.get(account.program);
      if (marketplace) {
        return marketplace;
      }
    }
    return 'Unknown';
  }

  private getPriceStatus(eventType: string): NFTPrice['status'] {
    switch (eventType) {
      case 'NFT_LISTING':
        return 'listed';
      case 'NFT_SALE':
        return 'sold';
      case 'NFT_CANCEL_LISTING':
        return 'cancelled';
      default:
        return 'listed';
    }
  }

  public async processPriceEvent(
    event: HeliusWebhookData,
    client: Pool | PoolClient
  ): Promise<void> {
    try {
      // Only process if we have NFT data
      if (!event.nft?.mint || !event.amount) {
        logInfo('Skipping event - missing required NFT data', {
          component: 'NFTPriceService',
          action: 'processPriceEvent',
          signature: event.signature
        });
        return;
      }

      const price: NFTPrice = {
        mintAddress: event.nft.mint,
        price: event.amount,
        marketplace: this.getMarketplace(event),
        sellerAddress: event.seller,
        status: this.getPriceStatus(event.type),
        timestamp: new Date(event.timestamp * 1000),
        signature: event.signature,
        rawData: event.raw
      };

      if (client instanceof Pool) {
        const poolClient = await client.connect();
        try {
          await poolClient.query('BEGIN');
          await this.insertPriceData(price, poolClient);
          await poolClient.query('COMMIT');
        } catch (error) {
          await poolClient.query('ROLLBACK');
          throw error;
        } finally {
          poolClient.release();
        }
      } else {
        await this.insertPriceData(price, client);
      }

      logInfo('Processed NFT price event', {
        component: 'NFTPriceService',
        action: 'processPriceEvent',
        signature: event.signature,
        mintAddress: event.nft.mint,
        price: event.amount,
        status: price.status
      });
    } catch (error) {
      logError('Failed to process NFT price event', error as Error, {
        component: 'NFTPriceService',
        action: 'processPriceEvent',
        signature: event.signature
      });
      throw new AppError('Failed to process NFT price event');
    }
  }

  private async insertPriceData(price: NFTPrice, client: Pool | PoolClient): Promise<void> {
    await client.query(`
      INSERT INTO nft_prices (
        signature,
        mint_address,
        price,
        marketplace,
        seller_address,
        status,
        timestamp,
        raw_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (signature) DO UPDATE SET
        status = EXCLUDED.status,
        raw_data = EXCLUDED.raw_data
    `, [
      price.signature,
      price.mintAddress,
      price.price,
      price.marketplace,
      price.sellerAddress,
      price.status,
      price.timestamp,
      price.rawData
    ]);
  }

  public async cleanup(): Promise<void> {
    NFTPriceService.instance = null;
  }

  public async getCurrentPrices(mintAddress: string, dbPool: Pool): Promise<any> {
    try {
      const result = await dbPool.query(`
        SELECT * FROM current_nft_prices
        WHERE mint_address = $1
      `, [mintAddress]);

      return result.rows[0]?.prices || [];
    } catch (error) {
      logError('Failed to get current prices', error as Error, {
        component: 'NFTPriceService',
        action: 'getCurrentPrices',
        mintAddress
      });
      throw error;
    }
  }

  private async upsertPrice(priceData: any, client: Pool): Promise<void> {
    try {
      logInfo('Processed NFT price', {
        component: 'NFTPriceService',
        action: 'upsertPrice',
        mintAddress: priceData.mintAddress
      });

      // Implementation of price upsert logic
    } catch (error) {
      logError('Failed to upsert price', error as Error, {
        component: 'NFTPriceService',
        action: 'upsertPrice',
        mintAddress: priceData.mintAddress
      });
      throw error;
    }
  }
} 