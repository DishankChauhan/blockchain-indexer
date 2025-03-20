import { Pool } from 'pg';
import { AppError } from '@/lib/utils/errorHandling';
import { DatabaseCredentials } from '@/types';
import prisma from '@/lib/db';
import { logError, logInfo } from '@/lib/utils/serverLogger';
import { SecretsManager } from '@/lib/utils/secrets';

export class DatabaseService {
  public async initializeTables(dbConnection: DatabaseCredentials, categories: { [key: string]: boolean }): Promise<void> {
    try {
      // Create a temporary pool for table initialization
      const pool = await this.createPool(dbConnection);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Create tables for enabled categories
        if (categories.transactions) {
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

        if (categories.nftEvents) {
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

          // Add NFT bids table
          await client.query(`
            CREATE TABLE IF NOT EXISTS nft_bids (
              id SERIAL PRIMARY KEY,
              signature VARCHAR(100) NOT NULL,
              mint_address TEXT NOT NULL,
              bidder_address TEXT NOT NULL,
              bid_amount NUMERIC NOT NULL,
              marketplace TEXT NOT NULL,
              currency TEXT NOT NULL,
              status TEXT NOT NULL,
              expiry_time TIMESTAMP,
              timestamp TIMESTAMP NOT NULL,
              raw_data JSONB NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(mint_address, bidder_address, marketplace)
            );
            CREATE INDEX IF NOT EXISTS idx_nft_bids_mint ON nft_bids(mint_address);
            CREATE INDEX IF NOT EXISTS idx_nft_bids_bidder ON nft_bids(bidder_address);
            CREATE INDEX IF NOT EXISTS idx_nft_bids_status ON nft_bids(status);
            CREATE INDEX IF NOT EXISTS idx_nft_bids_marketplace ON nft_bids(marketplace);
            CREATE INDEX IF NOT EXISTS idx_nft_bids_timestamp ON nft_bids(timestamp);

            -- Create a view for active bids
            CREATE OR REPLACE VIEW active_nft_bids AS
            SELECT 
              mint_address,
              marketplace,
              currency,
              COUNT(*) as total_bids,
              MIN(bid_amount) as min_bid,
              MAX(bid_amount) as max_bid,
              AVG(bid_amount) as avg_bid,
              json_agg(
                json_build_object(
                  'bidder', bidder_address,
                  'amount', bid_amount,
                  'timestamp', timestamp
                )
                ORDER BY bid_amount DESC
              ) as bids
            FROM nft_bids
            WHERE status = 'active'
            AND (expiry_time IS NULL OR expiry_time > NOW())
            GROUP BY mint_address, marketplace, currency;

            -- Create NFT prices table
            CREATE TABLE IF NOT EXISTS nft_prices (
              id SERIAL PRIMARY KEY,
              signature VARCHAR(100) NOT NULL,
              mint_address TEXT NOT NULL,
              price_type TEXT NOT NULL,
              price NUMERIC NOT NULL,
              marketplace TEXT NOT NULL,
              currency TEXT NOT NULL,
              seller_address TEXT,
              status TEXT NOT NULL,
              expiry_time TIMESTAMP,
              timestamp TIMESTAMP NOT NULL,
              raw_data JSONB NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(mint_address, marketplace, seller_address)
            );
            CREATE INDEX IF NOT EXISTS idx_nft_prices_mint ON nft_prices(mint_address);
            CREATE INDEX IF NOT EXISTS idx_nft_prices_marketplace ON nft_prices(marketplace);
            CREATE INDEX IF NOT EXISTS idx_nft_prices_status ON nft_prices(status);
            CREATE INDEX IF NOT EXISTS idx_nft_prices_timestamp ON nft_prices(timestamp);

            -- Create a view for current NFT prices
            CREATE OR REPLACE VIEW current_nft_prices AS
            WITH latest_sales AS (
              SELECT 
                mint_address,
                marketplace,
                currency,
                price,
                timestamp
              FROM nft_events
              WHERE event_type = 'NFT_SALE'
              AND timestamp >= NOW() - INTERVAL '30 days'
            ),
            active_listings AS (
              SELECT 
                mint_address,
                marketplace,
                currency,
                price,
                seller_address,
                timestamp
              FROM nft_prices
              WHERE status = 'active'
              AND price_type = 'listing'
              AND (expiry_time IS NULL OR expiry_time > NOW())
            )
            SELECT 
              p.mint_address,
              json_agg(
                DISTINCT jsonb_build_object(
                  'marketplace', p.marketplace,
                  'currency', p.currency,
                  'listPrice', p.price,
                  'seller', p.seller_address,
                  'listTimestamp', p.timestamp,
                  'lastSalePrice', (
                    SELECT s.price
                    FROM latest_sales s
                    WHERE s.mint_address = p.mint_address
                    AND s.marketplace = p.marketplace
                    ORDER BY s.timestamp DESC
                    LIMIT 1
                  ),
                  'lastSaleTimestamp', (
                    SELECT s.timestamp
                    FROM latest_sales s
                    WHERE s.mint_address = p.mint_address
                    AND s.marketplace = p.marketplace
                    ORDER BY s.timestamp DESC
                    LIMIT 1
                  )
                )
              ) as prices
            FROM active_listings p
            GROUP BY p.mint_address;
          `);
        }

        if (categories.tokenTransfers) {
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

        if (categories.programInteractions) {
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

        if (categories.lendingProtocols) {
          await client.query(`
            CREATE TABLE IF NOT EXISTS lending_protocols (
              id SERIAL PRIMARY KEY,
              program_id TEXT NOT NULL UNIQUE,
              name TEXT NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_lending_protocols_program ON lending_protocols(program_id);

            -- Insert known lending protocols
            INSERT INTO lending_protocols (program_id, name)
            VALUES 
              ('Port7uDYB3wk6GJAw4KT1WpTeMtSu9bTcChBHkX2LfR', 'Port Finance'),
              ('So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo', 'Solend'),
              ('MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA', 'Marginfi'),
              ('4UpD2fh7xH3VP9QQaXtsS1YY3bxzWhtfpks7FatyKvdY', 'Jet Protocol')
            ON CONFLICT (program_id) DO NOTHING;

            CREATE TABLE IF NOT EXISTS lending_pools (
              id SERIAL PRIMARY KEY,
              protocol_id INTEGER REFERENCES lending_protocols(id),
              pool_address TEXT NOT NULL,
              name TEXT NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(protocol_id, pool_address)
            );
            CREATE INDEX IF NOT EXISTS idx_lending_pools_protocol ON lending_pools(protocol_id);
            CREATE INDEX IF NOT EXISTS idx_lending_pools_address ON lending_pools(pool_address);

            CREATE TABLE IF NOT EXISTS lending_tokens (
              id SERIAL PRIMARY KEY,
              pool_id INTEGER REFERENCES lending_pools(id),
              mint_address TEXT NOT NULL,
              token_symbol TEXT NOT NULL,
              token_name TEXT NOT NULL,
              decimals INTEGER NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(pool_id, mint_address)
            );
            CREATE INDEX IF NOT EXISTS idx_lending_tokens_pool ON lending_tokens(pool_id);
            CREATE INDEX IF NOT EXISTS idx_lending_tokens_mint ON lending_tokens(mint_address);

            CREATE TABLE IF NOT EXISTS lending_rates (
              id SERIAL PRIMARY KEY,
              token_id INTEGER REFERENCES lending_tokens(id),
              borrow_rate NUMERIC NOT NULL,
              supply_rate NUMERIC NOT NULL,
              total_supply NUMERIC NOT NULL,
              available_liquidity NUMERIC NOT NULL,
              borrowed_amount NUMERIC NOT NULL,
              utilization_rate NUMERIC NOT NULL,
              collateral_factor NUMERIC NOT NULL,
              timestamp TIMESTAMP NOT NULL,
              raw_data JSONB NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_lending_rates_token ON lending_rates(token_id);
            CREATE INDEX IF NOT EXISTS idx_lending_rates_timestamp ON lending_rates(timestamp);

            -- Create a view for available tokens to borrow
            CREATE OR REPLACE VIEW available_lending_tokens AS
            WITH latest_rates AS (
              SELECT DISTINCT ON (token_id)
                token_id,
                borrow_rate,
                supply_rate,
                total_supply,
                available_liquidity,
                borrowed_amount,
                utilization_rate,
                collateral_factor,
                timestamp
              FROM lending_rates
              WHERE timestamp >= NOW() - INTERVAL '1 hour'
              ORDER BY token_id, timestamp DESC
            )
            SELECT 
              lp.name as protocol_name,
              lpo.name as pool_name,
              lt.token_symbol,
              lt.token_name,
              lt.mint_address,
              lt.decimals,
              lr.borrow_rate,
              lr.supply_rate,
              lr.total_supply,
              lr.available_liquidity,
              lr.borrowed_amount,
              lr.utilization_rate,
              lr.collateral_factor,
              lr.timestamp as last_updated
            FROM latest_rates lr
            JOIN lending_tokens lt ON lt.id = lr.token_id
            JOIN lending_pools lpo ON lpo.id = lt.pool_id
            JOIN lending_protocols lp ON lp.id = lpo.protocol_id
            WHERE lr.available_liquidity > 0
            ORDER BY lr.borrow_rate ASC;
          `);
        }

        if (categories.tokenPlatforms) {
          await client.query(`
            CREATE TABLE IF NOT EXISTS token_platforms (
              id SERIAL PRIMARY KEY,
              program_id TEXT NOT NULL UNIQUE,
              name TEXT NOT NULL,
              type TEXT NOT NULL, -- 'dex' or 'aggregator'
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_token_platforms_program ON token_platforms(program_id);

            -- Insert known DEXs and aggregators
            INSERT INTO token_platforms (program_id, name, type)
            VALUES 
              ('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', 'Raydium', 'dex'),
              ('9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP', 'Orca', 'dex'),
              ('JUP6i4ozu5ydDCnLiMogSckDPpbtr7BJ4FtzYWkb5Rk', 'Jupiter', 'aggregator'),
              ('srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX', 'Serum', 'dex')
            ON CONFLICT (program_id) DO NOTHING;

            CREATE TABLE IF NOT EXISTS token_pairs (
              id SERIAL PRIMARY KEY,
              platform_id INTEGER REFERENCES token_platforms(id),
              base_mint TEXT NOT NULL,
              quote_mint TEXT NOT NULL,
              pool_address TEXT NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(platform_id, pool_address)
            );
            CREATE INDEX IF NOT EXISTS idx_token_pairs_platform ON token_pairs(platform_id);
            CREATE INDEX IF NOT EXISTS idx_token_pairs_base_mint ON token_pairs(base_mint);
            CREATE INDEX IF NOT EXISTS idx_token_pairs_quote_mint ON token_pairs(quote_mint);
            CREATE INDEX IF NOT EXISTS idx_token_pairs_pool ON token_pairs(pool_address);

            CREATE TABLE IF NOT EXISTS token_prices (
              id SERIAL PRIMARY KEY,
              pair_id INTEGER REFERENCES token_pairs(id),
              price NUMERIC NOT NULL,
              volume_24h NUMERIC NOT NULL,
              liquidity NUMERIC NOT NULL,
              timestamp TIMESTAMP NOT NULL,
              raw_data JSONB NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_token_prices_pair ON token_prices(pair_id);
            CREATE INDEX IF NOT EXISTS idx_token_prices_timestamp ON token_prices(timestamp);

            -- Create a view for current token prices
            CREATE OR REPLACE VIEW current_token_prices AS
            WITH latest_prices AS (
              SELECT DISTINCT ON (pair_id)
                pair_id,
                price,
                volume_24h,
                liquidity,
                timestamp
              FROM token_prices
              WHERE timestamp >= NOW() - INTERVAL '1 hour'
              ORDER BY pair_id, timestamp DESC
            )
            SELECT 
              tp.base_mint,
              tp.quote_mint,
              tpl.name as platform_name,
              tpl.type as platform_type,
              tp.pool_address,
              lp.price,
              lp.volume_24h,
              lp.liquidity,
              lp.timestamp as last_updated
            FROM latest_prices lp
            JOIN token_pairs tp ON tp.id = lp.pair_id
            JOIN token_platforms tpl ON tpl.id = tp.platform_id
            WHERE lp.liquidity > 0
            ORDER BY lp.volume_24h DESC;

            -- Create a view for token price aggregation
            CREATE OR REPLACE VIEW aggregated_token_prices AS
            WITH latest_prices AS (
              SELECT DISTINCT ON (pair_id)
                pair_id,
                price,
                volume_24h,
                liquidity,
                timestamp
              FROM token_prices
              WHERE timestamp >= NOW() - INTERVAL '1 hour'
              ORDER BY pair_id, timestamp DESC
            )
            SELECT 
              tp.base_mint,
              tp.quote_mint,
              COUNT(*) as platform_count,
              MIN(lp.price) as min_price,
              MAX(lp.price) as max_price,
              AVG(lp.price) as avg_price,
              SUM(lp.volume_24h) as total_volume_24h,
              SUM(lp.liquidity) as total_liquidity,
              json_agg(
                json_build_object(
                  'platform', tpl.name,
                  'type', tpl.type,
                  'pool', tp.pool_address,
                  'price', lp.price,
                  'volume', lp.volume_24h,
                  'liquidity', lp.liquidity,
                  'timestamp', lp.timestamp
                )
                ORDER BY lp.volume_24h DESC
              ) as platforms
            FROM latest_prices lp
            JOIN token_pairs tp ON tp.id = lp.pair_id
            JOIN token_platforms tpl ON tpl.id = tp.platform_id
            WHERE lp.liquidity > 0
            GROUP BY tp.base_mint, tp.quote_mint;
          `);
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        logError('Failed to initialize tables', error as Error, {
          component: 'DatabaseService',
          action: 'initializeTables',
          categories: JSON.stringify(categories)
        });
        throw error;
      } finally {
        client.release();
        await pool.end(); // Clean up the temporary pool
      }
    } catch (error) {
      logError('Failed to initialize tables', error as Error, {
        component: 'DatabaseService',
        action: 'initializeTables',
        categories: JSON.stringify(categories)
      });
      throw new AppError('Failed to initialize database tables');
    }
  }

  private static instance: DatabaseService;
  private connectionPools: Map<string, Pool>;
  private secretsManager: SecretsManager;

  private constructor() {
    this.connectionPools = new Map();
    this.secretsManager = SecretsManager.getInstance();
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public async listConnections(userId: string) {
    try {
      const connections = await prisma.databaseConnection.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          host: true,
          port: true,
          database: true,
          username: true,
          status: true,
          lastConnectedAt: true,
          createdAt: true
        }
      });
      return connections;
    } catch (error) {
      throw new AppError('Failed to list database connections');
    }
  }

  private async createPool(credentials: DatabaseCredentials): Promise<Pool> {
    const pool = new Pool({
      host: credentials.host,
      port: credentials.port,
      database: credentials.database,
      user: credentials.username,
      password: credentials.password,
      ssl: process.env.NODE_ENV === 'production',
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Test the connection
    try {
      const client = await pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      return pool;
    } catch (error) {
      await pool.end();
      throw new AppError(
        'Failed to connect to database'
      );
    }
  }

  public async testConnection(credentials: DatabaseCredentials): Promise<boolean> {
    try {
      const pool = await this.createPool(credentials);
      await pool.end();
      return true;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        'Database connection test failed'
      );
    }
  }

  public async saveConnection(
    userId: string,
    credentials: DatabaseCredentials
  ): Promise<void> {
    try {
      // Test connection first
      await this.testConnection(credentials);

      // Encrypt password
      const encryptedPassword = await this.encryptPassword(credentials.password);

      // Save to database
      await prisma.databaseConnection.create({
        data: {
          userId,
          host: credentials.host,
          port: credentials.port,
          database: credentials.database,
          username: credentials.username,
          password: encryptedPassword,
          status: 'active',
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        'Failed to save database connection'
      );
    }
  }

  public async getConnection(connectionId: string, userId: string): Promise<Pool> {
    try {
      const connection = await prisma.databaseConnection.findFirst({
        where: { id: connectionId, userId },
      });

      if (!connection) {
        throw new AppError(
          'Database connection not found'
        );
      }

      // Check if we already have a pool
      let pool = this.connectionPools.get(connectionId);
      if (!pool) {
        // Decrypt password
        const decryptedPassword = await this.decryptPassword(connection.password);

        pool = await this.createPool({
          host: connection.host,
          port: connection.port,
          database: connection.database,
          username: connection.username,
          password: decryptedPassword,
        });
        this.connectionPools.set(connectionId, pool);
      }

      return pool;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        'Failed to get database connection'
      );
    }
  }

  public async updateConnectionStatus(
    connectionId: string,
    userId: string,
    status: string
  ): Promise<void> {
    try {
      await prisma.databaseConnection.update({
        where: { 
          id: connectionId,
          userId: userId 
        },
        data: {
          status,
          lastConnectedAt: status === 'active' ? new Date() : undefined,
        },
      });
    } catch (error) {
      throw new AppError(
        'Failed to update connection status'
      );
    }
  }
  public async cleanup(): Promise<void> {
    for (const pool of Array.from(this.connectionPools.values())) {
      await pool.end();
    }
    this.connectionPools.clear();
  }

  public async getPoolForApi(credentials: DatabaseCredentials): Promise<Pool> {
    try {
      const pool = await this.createPool(credentials);
      return pool;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        'Failed to create database pool'
      );
    }
  }

  private async encryptPassword(password: string): Promise<string> {
    const key = `db_password_${Date.now()}`;
    await this.secretsManager.setSecret(key, password);
    return key;
  }

  private async decryptPassword(key: string): Promise<string> {
    return await this.secretsManager.getSecret(key);
  }
} 