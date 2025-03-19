import { Pool } from 'pg';
import { AppError } from '@/lib/utils/errorHandling';
import { DatabaseCredentials } from '@/types';
import prisma from '@/lib/db';

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

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
        await pool.end(); // Clean up the temporary pool
      }
    } catch (error) {
      console.error('Failed to initialize tables:', error);
      throw new AppError('Failed to initialize database tables');
    }
  }

  private static instance: DatabaseService;
  private connectionPools: Map<string, Pool>;

  private constructor() {
    this.connectionPools = new Map();
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

      // Save to database
      await prisma.databaseConnection.create({
        data: {
          userId,
          host: credentials.host,
          port: credentials.port,
          database: credentials.database,
          username: credentials.username,
          password: credentials.password, // In production, encrypt this
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
        pool = await this.createPool({
          host: connection.host,
          port: connection.port,
          database: connection.database,
          username: connection.username,
          password: connection.password,
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
} 