import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { DatabaseService } from '@/lib/services/databaseService';
import { LendingService } from '@/lib/services/lendingService';
import { AppError } from '@/lib/utils/errorHandling';
import AppLogger from '@/lib/utils/logger';
import prisma from '@/lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let pool;
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Parse query parameters
    const { protocol, minLiquidity, maxBorrowRate } = req.query;
    const options = {
      protocolName: protocol as string | undefined,
      minLiquidity: minLiquidity ? parseFloat(minLiquidity as string) : undefined,
      maxBorrowRate: maxBorrowRate ? parseFloat(maxBorrowRate as string) : undefined
    };

    // Get the active database connection for the user
    const dbConnection = await prisma.databaseConnection.findFirst({
      where: {
        userId: session.user.id,
        status: 'active'
      }
    });

    if (!dbConnection) {
      return res.status(400).json({ error: 'No active database connection found' });
    }

    // Get a pool for the connection
    const dbService = DatabaseService.getInstance();
    pool = await dbService.getPoolForApi({
      host: dbConnection.host,
      port: dbConnection.port,
      database: dbConnection.database,
      username: dbConnection.username,
      password: dbConnection.password
    });
    
    const lendingService = LendingService.getInstance();
    const availableTokens = await lendingService.getAvailableTokens(pool, options);

    return res.status(200).json({
      tokens: availableTokens,
      filters: options
    });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(400).json({ error: error.message });
    }

    AppLogger.error('Failed to get available tokens', error as Error, {
      component: 'API',
      action: 'getAvailableTokens'
    });
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (pool) {
      await pool.end();
    }
  }
} 