import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DatabaseService } from '@/lib/services/databaseService';
import { AppError } from '@/lib/utils/errorHandling';
import AppLogger from '@/lib/utils/logger';
import { DatabaseCredentials } from '@/types';

const databaseService = DatabaseService.getInstance();

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      throw new AppError('Unauthorized');
    }

    const userId = session.user?.id;
    if (!userId) {
      throw new AppError('User ID not found in session');
    }

    const connections = await databaseService.listConnections(userId);
    return NextResponse.json(connections);
  } catch (error) {
    AppLogger.error('Failed to list connections', error as Error, {
      component: 'ConnectionsAPI',
      action: 'GET',
      path: '/api/connections'
    });

    if (error instanceof AppError) {
      const statusCode = error.message.includes('not found') ? 404 :
                        error.message.includes('Unauthorized') ? 403 : 401;
      return NextResponse.json({ error: error.message }, { status: statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      throw new AppError('Unauthorized');
    }

    const userId = session.user?.id;
    if (!userId) {
      throw new AppError('User ID not found in session');
    }

    const body = await request.json();
    const credentials: DatabaseCredentials = {
      host: body.host,
      port: Number(body.port),
      database: body.database,
      username: body.username,
      password: body.password
    };

    if (!credentials.host || !credentials.port || !credentials.database || 
        !credentials.username || !credentials.password) {
      throw new AppError('Missing required fields');
    }

    await databaseService.saveConnection(userId, credentials);

    AppLogger.info('Database connection created successfully', {
      component: 'ConnectionsAPI',
      action: 'POST',
      userId,
      connectionHost: credentials.host
    });

    return NextResponse.json({ message: 'Database connection created successfully' });
  } catch (error) {
    AppLogger.error('Failed to create connection', error as Error, {
      component: 'ConnectionsAPI',
      action: 'POST',
      path: '/api/connections'
    });

    if (error instanceof AppError) {
      const statusCode = error.message.includes('not found') ? 404 :
                        error.message.includes('Unauthorized') ? 403 : 401;
      return NextResponse.json({ error: error.message }, { status: statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}