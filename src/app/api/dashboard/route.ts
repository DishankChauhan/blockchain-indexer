import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logError } from '@/lib/utils/serverLogger';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const userData = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        webhooks: true,
        dbConnections: true,
        indexingJobs: true
      }
    });

    if (!userData) {
      return NextResponse.json({ 
        data: {
          user: null,
          connections: [],
          jobs: [],
          notifications: []
        },
        status: 200
      });
    }

    const dashboardData = {
      data: {
        user: {
          id: userData.id,
          email: userData.email,
          name: userData.name
        },
        connections: userData.dbConnections || [],
        jobs: userData.indexingJobs || [],
        notifications: [] // TODO: Implement notifications
      },
      status: 200
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    await logError('Failed to fetch dashboard data', error as Error, {
      component: 'DashboardAPI',
      action: 'GET'
    });
    return NextResponse.json({ 
      data: null, 
      status: 500,
      error: 'Internal Server Error' 
    }, { 
      status: 500 
    });
  }
} 