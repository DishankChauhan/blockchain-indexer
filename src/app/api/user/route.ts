import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logError } from '@/lib/utils/serverLogger';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        notifications: {
          where: { status: 'unread' },
          select: {
            id: true,
            type: true,
            message: true,
            createdAt: true
          }
        }
      }
    });

    if (!user) {
      return new NextResponse('User not found', { status: 404 });
    }

    return NextResponse.json({ data: user });
  } catch (error) {
    logError('Failed to get user data', error as Error, {
      component: 'UserAPI',
      action: 'GET'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 