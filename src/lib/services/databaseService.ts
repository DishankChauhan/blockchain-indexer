import { Pool } from 'pg';
import { AppError } from '@/lib/utils/errorHandling';
import { DatabaseCredentials } from '@/types';
import prisma from '@/lib/db';

export class DatabaseService {
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
        where: { id: connectionId },
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