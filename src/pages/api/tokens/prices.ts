import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { DatabaseService } from '@/lib/services/databaseService';
import { TokenPriceService } from '@/lib/services/tokenPriceService';
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
    const {
      baseMint,
      quoteMint,
      platform,
      minLiquidity,
      aggregated = 'false'
    } = req.query;

    const options = {
      baseMint: baseMint as string | undefined,
      quoteMint: quoteMint as string | undefined,
      platform: platform as string | undefined,
      minLiquidity: minLiquidity ? parseFloat(minLiquidity as string) : undefined
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
    
    const tokenPriceService = TokenPriceService.getInstance();

    // Get either aggregated or individual prices based on the query parameter
    const prices = aggregated === 'true'
      ? await tokenPriceService.getAggregatedPrices(pool, options)
      : await tokenPriceService.getCurrentPrices(pool, options);

    return res.status(200).json({
      prices,
      filters: options,
      aggregated: aggregated === 'true'
    });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(400).json({ error: error.message });
    }

    AppLogger.error('Failed to get token prices', error as Error, {
      component: 'API',
      action: 'getTokenPrices'
    });
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (pool) {
      await pool.end();
    }
  }
} 