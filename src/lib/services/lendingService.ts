import { Pool, PoolClient } from 'pg';
import { logError, logInfo } from '@/lib/utils/serverLogger';
import { AppError } from '@/lib/utils/errorHandling';
import { HeliusWebhookData } from '../types/helius';
import { RateLimiter } from 'limiter';

export interface LendingToken {
  protocolName: string;
  poolName: string;
  tokenSymbol: string;
  tokenName: string;
  mintAddress: string;
  decimals: number;
  borrowRate: number;
  supplyRate: number;
  totalSupply: number;
  availableLiquidity: number;
  borrowedAmount: number;
  utilizationRate: number;
  collateralFactor: number;
  lastUpdated: Date;
}

export interface LendingProtocolEvent {
  protocolId: string;
  poolAddress: string;
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  decimals: number;
  borrowRate: number;
  supplyRate: number;
  totalSupply: number;
  availableLiquidity: number;
  borrowedAmount: number;
  utilizationRate: number;
  collateralFactor: number;
  timestamp: Date;
  rawData: any;
}

export interface LendingRate {
  tokenMint: string;
  tokenName: string;
  protocol: string;
  supplyRate: number;
  borrowRate: number;
  totalSupply: number;
  totalBorrow: number;
  utilization: number;
  timestamp: Date;
  signature: string;
  rawData: any;
}

export interface LendingEvent {
  type: 'LENDING_RATE_UPDATE' | 'RESERVE_UPDATE';
  tokenData: {
    mint: string;
    name?: string;
  };
  signature: string;
  timestamp: number;
  data: {
    reserve?: {
      tokenMint: string;
      tokenName?: string;
      supplyRate?: number;
      borrowRate?: number;
      totalSupply?: number;
      totalBorrow?: number;
      utilization?: number;
      [key: string]: any;
    };
    [key: string]: any;
  };
  accountData: Array<{
    account: string;
    program: string;
    data: any;
  }>;
  raw: any;
}

export class LendingService {
  private static instance: LendingService | null = null;
  private readonly baseUrl: string;
  private readonly rateLimiter: RateLimiter;
  private readonly supportedProtocols: Map<string, string>;

  private constructor() {
    this.baseUrl = process.env.HELIUS_API_URL || 'https://api.helius.xyz/v0';
    this.rateLimiter = new RateLimiter({
      tokensPerInterval: 50,
      interval: 'second',
      fireImmediately: true
    });
    // Initialize known lending protocol program IDs
    this.supportedProtocols = new Map([
      ['Port7uDYB3wk6GJAw4KT1WpTeMtSu9bTcChBHkX2LfR', 'Port Finance'],
      ['So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo', 'Solend'],
      ['MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA', 'Mango Markets'],
      ['LendZqTs7gn5CTSJU1jWKhKuVpjJGom45nnwPb2AMTi', 'Larix']
    ]);
  }

  public static getInstance(): LendingService {
    if (!LendingService.instance) {
      LendingService.instance = new LendingService();
    }
    return LendingService.instance;
  }

  public async fetchAndStoreData(dbPool: Pool): Promise<void> {
    try {
      logInfo('Starting lending data fetch', {
        component: 'LendingService',
        action: 'fetchAndStoreData'
      });

      const apiKey = process.env.HELIUS_API_KEY;
      if (!apiKey) {
        throw new AppError('HELIUS_API_KEY not found in environment');
      }

      const lastProcessed = await this.getLastProcessedTimestamp(dbPool);
      const currentTime = Math.floor(Date.now() / 1000);
      const batchSize = 100;
      let startTime = lastProcessed || (currentTime - 24 * 60 * 60);

      while (startTime < currentTime) {
        await this.rateLimiter.removeTokens(1);
        const endTime = Math.min(startTime + 3600, currentTime);

        const response = await fetch(`${this.baseUrl}/program-events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            query: {
              programs: Array.from(this.supportedProtocols.keys()),
              timeStart: startTime,
              timeEnd: endTime,
              types: ['LENDING_RATE_UPDATE', 'RESERVE_UPDATE']
            },
            options: { limit: batchSize }
          })
        });

        if (!response.ok) {
          throw new AppError(`Failed to fetch lending events: ${response.statusText}`);
        }

        const events = await response.json() as LendingEvent[];
        const client = await dbPool.connect();

        try {
          await client.query('BEGIN');

          for (const event of events) {
            if (this.isValidLendingEvent(event)) {
              const rate = this.extractLendingRate(event);
              if (rate) {
                await this.insertLendingRate(rate, client);
              }
            }
          }

          await client.query(`
            INSERT INTO indexer_state (key, value, updated_at)
            VALUES ('lending_rates_last_processed', $1, NOW())
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

        startTime = endTime;

        logInfo('Processed lending rate batch', {
          component: 'LendingService',
          action: 'fetchAndStoreData',
          startTime,
          endTime,
          eventsProcessed: events.length
        });
      }

      logInfo('Completed lending data fetch', {
        component: 'LendingService',
        action: 'fetchAndStoreData'
      });
    } catch (error) {
      logError('Failed to fetch and store lending data', error as Error, {
        component: 'LendingService',
        action: 'fetchAndStoreData'
      });
      throw new AppError('Failed to fetch and store lending data');
    }
  }

  private async getLastProcessedTimestamp(dbPool: Pool): Promise<number | null> {
    try {
      const result = await dbPool.query(`
        SELECT value::bigint as timestamp
        FROM indexer_state
        WHERE key = 'lending_rates_last_processed'
      `);
      return result.rows[0]?.timestamp || null;
    } catch (error) {
      logError('Failed to get last processed timestamp', error as Error, {
        component: 'LendingService',
        action: 'getLastProcessedTimestamp'
      });
      return null;
    }
  }

  private isValidLendingEvent(event: LendingEvent | HeliusWebhookData): boolean {
    if ('tokenData' in event) {
      // Handle API event
      return (
        (event.type === 'LENDING_RATE_UPDATE' || event.type === 'RESERVE_UPDATE') &&
        event.tokenData?.mint !== undefined &&
        event.signature !== undefined &&
        event.timestamp !== undefined &&
        event.data?.reserve !== undefined
      );
    } else {
      // Handle webhook event
      return (
        event.type === 'PROGRAM_EVENT' &&
        event.signature !== undefined &&
        event.timestamp !== undefined &&
        Array.isArray(event.accountData) &&
        event.accountData.some(account => 
          this.supportedProtocols.has(account.program) &&
          account.data &&
          this.isValidReserveData(account.data)
        )
      );
    }
  }

  private extractLendingRate(event: LendingEvent | HeliusWebhookData): LendingRate | null {
    try {
      if ('tokenData' in event) {
        // Handle API event
        const protocol = this.getProtocol(event.accountData);
        if (!protocol) return null;

        const reserveData = event.data.reserve;
        if (!reserveData) return null;

        return {
          tokenMint: event.tokenData.mint,
          tokenName: event.tokenData.name || '',
          protocol,
          supplyRate: this.calculateSupplyRate(reserveData),
          borrowRate: this.calculateBorrowRate(reserveData),
          totalSupply: reserveData.totalSupply || 0,
          totalBorrow: reserveData.totalBorrow || 0,
          utilization: this.calculateUtilization(reserveData),
          timestamp: new Date(event.timestamp * 1000),
          signature: event.signature,
          rawData: event.raw
        };
      } else {
        // Handle webhook event
        const protocol = this.getProtocol(event.accountData);
        if (!protocol) return null;

        const reserveAccount = event.accountData.find(account => 
          this.supportedProtocols.has(account.program));
        if (!reserveAccount || !this.isValidReserveData(reserveAccount.data)) return null;

        const reserveData = reserveAccount.data;
        if (!this.isValidReserveData(reserveData)) return null;

        return {
          tokenMint: reserveData.tokenMint as string,
          tokenName: (reserveData.tokenName as string) || '',
          protocol,
          supplyRate: this.calculateSupplyRate(reserveData),
          borrowRate: this.calculateBorrowRate(reserveData),
          totalSupply: Number(reserveData.totalSupply) || 0,
          totalBorrow: Number(reserveData.totalBorrow) || 0,
          utilization: this.calculateUtilization(reserveData),
          timestamp: new Date(event.timestamp * 1000),
          signature: event.signature,
          rawData: event.raw
        };
      }
    } catch (error) {
      logError('Failed to extract lending rate', error as Error, {
        component: 'LendingService',
        action: 'extractLendingRate',
        signature: event.signature
      });
      return null;
    }
  }

  private isValidReserveData(data: any): boolean {
    return data && (
      (typeof data.totalSupply === 'number' || typeof data.totalSupply === 'string') &&
      (typeof data.totalBorrow === 'number' || typeof data.totalBorrow === 'string') &&
      typeof data.tokenMint === 'string'
    );
  }

  private getProtocol(accountData: any[]): string | null {
    for (const account of accountData || []) {
      const protocol = this.supportedProtocols.get(account.program);
      if (protocol) {
        return protocol;
      }
    }
    return null;
  }

  private calculateSupplyRate(reserveData: any): number {
    try {
      // Different protocols might store rates differently
      // This is a simplified calculation
      const baseRate = Number(reserveData.supplyRate || reserveData.depositRate || 0);
      return baseRate / 100; // Convert to decimal
    } catch (error) {
      logError('Failed to calculate supply rate', error as Error, {
        component: 'LendingService',
        action: 'calculateSupplyRate'
      });
      return 0;
    }
  }

  private calculateBorrowRate(reserveData: any): number {
    try {
      // Different protocols might store rates differently
      // This is a simplified calculation
      const baseRate = Number(reserveData.borrowRate || 0);
      return baseRate / 100; // Convert to decimal
    } catch (error) {
      logError('Failed to calculate borrow rate', error as Error, {
        component: 'LendingService',
        action: 'calculateBorrowRate'
      });
      return 0;
    }
  }

  private calculateUtilization(reserveData: any): number {
    try {
      const totalSupply = Number(reserveData.totalSupply || 0);
      const totalBorrow = Number(reserveData.totalBorrow || 0);

      if (totalSupply === 0) return 0;
      return totalBorrow / totalSupply;
    } catch (error) {
      logError('Failed to calculate utilization', error as Error, {
        component: 'LendingService',
        action: 'calculateUtilization'
      });
      return 0;
    }
  }

  public async processLendingEvent(
    event: HeliusWebhookData,
    client: Pool | PoolClient
  ): Promise<void> {
    try {
      if (!this.isValidLendingEvent(event)) {
        return;
      }

      const rate = this.extractLendingRate(event);
      if (!rate) {
        return;
      }

      if (client instanceof Pool) {
        const poolClient = await client.connect();
        try {
          await poolClient.query('BEGIN');
          await this.insertLendingRate(rate, poolClient);
          await poolClient.query('COMMIT');
        } catch (error) {
          await poolClient.query('ROLLBACK');
          throw error;
        } finally {
          poolClient.release();
        }
      } else {
        await this.insertLendingRate(rate, client);
      }

      logInfo('Processed lending rate event', {
        component: 'LendingService',
        action: 'processLendingEvent',
        signature: event.signature,
        tokenMint: rate.tokenMint,
        protocol: rate.protocol
      });
    } catch (error) {
      logError('Failed to process lending event', error as Error, {
        component: 'LendingService',
        action: 'processLendingEvent',
        signature: event.signature
      });
      throw new AppError('Failed to process lending event');
    }
  }

  private async insertLendingRate(rate: LendingRate, client: Pool | PoolClient): Promise<void> {
    await client.query(`
      INSERT INTO lending_rates (
        signature,
        token_mint,
        token_name,
        protocol,
        supply_rate,
        borrow_rate,
        total_supply,
        total_borrow,
        utilization,
        timestamp,
        raw_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (signature) DO UPDATE SET
        supply_rate = EXCLUDED.supply_rate,
        borrow_rate = EXCLUDED.borrow_rate,
        total_supply = EXCLUDED.total_supply,
        total_borrow = EXCLUDED.total_borrow,
        utilization = EXCLUDED.utilization,
        raw_data = EXCLUDED.raw_data
    `, [
      rate.signature,
      rate.tokenMint,
      rate.tokenName,
      rate.protocol,
      rate.supplyRate,
      rate.borrowRate,
      rate.totalSupply,
      rate.totalBorrow,
      rate.utilization,
      rate.timestamp,
      rate.rawData
    ]);
  }

  public async getCurrentRates(tokenMint: string, dbPool: Pool): Promise<any> {
    try {
      const result = await dbPool.query(`
        SELECT * FROM current_lending_rates
        WHERE token_mint = $1
        ORDER BY protocol
      `, [tokenMint]);

      return result.rows;
    } catch (error) {
      logError('Failed to get current rates', error as Error, {
        component: 'LendingService',
        action: 'getCurrentRates',
        tokenMint
      });
      throw error;
    }
  }

  public async cleanup(): Promise<void> {
    LendingService.instance = null;
  }
} 