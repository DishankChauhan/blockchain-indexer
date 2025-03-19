import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DatabaseService } from '@/lib/services/databaseService';
import prisma from '@/lib/db';

export async function POST(
  req: Request,
  { params }: { params: { connectionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return new NextResponse('User not found', { status: 404 });
    }

    const { connectionId } = params;
    const dbService = DatabaseService.getInstance();

    // Get the connection details
    const connection = await prisma.databaseConnection.findFirst({
      where: {
        id: connectionId,
        userId: user.id
      }
    });

    if (!connection) {
      return new NextResponse('Connection not found', { status: 404 });
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
    await dbService.updateConnectionStatus(connectionId, user.id, 'active');

    return NextResponse.json({ message: 'Connection test successful' });
  } catch (error) {
    console.error('Test connection error:', error);
    return new NextResponse('Failed to test connection', { status: 500 });
  }
} 