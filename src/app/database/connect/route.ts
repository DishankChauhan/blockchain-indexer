import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DatabaseService } from '@/lib/services/databaseService';
import { AppError } from '@/lib/utils/errorHandling';
import AppLogger from '@/lib/utils/logger';
import { DatabaseCredentials, DatabaseConnection } from '@/types';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      AppLogger.warn('Unauthorized access attempt to create database connection', {
        component: 'DatabaseAPI',
        action: 'Connect'
      });
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

    // Validate required fields
    if (!credentials.host || !credentials.port || !credentials.database || 
        !credentials.username || !credentials.password) {
      AppLogger.warn('Invalid database credentials', {
        component: 'DatabaseAPI',
        action: 'Connect',
        userId,
        hasHost: !!credentials.host,
        hasPort: !!credentials.port,
        hasDatabase: !!credentials.database,
        hasUsername: !!credentials.username
      });
      throw new AppError('Missing required database credentials');
    }

    const dbService = DatabaseService.getInstance();
    
    // Test connection
    await dbService.testConnection(credentials);
    
    // Save connection
    const connection = await dbService.saveConnection(userId, credentials) as DatabaseConnection;

    AppLogger.info('Database connection created successfully', {
      component: 'DatabaseAPI',
      action: 'Connect',
      userId,
      connectionId: connection.id
    });

    return NextResponse.json({
      success: true,
      connection: {
        id: connection.id,
        host: connection.host,
        database: connection.database,
        status: connection.status
      }
    });
  } catch (error) {
    AppLogger.error('Failed to create database connection', error as Error, {
      component: 'DatabaseAPI',
      action: 'Connect',
      path: '/api/database/connect'
    });

    if (error instanceof AppError) {
      const statusCode = error.message.includes('Unauthorized') ? 401 :
                        error.message.includes('not found') ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status: statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 