import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { logError, logWarn } from '@/lib/utils/serverLogger';

export async function GET(request: Request) {
  let session;
  try {
    session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      logWarn('Unauthorized access attempt to notifications', {
        message: 'Unauthorized access attempt to notifications',
        path: '/api/notifications',
        method: 'GET'
      });
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      logWarn('User not found for notifications request', {
        message: 'User not found for notifications request',
        path: '/api/notifications',
        method: 'GET',
        email: session.user.email
      });
      return new NextResponse('User not found', { status: 404 });
    }

    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10 // Limit to 10 most recent notifications
    });

    return NextResponse.json(notifications);
  } catch (error) {
    const err = error as Error;
    logError('Failed to fetch notifications', {
      message: err.message,
      name: err.name,
      stack: err.stack
    }, {
      path: '/api/notifications',
      method: 'GET',
      userId: session?.user?.email || undefined,
      statusCode: 500
    });
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 