import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { DatabaseService } from '@/lib/services/databaseService';
import { logError, logInfo } from '@/lib/utils/serverLogger';

export async function POST(
  request: Request,
  { params }: { params: { connectionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { connectionId } = params;

    // Get the connection
    const connection = await prisma.databaseConnection.findFirst({
      where: {
        id: connectionId,
        userId: session.user.id
      }
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    // Test the connection
    const dbService = DatabaseService.getInstance();
    const pool = await dbService.getConnection(connectionId, session.user.id);
    const isValid = pool !== null;

    // Update connection status
    await prisma.databaseConnection.update({
      where: { id: connectionId },
      data: {
        status: isValid ? 'active' : 'error',
        updatedAt: new Date()
      }
    });

    logInfo('Successfully tested database connection', {
      component: 'ConnectionsAPI',
      action: 'Test',
      userId: session.user.id,
      connectionId: connectionId,
      status: isValid ? 'active' : 'error'
    });

    return NextResponse.json({
      data: {
        status: isValid ? 'active' : 'error'
      }
    });
  } catch (error) {
    logError('Failed to test database connection', error as Error, {
      component: 'ConnectionsAPI',
      action: 'Test'
    });
    return NextResponse.json(
      { error: 'Failed to test connection' },
      { status: 500 }
    );
  }
} 