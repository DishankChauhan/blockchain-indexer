import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DatabaseService } from '@/lib/services/databaseService';
import { AppError } from '@/lib/utils/errorHandling';
import AppLogger from '@/lib/utils/logger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(
  request: Request,
  { params }: { params: { connectionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      AppLogger.warn('Unauthorized access attempt to test connection', {
        component: 'ConnectionsAPI',
        action: 'TestConnection',
        connectionId: params.connectionId
      });
      throw new AppError('Unauthorized');
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      throw new AppError('User not found');
    }

    const dbService = DatabaseService.getInstance();

    // Get the connection details
    const connection = await prisma.databaseConnection.findFirst({
      where: {
        id: params.connectionId,
        userId: user.id
      }
    });

    if (!connection) {
      throw new AppError('Connection not found');
    }

    // Test the connection
    await dbService.testConnection({
      host: connection.host,
      port: connection.port,
      database: connection.database,
      username: connection.username,
      password: connection.password
    });

    // Update connection status
    await dbService.updateConnectionStatus(params.connectionId, user.id, 'active');

    AppLogger.info('Connection test successful', {
      component: 'ConnectionsAPI',
      action: 'TestConnection',
      connectionId: params.connectionId,
      userId: user.id
    });

    return NextResponse.json({ success: true, message: 'Connection test successful' });
  } catch (error) {
    AppLogger.error('Failed to test connection', error as Error, {
      component: 'ConnectionsAPI',
      action: 'TestConnection',
      connectionId: params.connectionId,
      path: `/api/connections/${params.connectionId}/test`
    });

    if (error instanceof AppError) {
      const statusCode = error.message.includes('not found') ? 404 :
                        error.message.includes('Unauthorized') ? 403 : 401;
      return NextResponse.json({ error: error.message }, { status: statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 