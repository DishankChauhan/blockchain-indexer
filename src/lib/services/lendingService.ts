import { Pool, PoolClient } from 'pg';
import { AppError } from '../utils/errorHandling';
import AppLogger from '../utils/logger';
import { HeliusWebhookData } from '../types/helius';

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

export class LendingService {
  private static instance: LendingService;
  private readonly protocolPrograms: Map<string, string>;

  private constructor() {
    // Initialize known lending protocol program IDs
    this.protocolPrograms = new Map([
      ['Port7uDYB3wk6GJAw4KT1WpTeMtSu9bTcChBHkX2LfR', 'Port Finance'],
      ['So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo', 'Solend'],
      ['MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA', 'Marginfi'],
      ['4UpD2fh7xH3VP9QQaXtsS1YY3bxzWhtfpks7FatyKvdY', 'Jet Protocol']
    ]);
  }

  public static getInstance(): LendingService {
    if (!LendingService.instance) {
      LendingService.instance = new LendingService();
    }
    return LendingService.instance;
  }

  public async processLendingEvent(
    transaction: HeliusWebhookData,
    client: Pool | PoolClient
  ): Promise<void> {
    try {
      // Check if this is a lending protocol transaction
      const protocolId = this.getProtocolId(transaction);
      if (!protocolId) {
        return;
      }

      // Extract lending events from the transaction
      const lendingEvents = this.extractLendingEvents(transaction);
      if (!lendingEvents.length) {
        return;
      }

      AppLogger.info('Processing lending events', {
        component: 'LendingService',
        action: 'processLendingEvent',
        signature: transaction.signature,
        eventCount: lendingEvents.length
      });

      for (const event of lendingEvents) {
        await this.upsertLendingData(event, client);
      }
    } catch (error) {
      AppLogger.error('Failed to process lending event', error as Error, {
        component: 'LendingService',
        action: 'processLendingEvent',
        signature: transaction.signature
      });
      throw error;
    }
  }

  public async getAvailableTokens(
    client: Pool | PoolClient,
    options?: {
      protocolName?: string;
      minLiquidity?: number;
      maxBorrowRate?: number;
    }
  ): Promise<LendingToken[]> {
    try {
      let query = 'SELECT * FROM available_lending_tokens WHERE 1=1';
      const params: any[] = [];

      if (options?.protocolName) {
        params.push(options.protocolName);
        query += ` AND protocol_name = $${params.length}`;
      }

      if (options?.minLiquidity) {
        params.push(options.minLiquidity);
        query += ` AND available_liquidity >= $${params.length}`;
      }

      if (options?.maxBorrowRate) {
        params.push(options.maxBorrowRate);
        query += ` AND borrow_rate <= $${params.length}`;
      }

      query += ' ORDER BY borrow_rate ASC';

      const result = await client.query(query, params);

      return result.rows.map(row => ({
        protocolName: row.protocol_name,
        poolName: row.pool_name,
        tokenSymbol: row.token_symbol,
        tokenName: row.token_name,
        mintAddress: row.mint_address,
        decimals: row.decimals,
        borrowRate: parseFloat(row.borrow_rate),
        supplyRate: parseFloat(row.supply_rate),
        totalSupply: parseFloat(row.total_supply),
        availableLiquidity: parseFloat(row.available_liquidity),
        borrowedAmount: parseFloat(row.borrowed_amount),
        utilizationRate: parseFloat(row.utilization_rate),
        collateralFactor: parseFloat(row.collateral_factor),
        lastUpdated: new Date(row.last_updated)
      }));
    } catch (error) {
      AppLogger.error('Failed to get available tokens', error as Error, {
        component: 'LendingService',
        action: 'getAvailableTokens'
      });
      throw new AppError('Failed to get available tokens');
    }
  }

  private async upsertLendingData(
    event: LendingProtocolEvent,
    client: Pool | PoolClient
  ): Promise<void> {
    try {
      // Get or create protocol
      const protocolResult = await client.query(
        'SELECT id FROM lending_protocols WHERE program_id = $1',
        [event.protocolId]
      );
      const protocolId = protocolResult.rows[0].id;

      // Get or create pool
      const poolResult = await client.query(
        `INSERT INTO lending_pools (protocol_id, pool_address, name)
         VALUES ($1, $2, $3)
         ON CONFLICT (protocol_id, pool_address)
         DO UPDATE SET updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [protocolId, event.poolAddress, event.poolAddress]
      );
      const poolId = poolResult.rows[0].id;

      // Get or create token
      const tokenResult = await client.query(
        `INSERT INTO lending_tokens (
          pool_id, mint_address, token_symbol, token_name, decimals
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (pool_id, mint_address)
        DO UPDATE SET
          token_symbol = EXCLUDED.token_symbol,
          token_name = EXCLUDED.token_name,
          decimals = EXCLUDED.decimals,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id`,
        [
          poolId,
          event.tokenMint,
          event.tokenSymbol,
          event.tokenName,
          event.decimals
        ]
      );
      const tokenId = tokenResult.rows[0].id;

      // Insert rates
      await client.query(
        `INSERT INTO lending_rates (
          token_id,
          borrow_rate,
          supply_rate,
          total_supply,
          available_liquidity,
          borrowed_amount,
          utilization_rate,
          collateral_factor,
          timestamp,
          raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          tokenId,
          event.borrowRate,
          event.supplyRate,
          event.totalSupply,
          event.availableLiquidity,
          event.borrowedAmount,
          event.utilizationRate,
          event.collateralFactor,
          event.timestamp,
          event.rawData
        ]
      );

      AppLogger.info('Processed lending data', {
        component: 'LendingService',
        action: 'upsertLendingData',
        tokenMint: event.tokenMint,
        protocolId: event.protocolId
      });
    } catch (error) {
      AppLogger.error('Failed to upsert lending data', error as Error, {
        component: 'LendingService',
        action: 'upsertLendingData',
        tokenMint: event.tokenMint
      });
      throw error;
    }
  }

  private getProtocolId(transaction: HeliusWebhookData): string | null {
    // Check program interactions to determine protocol
    for (const account of transaction.accountData) {
      if (this.protocolPrograms.has(account.program)) {
        return account.program;
      }
    }
    return null;
  }

  private extractLendingEvents(transaction: HeliusWebhookData): LendingProtocolEvent[] {
    const events: LendingProtocolEvent[] = [];

    // This is a simplified example. In a real implementation, you would:
    // 1. Parse the transaction instructions from accountData
    // 2. Decode the instruction data based on the protocol's IDL
    // 3. Extract relevant lending pool and token information
    // 4. Calculate rates and amounts

    // For each protocol, implement specific parsing logic
    const protocolId = this.getProtocolId(transaction);
    if (!protocolId) {
      return events;
    }

    // Example parsing for Solend (you would need to implement similar logic for other protocols)
    if (protocolId === 'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo') {
      // Look for reserve updates in accountData
      const reserveAccounts = transaction.accountData.filter(
        acc => acc.type === 'reserve' || acc.type === 'lendingMarket'
      );

      for (const account of reserveAccounts) {
        const data = account.data as Record<string, any>;
        if (data.liquidityMint) {
          events.push({
            protocolId,
            poolAddress: account.account,
            tokenMint: data.liquidityMint,
            tokenSymbol: data.symbol || 'UNKNOWN',
            tokenName: data.name || 'Unknown Token',
            decimals: data.decimals || 9,
            borrowRate: data.borrowRate || 0,
            supplyRate: data.supplyRate || 0,
            totalSupply: data.totalSupply || 0,
            availableLiquidity: data.availableLiquidity || 0,
            borrowedAmount: data.borrowedAmount || 0,
            utilizationRate: data.utilizationRate || 0,
            collateralFactor: data.collateralFactor || 0,
            timestamp: new Date(transaction.timestamp),
            rawData: data
          });
        }
      }
    }

    return events;
  }
} 