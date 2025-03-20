import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DatabaseService } from '@/lib/services/databaseService';
import { AppError } from '@/lib/utils/errorHandling';
import { logError, logInfo, logWarn } from '@/lib/utils/serverLogger';
import { DatabaseCredentials } from '@/types';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      logWarn('Unauthorized access attempt to database connection endpoint', {
        message: 'Unauthorized access attempt to database connection endpoint',
        service: 'DatabaseAPI',
        action: 'Connect'
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const data = await request.json();

    // Validate required fields
    const requiredFields = ['host', 'port', 'database', 'username', 'password'];
    const missingFields = requiredFields.filter(field => !data[field]);
    if (missingFields.length > 0) {
      logWarn(`Missing required fields: ${missingFields.join(', ')}`, {
        message: `Missing required fields: ${missingFields.join(', ')}`,
        service: 'DatabaseAPI',
        action: 'Connect',
        userId,
        missingFields
      });
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    const credentials: DatabaseCredentials = {
      host: data.host,
      port: parseInt(data.port),
      database: data.database,
      username: data.username,
      password: data.password,
    };

    // Test the connection first
    const dbService = DatabaseService.getInstance();
    const isValid = await dbService.testConnection(credentials);
    if (!isValid) {
      logWarn('Invalid database credentials provided', {
        message: 'Invalid database credentials provided',
        service: 'DatabaseAPI',
        action: 'Connect',
        userId,
        host: credentials.host,
        database: credentials.database
      });
      return NextResponse.json(
        { error: 'Invalid database credentials' },
        { status: 400 }
      );
    }

    // Save the connection
    await dbService.saveConnection(userId, credentials);
    
    // Get the saved connection details to return
    const connections = await dbService.listConnections(userId);
    const savedConnection = connections.find(
      conn => 
        conn.host === credentials.host && 
        conn.port === credentials.port && 
        conn.database === credentials.database
    );

    if (!savedConnection) {
      throw new Error('Failed to save database connection');
    }

    logInfo('Successfully created database connection', {
      message: 'Successfully created database connection',
      service: 'DatabaseAPI',
      action: 'Connect',
      userId,
      connectionId: savedConnection.id,
      host: savedConnection.host,
      database: savedConnection.database
    });

    return NextResponse.json(savedConnection);
  } catch (error) {
    const err = error as Error;
    logError('Error creating database connection', {
      message: err.message,
      name: err.name,
      stack: err.stack
    }, {
      service: 'DatabaseAPI',
      action: 'Connect',
      path: '/api/database/connect'
    });
    return NextResponse.json(
      { error: 'Failed to create database connection' },
      { status: 500 }
    );
  }
} 