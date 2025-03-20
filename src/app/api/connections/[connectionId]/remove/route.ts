import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logError, logInfo, logWarn } from '@/lib/utils/serverLogger';
import prisma from '@/lib/prisma';

interface Props {
  params: { connectionId: string }
}

export async function DELETE(req: Request, { params }: Props) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      logWarn('Unauthorized access attempt to remove connection', {
        component: 'ConnectionRemoveAPI',
        action: 'DELETE',
        connectionId: params.connectionId
      });
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const connection = await prisma.databaseConnection.findFirst({
      where: {
        id: params.connectionId,
        userId: session.user.id
      }
    });

    if (!connection) {
      return new NextResponse('Connection not found', { status: 404 });
    }

    await prisma.databaseConnection.delete({
      where: { id: params.connectionId }
    });

    logInfo('Connection removed successfully', {
      component: 'ConnectionRemoveAPI',
      action: 'DELETE',
      connectionId: params.connectionId
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    logError('Failed to remove connection', error as Error, {
      component: 'ConnectionRemoveAPI',
      action: 'DELETE',
      connectionId: params.connectionId
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 