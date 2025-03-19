import { Pool, PoolClient } from 'pg';
import { AppError } from '../utils/errorHandling';
import AppLogger from '../utils/logger';
import { HeliusWebhookData } from '../types/helius';

export interface NFTPrice {
  mintAddress: string;
  priceType: 'listing' | 'sale';
  price: number;
  marketplace: string;
  currency: string;
  sellerAddress?: string;
  status: 'active' | 'cancelled' | 'sold' | 'expired';
  expiryTime?: Date;
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
  private static instance: NFTPriceService;
  private readonly marketplacePrograms: Map<string, string>;

  private constructor() {
    // Initialize known marketplace program IDs
    this.marketplacePrograms = new Map([
      ['M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K', 'Magic Eden'],
      ['TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAsbdwmHbN', 'Tensor'],
      ['HYPERfwdTjyJ2SCaKHmpF2MtrXqWxrsotYDsTrshHWq8', 'Hyperspace'],
      // Add more marketplace program IDs as needed
    ]);
  }

  public static getInstance(): NFTPriceService {
    if (!NFTPriceService.instance) {
      NFTPriceService.instance = new NFTPriceService();
    }
    return NFTPriceService.instance;
  }

  public async processPriceEvent(
    transaction: HeliusWebhookData,
    client: Pool | PoolClient
  ): Promise<void> {
    try {
      // Extract price-related events from the transaction
      const priceEvents = transaction.events.filter(event => 
        event.type === 'NFT_LISTING' || 
        event.type === 'NFT_SALE' || 
        event.type === 'NFT_GLOBAL_LISTING' ||
        event.type === 'NFT_CANCEL_LISTING'
      );

      if (!priceEvents.length) {
        return;
      }

      AppLogger.info('Processing NFT price events', {
        component: 'NFTPriceService',
        action: 'processPriceEvent',
        signature: transaction.signature,
        eventCount: priceEvents.length
      });

      for (const event of priceEvents) {
        const eventData = event.data as Record<string, any>;
        const marketplace = this.getMarketplace(transaction);

        const price: NFTPrice = {
          mintAddress: eventData.mint || eventData.mintAddress,
          priceType: event.type === 'NFT_SALE' ? 'sale' : 'listing',
          price: eventData.amount || eventData.price,
          marketplace,
          currency: eventData.currency || 'SOL',
          sellerAddress: eventData.seller || eventData.owner,
          status: this.getPriceStatus(event.type),
          expiryTime: eventData.expiryTime ? new Date(eventData.expiryTime) : undefined,
          timestamp: new Date(transaction.timestamp),
          signature: transaction.signature,
          rawData: event
        };

        await this.upsertPrice(price, client);
      }
    } catch (error) {
      AppLogger.error('Failed to process price event', error as Error, {
        component: 'NFTPriceService',
        action: 'processPriceEvent',
        signature: transaction.signature
      });
      throw error;
    }
  }

  public async getCurrentPrices(
    mintAddress: string,
    client: Pool | PoolClient
  ): Promise<CurrentPrice | null> {
    try {
      const result = await client.query(
        `SELECT * FROM current_nft_prices WHERE mint_address = $1`,
        [mintAddress]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return {
        mintAddress: result.rows[0].mint_address,
        prices: result.rows[0].prices
      };
    } catch (error) {
      AppLogger.error('Failed to get current prices', error as Error, {
        component: 'NFTPriceService',
        action: 'getCurrentPrices',
        mintAddress
      });
      throw new AppError('Failed to get current prices');
    }
  }

  private async upsertPrice(price: NFTPrice, client: Pool | PoolClient): Promise<void> {
    try {
      if (price.priceType === 'sale') {
        // For sales, just update the NFT events table (already handled by HeliusService)
        return;
      }

      // For listings, update the NFT prices table
      await client.query(
        `INSERT INTO nft_prices (
          signature,
          mint_address,
          price_type,
          price,
          marketplace,
          currency,
          seller_address,
          status,
          expiry_time,
          timestamp,
          raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (mint_address, marketplace, seller_address)
        DO UPDATE SET
          status = EXCLUDED.status,
          price = CASE 
            WHEN EXCLUDED.status = 'active' THEN EXCLUDED.price 
            ELSE nft_prices.price 
          END,
          expiry_time = EXCLUDED.expiry_time,
          timestamp = EXCLUDED.timestamp,
          raw_data = EXCLUDED.raw_data,
          updated_at = CURRENT_TIMESTAMP`,
        [
          price.signature,
          price.mintAddress,
          price.priceType,
          price.price,
          price.marketplace,
          price.currency,
          price.sellerAddress,
          price.status,
          price.expiryTime,
          price.timestamp,
          price.rawData
        ]
      );

      AppLogger.info('Processed NFT price', {
        component: 'NFTPriceService',
        action: 'upsertPrice',
        mintAddress: price.mintAddress,
        marketplace: price.marketplace,
        status: price.status
      });
    } catch (error) {
      AppLogger.error('Failed to upsert price', error as Error, {
        component: 'NFTPriceService',
        action: 'upsertPrice',
        signature: price.signature
      });
      throw error;
    }
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

  private getPriceStatus(eventType: string): NFTPrice['status'] {
    switch (eventType) {
      case 'NFT_LISTING':
      case 'NFT_GLOBAL_LISTING':
        return 'active';
      case 'NFT_CANCEL_LISTING':
        return 'cancelled';
      case 'NFT_SALE':
        return 'sold';
      default:
        return 'expired';
    }
  }
} 