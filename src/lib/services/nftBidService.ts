import { Pool, PoolClient } from 'pg';
import { AppError } from '../utils/errorHandling';
import AppLogger from '../utils/logger';
import { HeliusWebhookData } from '../types/helius';

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
  private static instance: NFTBidService;
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

  public static getInstance(): NFTBidService {
    if (!NFTBidService.instance) {
      NFTBidService.instance = new NFTBidService();
    }
    return NFTBidService.instance;
  }

  public async processBidEvent(
    transaction: HeliusWebhookData,
    client: Pool | PoolClient
  ): Promise<void> {
    try {
      // Extract bid events from the transaction
      const bidEvents = transaction.events.filter(event => 
        event.type === 'BID_PLACED' || 
        event.type === 'BID_CANCELLED' ||
        event.type === 'BID_ACCEPTED'
      );

      if (!bidEvents.length) {
        return;
      }

      AppLogger.info('Processing NFT bid events', {
        component: 'NFTBidService',
        action: 'processBidEvent',
        signature: transaction.signature,
        eventCount: bidEvents.length
      });

      for (const event of bidEvents) {
        const eventData = event.data as Record<string, any>;
        const marketplace = this.getMarketplace(transaction);

        const bid: NFTBid = {
          mintAddress: eventData.mint || eventData.mintAddress,
          bidderAddress: eventData.bidder || eventData.buyer,
          bidAmount: eventData.amount || eventData.price,
          marketplace,
          currency: eventData.currency || 'SOL',
          status: this.getBidStatus(event.type),
          expiryTime: eventData.expiryTime ? new Date(eventData.expiryTime) : undefined,
          timestamp: new Date(transaction.timestamp),
          signature: transaction.signature,
          rawData: event
        };

        await this.upsertBid(bid, client);
      }
    } catch (error) {
      AppLogger.error('Failed to process bid event', error as Error, {
        component: 'NFTBidService',
        action: 'processBidEvent',
        signature: transaction.signature
      });
      throw error;
    }
  }

  public async getActiveBids(
    mintAddress: string,
    client: Pool | PoolClient
  ): Promise<ActiveBids[]> {
    try {
      const result = await client.query(
        `SELECT * FROM active_nft_bids WHERE mint_address = $1`,
        [mintAddress]
      );

      return result.rows.map(row => ({
        mintAddress: row.mint_address,
        marketplace: row.marketplace,
        currency: row.currency,
        totalBids: parseInt(row.total_bids),
        minBid: parseFloat(row.min_bid),
        maxBid: parseFloat(row.max_bid),
        avgBid: parseFloat(row.avg_bid),
        bids: row.bids
      }));
    } catch (error) {
      AppLogger.error('Failed to get active bids', error as Error, {
        component: 'NFTBidService',
        action: 'getActiveBids',
        mintAddress
      });
      throw new AppError('Failed to get active bids');
    }
  }

  private async upsertBid(bid: NFTBid, client: Pool | PoolClient): Promise<void> {
    try {
      await client.query(
        `INSERT INTO nft_bids (
          signature,
          mint_address,
          bidder_address,
          bid_amount,
          marketplace,
          currency,
          status,
          expiry_time,
          timestamp,
          raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (mint_address, bidder_address, marketplace)
        DO UPDATE SET
          status = EXCLUDED.status,
          bid_amount = CASE 
            WHEN EXCLUDED.status = 'active' THEN EXCLUDED.bid_amount 
            ELSE nft_bids.bid_amount 
          END,
          expiry_time = EXCLUDED.expiry_time,
          timestamp = EXCLUDED.timestamp,
          raw_data = EXCLUDED.raw_data,
          updated_at = CURRENT_TIMESTAMP`,
        [
          bid.signature,
          bid.mintAddress,
          bid.bidderAddress,
          bid.bidAmount,
          bid.marketplace,
          bid.currency,
          bid.status,
          bid.expiryTime,
          bid.timestamp,
          bid.rawData
        ]
      );

      AppLogger.info('Processed NFT bid', {
        component: 'NFTBidService',
        action: 'upsertBid',
        mintAddress: bid.mintAddress,
        marketplace: bid.marketplace,
        status: bid.status
      });
    } catch (error) {
      AppLogger.error('Failed to upsert bid', error as Error, {
        component: 'NFTBidService',
        action: 'upsertBid',
        signature: bid.signature
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