import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logError, logInfo } from '@/lib/utils/serverLogger';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const connections = await prisma.databaseConnection.findMany({
      where: {
        userId: session.user.id
      },
      select: {
        id: true,
        host: true,
        port: true,
        database: true,
        username: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    logInfo('Successfully fetched database connections', {
      component: 'ConnectionsAPI',
      action: 'GET',
      userId: session.user.id,
      connectionCount: connections.length
    });

    return NextResponse.json({ data: connections });
  } catch (error) {
    logError('Failed to fetch database connections', error as Error, {
      component: 'ConnectionsAPI',
      action: 'GET'
    });
    return NextResponse.json(
      { error: 'Failed to fetch connections' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { name, host, port, database, username, password } = body;

    if (!name || !host || !port || !database || !username || !password) {
      return new NextResponse('Missing required fields', { status: 400 });
    }

    const connection = await prisma.databaseConnection.create({
      data: {
        userId: session.user.id,
        host,
        port,
        database,
        username,
        password,
        status: 'pending'
      }
    });

    logInfo('Database connection created successfully', {
      component: 'ConnectionsAPI',
      action: 'POST',
      connectionId: connection.id
    });

    return NextResponse.json({ data: connection });
  } catch (error) {
    logError('Failed to create connection', error as Error, {
      component: 'ConnectionsAPI',
      action: 'POST'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}