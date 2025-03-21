import { Pool, PoolClient } from 'pg';
import { AppError } from '../utils/errorHandling';
import { logError, logInfo } from '../utils/serverLogger';
import { HeliusWebhookData } from '../types/helius';
import { RateLimiter } from 'limiter';

export interface TokenPrice {
  tokenMint: string;
  tokenName: string;
  priceUsd: number;
  volume24h?: number;
  marketCap?: number;
  platform: string;
  timestamp: Date;
  signature: string;
  rawData: any;
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

export interface TokenEvent {
  type: 'TOKEN_SWAP';
  signature: string;
  timestamp: number;
  tokenTransfers: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    mint: string;
    amount: number;
  }>;
  accountData: Array<{
    account: string;
    program: string;
    data: any;
  }>;
  raw: any;
}

export class TokenPriceService {
  private static instance: TokenPriceService | null = null;
  private readonly platformPrograms: Map<string, string>;
  private readonly baseUrl: string;
  private readonly rateLimiter: RateLimiter;
  private readonly supportedPlatforms: Set<string>;

  private constructor() {
    // Initialize known DEX and aggregator program IDs
    this.platformPrograms = new Map([
      ['675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', 'Raydium'],
      ['9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP', 'Orca'],
      ['JUP6i4ozu5ydDCnLiMogSckDPpbtr7BJ4FtzYWkb5Rk', 'Jupiter'],
      ['srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX', 'Serum']
    ]);
    this.baseUrl = process.env.HELIUS_API_URL || 'https://api.helius.xyz/v0';
    this.rateLimiter = new RateLimiter({
      tokensPerInterval: 50,
      interval: 'second',
      fireImmediately: true
    });
    this.supportedPlatforms = new Set([
      'Jupiter',
      'Raydium',
      'Orca'
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

      logInfo('Processing token price events', {
        component: 'TokenPriceService',
        action: 'processPriceEvent',
        signature: transaction.signature,
        eventCount: priceEvents.length
      });

      for (const event of priceEvents) {
        await this.upsertPriceData(event, client);
      }
    } catch (error) {
      logError('Failed to process price event', error as Error, {
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
        tokenMint: row.base_mint,
        tokenName: row.token_name || 'Unknown',
        priceUsd: parseFloat(row.price),
        volume24h: parseFloat(row.volume_24h),
        marketCap: parseFloat(row.market_cap),
        platform: row.platform_name,
        timestamp: new Date(row.timestamp),
        signature: row.signature,
        rawData: row.raw_data
      }));
    } catch (error) {
      logError('Failed to get current prices', error as Error, {
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
      logError('Failed to get aggregated prices', error as Error, {
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

    logInfo('Extracted Orca price events', {
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

    logInfo('Extracted Jupiter price events', {
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

    logInfo('Extracted Serum price events', {
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

      logInfo('Processed token price data', {
        component: 'TokenPriceService',
        action: 'upsertPriceData',
        baseMint: event.baseMint,
        quoteMint: event.quoteMint,
        poolAddress: event.poolAddress
      });
    } catch (error) {
      logError('Failed to upsert price data', error as Error, {
        component: 'TokenPriceService',
        action: 'upsertPriceData',
        baseMint: event.baseMint,
        quoteMint: event.quoteMint
      });
      throw error;
    }
  }

  public async fetchAndStoreData(dbPool: Pool): Promise<void> {
    try {
      logInfo('Starting token price data fetch', {
        component: 'TokenPriceService',
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

        const response = await fetch(`${this.baseUrl}/token-events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            query: {
              types: ['TOKEN_SWAP'],
              timeStart: startTime,
              timeEnd: endTime
            },
            options: { limit: batchSize }
          })
        });

        if (!response.ok) {
          throw new AppError(`Failed to fetch token events: ${response.statusText}`);
        }

        const events = await response.json() as TokenEvent[];
        const client = await dbPool.connect();
        
        try {
          await client.query('BEGIN');
          
          for (const event of events) {
            if (this.isValidTokenEvent(event)) {
              const price = this.extractTokenPrice(event);
              if (price) {
                await this.insertTokenPrice(price, client);
              }
            }
          }

          await client.query(`
            INSERT INTO indexer_state (key, value, updated_at)
            VALUES ('token_prices_last_processed', $1, NOW())
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
      }
    } catch (error) {
      logError('Failed to fetch and store token price data', error as Error, {
        component: 'TokenPriceService',
        action: 'fetchAndStoreData'
      });
      throw new AppError('Failed to fetch and store token price data');
    }
  }

  private async getLastProcessedTimestamp(dbPool: Pool): Promise<number | null> {
    try {
      const result = await dbPool.query(`
        SELECT value::bigint as timestamp
        FROM indexer_state
        WHERE key = 'token_prices_last_processed'
      `);
      return result.rows[0]?.timestamp || null;
    } catch (error) {
      logError('Failed to get last processed timestamp', error as Error, {
        component: 'TokenPriceService',
        action: 'getLastProcessedTimestamp'
      });
      return null;
    }
  }

  private isValidTokenEvent(event: TokenEvent | HeliusWebhookData): boolean {
    return event.type === 'TOKEN_SWAP' && 
           Array.isArray(event.tokenTransfers) &&
           event.tokenTransfers.length >= 2 &&
           event.signature !== undefined &&
           event.timestamp !== undefined;
  }

  private extractTokenPrice(event: TokenEvent | HeliusWebhookData): TokenPrice | null {
    try {
      const platform = this.getPlatform(event.accountData);
      if (!platform) return null;

      if (!event.tokenTransfers || event.tokenTransfers.length === 0) return null;

      const price = this.calculatePrice(event.tokenTransfers);
      if (!price) return null;

      return {
        tokenMint: event.tokenTransfers[0].mint,
        tokenName: '', // Token names are fetched separately if needed
        priceUsd: price,
        platform,
        timestamp: new Date(event.timestamp * 1000),
        signature: event.signature,
        rawData: event.raw
      };
    } catch (error) {
      logError('Failed to extract token price', error as Error, {
        component: 'TokenPriceService',
        action: 'extractTokenPrice',
        signature: event.signature
      });
      return null;
    }
  }

  private getPlatform(accountData: any[]): string | null {
    for (const account of accountData || []) {
      if (this.supportedPlatforms.has(account.program)) {
        return account.program;
      }
    }
    return null;
  }

  private calculatePrice(transfers: any[]): number | null {
    try {
      const inToken = transfers[0];
      const outToken = transfers[1];
      
      if (!inToken?.decimals || !outToken?.decimals) {
        return null;
      }

      return (outToken.amount * Math.pow(10, -outToken.decimals)) / 
             (inToken.amount * Math.pow(10, -inToken.decimals));
    } catch (error) {
      logError('Failed to calculate price', error as Error, {
        component: 'TokenPriceService',
        action: 'calculatePrice'
      });
      return null;
    }
  }

  public async processTokenEvent(
    event: HeliusWebhookData,
    client: Pool | PoolClient
  ): Promise<void> {
    try {
      if (!this.isValidTokenEvent(event)) {
        return;
      }

      const price = this.extractTokenPrice(event);
      if (!price) {
        return;
      }

      if (client instanceof Pool) {
        const poolClient = await client.connect();
        try {
          await poolClient.query('BEGIN');
          await this.insertTokenPrice(price, poolClient);
          await poolClient.query('COMMIT');
        } catch (error) {
          await poolClient.query('ROLLBACK');
          throw error;
        } finally {
          poolClient.release();
        }
      } else {
        await this.insertTokenPrice(price, client);
      }

      logInfo('Processed token price event', {
        component: 'TokenPriceService',
        action: 'processTokenEvent',
        signature: event.signature,
        tokenMint: price.tokenMint,
        price: price.priceUsd
      });
    } catch (error) {
      logError('Failed to process token price event', error as Error, {
        component: 'TokenPriceService',
        action: 'processTokenEvent',
        signature: event.signature
      });
      throw new AppError('Failed to process token price event');
    }
  }

  private async insertTokenPrice(price: TokenPrice, client: Pool | PoolClient): Promise<void> {
    await client.query(`
      INSERT INTO token_prices (
        signature,
        token_mint,
        token_name,
        price_usd,
        volume_24h,
        market_cap,
        platform,
        timestamp,
        raw_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (signature) DO UPDATE SET
        price_usd = EXCLUDED.price_usd,
        volume_24h = EXCLUDED.volume_24h,
        market_cap = EXCLUDED.market_cap,
        raw_data = EXCLUDED.raw_data
    `, [
      price.signature,
      price.tokenMint,
      price.tokenName,
      price.priceUsd,
      price.volume24h,
      price.marketCap,
      price.platform,
      price.timestamp,
      price.rawData
    ]);
  }

  public async getCurrentPrice(tokenMint: string, dbPool: Pool): Promise<any> {
    try {
      const result = await dbPool.query(`
        SELECT * FROM current_token_prices
        WHERE token_mint = $1
      `, [tokenMint]);

      return result.rows[0] || null;
    } catch (error) {
      logError('Failed to get current price', error as Error, {
        component: 'TokenPriceService',
        action: 'getCurrentPrice',
        tokenMint
      });
      throw error;
    }
  }

  public async cleanup(): Promise<void> {
    TokenPriceService.instance = null;
  }
} 