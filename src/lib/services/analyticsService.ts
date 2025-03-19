import { Pool } from 'pg';
import { AppError } from '@/lib/utils/errorHandling';
import { prisma } from '@/lib/db';

export interface TimeRange {
  startDate: Date;
  endDate: Date;
}

export interface TransactionMetrics {
  totalTransactions: number;
  successRate: number;
  averageFee: number;
  programDistribution: Record<string, number>;
}

export interface NFTMetrics {
  totalSales: number;
  totalVolume: number;
  uniqueBuyers: number;
  uniqueSellers: number;
  averagePrice: number;
}

export interface TokenMetrics {
  totalTransfers: number;
  uniqueTokens: number;
  topSenders: Array<{ address: string; count: number }>;
  topReceivers: Array<{ address: string; count: number }>;
}

export class AnalyticsService {
  private static instance: AnalyticsService;
  private constructor() {}

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  async getTransactionMetrics(userId: string, timeRange: TimeRange): Promise<TransactionMetrics> {
    try {
      // Get the user's active database connection
      const connection = await prisma.databaseConnection.findFirst({
        where: { userId, status: 'active' }
      });

      if (!connection) {
        throw new AppError('No active database connection found');
      }

      // Create a pool for the user's database
      const pool = new Pool({
        host: connection.host,
        port: connection.port,
        database: connection.database,
        user: connection.username,
        password: connection.password
      });

      const client = await pool.connect();
      try {
        // Get total transactions and success rate
        const transactionStats = await client.query(`
          SELECT 
            COUNT(*) as total,
            AVG(CASE WHEN success THEN 1 ELSE 0 END) as success_rate,
            AVG(fee) as avg_fee
          FROM transactions
          WHERE timestamp BETWEEN $1 AND $2
        `, [timeRange.startDate, timeRange.endDate]);

        // Get program distribution
        const programStats = await client.query(`
          SELECT 
            unnest(program_ids) as program_id,
            COUNT(*) as count
          FROM transactions
          WHERE timestamp BETWEEN $1 AND $2
          GROUP BY program_id
          ORDER BY count DESC
          LIMIT 10
        `, [timeRange.startDate, timeRange.endDate]);

        const programDistribution = programStats.rows.reduce((acc, row) => {
          acc[row.program_id] = parseInt(row.count);
          return acc;
        }, {} as Record<string, number>);

        return {
          totalTransactions: parseInt(transactionStats.rows[0].total),
          successRate: parseFloat(transactionStats.rows[0].success_rate),
          averageFee: parseFloat(transactionStats.rows[0].avg_fee),
          programDistribution
        };
      } finally {
        client.release();
        await pool.end();
      }
    } catch (error) {
      throw new AppError(`Failed to get transaction metrics: ${error}`);
    }
  }

  async getNFTMetrics(userId: string, timeRange: TimeRange): Promise<NFTMetrics> {
    try {
      const connection = await prisma.databaseConnection.findFirst({
        where: { userId, status: 'active' }
      });

      if (!connection) {
        throw new AppError('No active database connection found');
      }

      const pool = new Pool({
        host: connection.host,
        port: connection.port,
        database: connection.database,
        user: connection.username,
        password: connection.password
      });

      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT 
            COUNT(*) as total_sales,
            SUM(price) as total_volume,
            COUNT(DISTINCT buyer) as unique_buyers,
            COUNT(DISTINCT seller) as unique_sellers,
            AVG(price) as average_price
          FROM nft_events
          WHERE 
            timestamp BETWEEN $1 AND $2
            AND event_type = 'sale'
        `, [timeRange.startDate, timeRange.endDate]);

        const row = result.rows[0];
        return {
          totalSales: parseInt(row.total_sales),
          totalVolume: parseFloat(row.total_volume),
          uniqueBuyers: parseInt(row.unique_buyers),
          uniqueSellers: parseInt(row.unique_sellers),
          averagePrice: parseFloat(row.average_price)
        };
      } finally {
        client.release();
        await pool.end();
      }
    } catch (error) {
      throw new AppError(`Failed to get NFT metrics: ${error}`);
    }
  }

  async getTokenMetrics(userId: string, timeRange: TimeRange): Promise<TokenMetrics> {
    try {
      const connection = await prisma.databaseConnection.findFirst({
        where: { userId, status: 'active' }
      });

      if (!connection) {
        throw new AppError('No active database connection found');
      }

      const pool = new Pool({
        host: connection.host,
        port: connection.port,
        database: connection.database,
        user: connection.username,
        password: connection.password
      });

      const client = await pool.connect();
      try {
        // Get basic metrics
        const basicMetrics = await client.query(`
          SELECT 
            COUNT(*) as total_transfers,
            COUNT(DISTINCT token_address) as unique_tokens
          FROM token_transfers
          WHERE timestamp BETWEEN $1 AND $2
        `, [timeRange.startDate, timeRange.endDate]);

        // Get top senders
        const topSenders = await client.query(`
          SELECT 
            from_address as address,
            COUNT(*) as count
          FROM token_transfers
          WHERE timestamp BETWEEN $1 AND $2
          GROUP BY from_address
          ORDER BY count DESC
          LIMIT 5
        `, [timeRange.startDate, timeRange.endDate]);

        // Get top receivers
        const topReceivers = await client.query(`
          SELECT 
            to_address as address,
            COUNT(*) as count
          FROM token_transfers
          WHERE timestamp BETWEEN $1 AND $2
          GROUP BY to_address
          ORDER BY count DESC
          LIMIT 5
        `, [timeRange.startDate, timeRange.endDate]);

        return {
          totalTransfers: parseInt(basicMetrics.rows[0].total_transfers),
          uniqueTokens: parseInt(basicMetrics.rows[0].unique_tokens),
          topSenders: topSenders.rows.map(row => ({
            address: row.address,
            count: parseInt(row.count)
          })),
          topReceivers: topReceivers.rows.map(row => ({
            address: row.address,
            count: parseInt(row.count)
          }))
        };
      } finally {
        client.release();
        await pool.end();
      }
    } catch (error) {
      throw new AppError(`Failed to get token metrics: ${error}`);
    }
  }

  async getHistoricalTrends(userId: string, timeRange: TimeRange, interval: string): Promise<any> {
    try {
      const connection = await prisma.databaseConnection.findFirst({
        where: { userId, status: 'active' }
      });

      if (!connection) {
        throw new AppError('No active database connection found');
      }

      const pool = new Pool({
        host: connection.host,
        port: connection.port,
        database: connection.database,
        user: connection.username,
        password: connection.password
      });

      const client = await pool.connect();
      try {
        const trends = await client.query(`
          WITH time_series AS (
            SELECT 
              date_trunc($3, timestamp) as period,
              COUNT(*) as transaction_count,
              AVG(fee) as avg_fee
            FROM transactions
            WHERE timestamp BETWEEN $1 AND $2
            GROUP BY period
            ORDER BY period
          )
          SELECT 
            period,
            transaction_count,
            avg_fee,
            transaction_count - lag(transaction_count) OVER (ORDER BY period) as count_change,
            (avg_fee - lag(avg_fee) OVER (ORDER BY period)) / lag(avg_fee) OVER (ORDER BY period) * 100 as fee_change_percent
          FROM time_series
        `, [timeRange.startDate, timeRange.endDate, interval]);

        return trends.rows.map(row => ({
          period: row.period,
          transactionCount: parseInt(row.transaction_count),
          averageFee: parseFloat(row.avg_fee),
          countChange: parseInt(row.count_change || 0),
          feeChangePercent: parseFloat(row.fee_change_percent || 0)
        }));
      } finally {
        client.release();
        await pool.end();
      }
    } catch (error) {
      throw new AppError(`Failed to get historical trends: ${error}`);
    }
  }
} 