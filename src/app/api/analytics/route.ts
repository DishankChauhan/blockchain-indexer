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

    // Fetch analytics data from prisma
    const analyticsData = await prisma.indexingJob.findMany({
      where: {
        userId: session.user.id
      },
      select: {
        id: true,
        status: true,
        progress: true,
        updatedAt: true,
        processedData: {
          select: {
            timestamp: true,
            data: true
          },
          orderBy: {
            timestamp: 'desc'
          },
          take: 100
        }
      }
    });

    const formattedData = {
      jobMetrics: analyticsData.map(job => ({
        id: job.id,
        status: job.status,
        progress: typeof job.progress === 'number' ? job.progress : 0,
        processedCount: job.processedData.length,
        lastUpdated: job.updatedAt
      })),
      timeSeriesData: analyticsData.flatMap(job => 
        job.processedData.map(item => ({
          timestamp: item.timestamp,
          data: item.data
        }))
      ).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    };

    return NextResponse.json({
      data: formattedData,
      status: 200
    });
  } catch (error) {
    await logError('Failed to fetch analytics data', error as Error, {
      component: 'AnalyticsAPI',
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