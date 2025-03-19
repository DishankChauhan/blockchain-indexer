import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import AppLogger from '@/lib/utils/logger';

export async function GET(request: Request) {
  let session;
  try {
    session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      AppLogger.warn('Unauthorized access attempt to notifications', {
        path: '/api/notifications',
        method: 'GET',
      });
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      AppLogger.warn('User not found for notifications request', {
        path: '/api/notifications',
        method: 'GET',
        email: session.user.email,
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
    AppLogger.error('Failed to fetch notifications', error as Error, {
      path: '/api/notifications',
      method: 'GET',
      userId: session?.user?.email || undefined,
      statusCode: 500,
    });
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 