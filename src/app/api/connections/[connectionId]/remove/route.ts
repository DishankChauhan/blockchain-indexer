import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
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

    // Check if connection exists and belongs to user
    const connection = await prisma.databaseConnection.findFirst({
      where: {
        id: connectionId,
        userId: user.id
      }
    });

    if (!connection) {
      return new NextResponse('Connection not found', { status: 404 });
    }

    // Delete the connection
    await prisma.databaseConnection.delete({
      where: { id: connectionId }
    });

    return NextResponse.json({ message: 'Connection removed successfully' });
  } catch (error) {
    console.error('Remove connection error:', error);
    return new NextResponse('Failed to remove connection', { status: 500 });
  }
} 