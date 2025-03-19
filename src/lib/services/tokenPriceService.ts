import { Pool, PoolClient } from 'pg';
import { AppError } from '../utils/errorHandling';
import ServerLogger from '../utils/serverLogger';
import { HeliusWebhookData } from '../types/helius';

export interface TokenPrice {
  baseMint: string;
  quoteMint: string;
  platformName: string;
  platformType: string;
  poolAddress: string;
  price: number;
  volume24h: number;
  liquidity: number;
  lastUpdated: Date;
}

export interface AggregatedTokenPrice {
  baseMint: string;
  quoteMint: string;
  platformCount: number;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  totalVolume24h: number;
  totalLiquidity: number;
  platforms: Array<{
    platform: string;
    type: string;
    pool: string;
    price: number;
    volume: number;
    liquidity: number;
    timestamp: Date;
  }>;
}

export class TokenPriceService {
  private static instance: TokenPriceService;
  private readonly platformPrograms: Map<string, string>;

  private constructor() {
    // Initialize known DEX and aggregator program IDs
    this.platformPrograms = new Map([
      ['675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', 'Raydium'],
      ['9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP', 'Orca'],
      ['JUP6i4ozu5ydDCnLiMogSckDPpbtr7BJ4FtzYWkb5Rk', 'Jupiter'],
      ['srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX', 'Serum']
    ]);
  }

  public static getInstance(): TokenPriceService {
    if (!TokenPriceService.instance) {
      TokenPriceService.instance = new TokenPriceService();
    }
    return TokenPriceService.instance;
  }

  public async processPriceEvent(
    transaction: HeliusWebhookData,
    client: Pool | PoolClient
  ): Promise<void> {
    try {
      // Check if this is a DEX/aggregator transaction
      const platformId = this.getPlatformId(transaction);
      if (!platformId) {
        return;
      }

      // Extract price events from the transaction
      const priceEvents = await this.extractPriceEvents(transaction, client);
      if (!priceEvents.length) {
        return;
      }

      ServerLogger.info('Processing token price events', {
        component: 'TokenPriceService',
        action: 'processPriceEvent',
        signature: transaction.signature,
        eventCount: priceEvents.length
      });

      for (const event of priceEvents) {
        await this.upsertPriceData(event, client);
      }
    } catch (error) {
      ServerLogger.error('Failed to process price event', error as Error, {
        component: 'TokenPriceService',
        action: 'processPriceEvent',
        signature: transaction.signature
      });
      throw error;
    }
  }

  public async getCurrentPrices(
    client: Pool | PoolClient,
    options?: {
      baseMint?: string;
      quoteMint?: string;
      platform?: string;
      minLiquidity?: number;
    }
  ): Promise<TokenPrice[]> {
    try {
      let query = 'SELECT * FROM current_token_prices WHERE 1=1';
      const params: any[] = [];

      if (options?.baseMint) {
        params.push(options.baseMint);
        query += ` AND base_mint = $${params.length}`;
      }

      if (options?.quoteMint) {
        params.push(options.quoteMint);
        query += ` AND quote_mint = $${params.length}`;
      }

      if (options?.platform) {
        params.push(options.platform);
        query += ` AND platform_name = $${params.length}`;
      }

      if (options?.minLiquidity) {
        params.push(options.minLiquidity);
        query += ` AND liquidity >= $${params.length}`;
      }

      query += ' ORDER BY volume_24h DESC';

      const result = await client.query(query, params);

      return result.rows.map(row => ({
        baseMint: row.base_mint,
        quoteMint: row.quote_mint,
        platformName: row.platform_name,
        platformType: row.platform_type,
        poolAddress: row.pool_address,
        price: parseFloat(row.price),
        volume24h: parseFloat(row.volume_24h),
        liquidity: parseFloat(row.liquidity),
        lastUpdated: new Date(row.last_updated)
      }));
    } catch (error) {
      ServerLogger.error('Failed to get current prices', error as Error, {
        component: 'TokenPriceService',
        action: 'getCurrentPrices'
      });
      throw new AppError('Failed to get current token prices');
    }
  }

  public async getAggregatedPrices(
    client: Pool | PoolClient,
    options?: {
      baseMint?: string;
      quoteMint?: string;
      minLiquidity?: number;
    }
  ): Promise<AggregatedTokenPrice[]> {
    try {
      let query = 'SELECT * FROM aggregated_token_prices WHERE 1=1';
      const params: any[] = [];

      if (options?.baseMint) {
        params.push(options.baseMint);
        query += ` AND base_mint = $${params.length}`;
      }

      if (options?.quoteMint) {
        params.push(options.quoteMint);
        query += ` AND quote_mint = $${params.length}`;
      }

      if (options?.minLiquidity) {
        params.push(options.minLiquidity);
        query += ` AND total_liquidity >= $${params.length}`;
      }

      query += ' ORDER BY total_volume_24h DESC';

      const result = await client.query(query, params);

      return result.rows.map(row => ({
        baseMint: row.base_mint,
        quoteMint: row.quote_mint,
        platformCount: parseInt(row.platform_count),
        minPrice: parseFloat(row.min_price),
        maxPrice: parseFloat(row.max_price),
        avgPrice: parseFloat(row.avg_price),
        totalVolume24h: parseFloat(row.total_volume_24h),
        totalLiquidity: parseFloat(row.total_liquidity),
        platforms: row.platforms
      }));
    } catch (error) {
      ServerLogger.error('Failed to get aggregated prices', error as Error, {
        component: 'TokenPriceService',
        action: 'getAggregatedPrices'
      });
      throw new AppError('Failed to get aggregated token prices');
    }
  }

  private getPlatformId(transaction: HeliusWebhookData): string | null {
    // Check program interactions to determine platform
    for (const account of transaction.accountData) {
      if (this.platformPrograms.has(account.program)) {
        return account.program;
      }
    }
    return null;
  }

  private async extractPriceEvents(
    transaction: HeliusWebhookData,
    client: Pool | PoolClient
  ): Promise<Array<{
    platformId: number;
    baseMint: string;
    quoteMint: string;
    poolAddress: string;
    price: number;
    volume24h: number;
    liquidity: number;
    timestamp: Date;
    rawData: any;
  }>> {
    const events: Array<{
      platformId: number;
      baseMint: string;
      quoteMint: string;
      poolAddress: string;
      price: number;
      volume24h: number;
      liquidity: number;
      timestamp: Date;
      rawData: any;
    }> = [];

    const programId = this.getPlatformId(transaction);
    if (!programId) {
      return events;
    }

    // Get platform ID from database
    const platformResult = await client.query(
      'SELECT id FROM token_platforms WHERE program_id = $1',
      [programId]
    );
    if (!platformResult.rows.length) {
      return events;
    }
    const platformId = platformResult.rows[0].id;

    // Extract pool and price information based on the platform
    switch (this.platformPrograms.get(programId)) {
      case 'Raydium':
        events.push(...await this.extractRaydiumPrices(transaction, platformId));
        break;
      case 'Orca':
        events.push(...await this.extractOrcaPrices(transaction, platformId));
        break;
      case 'Jupiter':
        events.push(...await this.extractJupiterPrices(transaction, platformId));
        break;
      case 'Serum':
        events.push(...await this.extractSerumPrices(transaction, platformId));
        break;
    }

    return events;
  }

  private async extractRaydiumPrices(
    transaction: HeliusWebhookData,
    platformId: number
  ): Promise<Array<{
    platformId: number;
    baseMint: string;
    quoteMint: string;
    poolAddress: string;
    price: number;
    volume24h: number;
    liquidity: number;
    timestamp: Date;
    rawData: any;
  }>> {
    const events: Array<{
      platformId: number;
      baseMint: string;
      quoteMint: string;
      poolAddress: string;
      price: number;
      volume24h: number;
      liquidity: number;
      timestamp: Date;
      rawData: any;
    }> = [];

    // Look for pool updates in accountData
    const poolAccounts = transaction.accountData.filter(
      acc => acc.type === 'pool' || acc.type === 'amm'
    );

    for (const account of poolAccounts) {
      const data = account.data as Record<string, any>;
      if (data.baseMint && data.quoteMint) {
        events.push({
          platformId,
          baseMint: data.baseMint,
          quoteMint: data.quoteMint,
          poolAddress: account.account,
          price: data.price || 0,
          volume24h: data.volume24h || 0,
          liquidity: data.liquidity || 0,
          timestamp: new Date(transaction.timestamp),
          rawData: data
        });
      }
    }

    return events;
  }

  private async extractOrcaPrices(
    transaction: HeliusWebhookData,
    platformId: number
  ): Promise<Array<{
    platformId: number;
    baseMint: string;
    quoteMint: string;
    poolAddress: string;
    price: number;
    volume24h: number;
    liquidity: number;
    timestamp: Date;
    rawData: any;
  }>> {
    const events: Array<{
      platformId: number;
      baseMint: string;
      quoteMint: string;
      poolAddress: string;
      price: number;
      volume24h: number;
      liquidity: number;
      timestamp: Date;
      rawData: any;
    }> = [];

    // Look for whirlpool state updates in accountData
    const whirlpoolAccounts = transaction.accountData.filter(
      acc => acc.type === 'whirlpool' || acc.type === 'pool'
    );

    for (const account of whirlpoolAccounts) {
      const data = account.data as Record<string, any>;
      
      // Orca whirlpools store token information in tokenVaultA and tokenVaultB
      if (data.tokenVaultA && data.tokenVaultB && data.sqrtPrice) {
        // Calculate price from sqrtPrice (Orca uses Q64.64 fixed-point format)
        const sqrtPrice = BigInt(data.sqrtPrice);
        const price = Number((sqrtPrice * sqrtPrice) >> BigInt(64)) / Math.pow(2, 64);

        // Calculate liquidity and volume
        const liquidity = data.liquidity ? Number(data.liquidity) : 0;
        const volume24h = data.volume24h ? Number(data.volume24h) : 0;

        events.push({
          platformId,
          baseMint: data.tokenMintA,
          quoteMint: data.tokenMintB,
          poolAddress: account.account,
          price,
          volume24h,
          liquidity,
          timestamp: new Date(transaction.timestamp),
          rawData: {
            ...data,
            poolType: 'whirlpool',
            tokenADecimals: data.tokenADecimals,
            tokenBDecimals: data.tokenBDecimals
          }
        });
      }
    }

    ServerLogger.debug('Extracted Orca price events', {
      component: 'TokenPriceService',
      action: 'extractOrcaPrices',
      eventCount: events.length,
      signature: transaction.signature
    });

    return events;
  }

  private async extractJupiterPrices(
    transaction: HeliusWebhookData,
    platformId: number
  ): Promise<Array<{
    platformId: number;
    baseMint: string;
    quoteMint: string;
    poolAddress: string;
    price: number;
    volume24h: number;
    liquidity: number;
    timestamp: Date;
    rawData: any;
  }>> {
    const events: Array<{
      platformId: number;
      baseMint: string;
      quoteMint: string;
      poolAddress: string;
      price: number;
      volume24h: number;
      liquidity: number;
      timestamp: Date;
      rawData: any;
    }> = [];

    // Look for Jupiter swap events in accountData
    const swapAccounts = transaction.accountData.filter(
      acc => acc.type === 'swap' || acc.type === 'routeSwap'
    );

    for (const account of swapAccounts) {
      const data = account.data as Record<string, any>;
      
      // Jupiter provides input and output token information in the swap data
      if (data.inputMint && data.outputMint && data.amountIn && data.amountOut) {
        // Calculate price from swap amounts
        const amountIn = Number(data.amountIn);
        const amountOut = Number(data.amountOut);
        const price = amountOut / amountIn;

        // Jupiter aggregates liquidity from multiple sources
        const liquidity = data.totalLiquidity ? Number(data.totalLiquidity) : 0;
        const volume24h = data.volume24h ? Number(data.volume24h) : 0;

        events.push({
          platformId,
          baseMint: data.inputMint,
          quoteMint: data.outputMint,
          poolAddress: account.account,
          price,
          volume24h,
          liquidity,
          timestamp: new Date(transaction.timestamp),
          rawData: {
            ...data,
            routeType: data.routeType || 'unknown',
            slippage: data.slippage,
            priceImpact: data.priceImpact
          }
        });
      }
    }

    ServerLogger.debug('Extracted Jupiter price events', {
      component: 'TokenPriceService',
      action: 'extractJupiterPrices',
      eventCount: events.length,
      signature: transaction.signature
    });

    return events;
  }

  private async extractSerumPrices(
    transaction: HeliusWebhookData,
    platformId: number
  ): Promise<Array<{
    platformId: number;
    baseMint: string;
    quoteMint: string;
    poolAddress: string;
    price: number;
    volume24h: number;
    liquidity: number;
    timestamp: Date;
    rawData: any;
  }>> {
    const events: Array<{
      platformId: number;
      baseMint: string;
      quoteMint: string;
      poolAddress: string;
      price: number;
      volume24h: number;
      liquidity: number;
      timestamp: Date;
      rawData: any;
    }> = [];

    // Look for market state updates in accountData
    const marketAccounts = transaction.accountData.filter(
      acc => acc.type === 'market' || acc.type === 'orderbook'
    );

    for (const account of marketAccounts) {
      const data = account.data as Record<string, any>;
      
      // Serum markets store best bid/ask prices and order book depth
      if (data.baseMint && data.quoteMint && (data.bestBid || data.bestAsk)) {
        // Calculate mid price from best bid/ask
        const bestBid = Number(data.bestBid || 0);
        const bestAsk = Number(data.bestAsk || 0);
        const price = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : bestBid || bestAsk;

        // Calculate liquidity from order book depth
        const liquidity = data.liquidity ? Number(data.liquidity) : 0;
        const volume24h = data.volume24h ? Number(data.volume24h) : 0;

        events.push({
          platformId,
          baseMint: data.baseMint,
          quoteMint: data.quoteMint,
          poolAddress: account.account,
          price,
          volume24h,
          liquidity,
          timestamp: new Date(transaction.timestamp),
          rawData: {
            ...data,
            marketType: 'serum',
            baseDecimals: data.baseDecimals,
            quoteDecimals: data.quoteDecimals,
            bestBid,
            bestAsk
          }
        });
      }
    }

    ServerLogger.debug('Extracted Serum price events', {
      component: 'TokenPriceService',
      action: 'extractSerumPrices',
      eventCount: events.length,
      signature: transaction.signature
    });

    return events;
  }

  private async upsertPriceData(
    event: {
      platformId: number;
      baseMint: string;
      quoteMint: string;
      poolAddress: string;
      price: number;
      volume24h: number;
      liquidity: number;
      timestamp: Date;
      rawData: any;
    },
    client: Pool | PoolClient
  ): Promise<void> {
    try {
      // Get or create token pair
      const pairResult = await client.query(
        `INSERT INTO token_pairs (
          platform_id, base_mint, quote_mint, pool_address
        ) VALUES ($1, $2, $3, $4)
        ON CONFLICT (platform_id, pool_address)
        DO UPDATE SET
          base_mint = EXCLUDED.base_mint,
          quote_mint = EXCLUDED.quote_mint,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id`,
        [
          event.platformId,
          event.baseMint,
          event.quoteMint,
          event.poolAddress
        ]
      );
      const pairId = pairResult.rows[0].id;

      // Insert price data
      await client.query(
        `INSERT INTO token_prices (
          pair_id,
          price,
          volume_24h,
          liquidity,
          timestamp,
          raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          pairId,
          event.price,
          event.volume24h,
          event.liquidity,
          event.timestamp,
          event.rawData
        ]
      );

      ServerLogger.info('Processed token price data', {
        component: 'TokenPriceService',
        action: 'upsertPriceData',
        baseMint: event.baseMint,
        quoteMint: event.quoteMint,
        poolAddress: event.poolAddress
      });
    } catch (error) {
      ServerLogger.error('Failed to upsert price data', error as Error, {
        component: 'TokenPriceService',
        action: 'upsertPriceData',
        baseMint: event.baseMint,
        quoteMint: event.quoteMint
      });
      throw error;
    }
  }
} 