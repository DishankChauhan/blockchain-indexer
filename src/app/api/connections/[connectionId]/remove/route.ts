import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DatabaseService } from '@/lib/services/databaseService';
import { AppError } from '@/lib/utils/errorHandling';
import AppLogger from '@/lib/utils/logger';

export async function DELETE(
  request: Request,
  { params }: { params: { connectionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      AppLogger.warn('Unauthorized access attempt to remove connection', {
        component: 'ConnectionsAPI',
        action: 'RemoveConnection',
        connectionId: params.connectionId
      });
      throw new AppError('Unauthorized');
    }

    const userId = session.user?.id;
    if (!userId) {
      throw new AppError('User ID not found in session');
    }

    const dbService = DatabaseService.getInstance();
    const connection = await dbService.getConnection(params.connectionId, userId);

    if (!connection) {
      throw new AppError('Connection not found');
    }

    await dbService.removeConnection(params.connectionId, userId);

    AppLogger.info('Connection removed successfully', {
      component: 'ConnectionsAPI',
      action: 'RemoveConnection',
      connectionId: params.connectionId,
      userId
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    AppLogger.error('Failed to remove connection', error as Error, {
      component: 'ConnectionsAPI',
      action: 'RemoveConnection',
      connectionId: params.connectionId,
      path: `/api/connections/${params.connectionId}/remove`
    });

    if (error instanceof AppError) {
      const statusCode = error.message.includes('not found') ? 404 :
                        error.message.includes('Unauthorized') ? 403 : 401;
      return NextResponse.json({ error: error.message }, { status: statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 