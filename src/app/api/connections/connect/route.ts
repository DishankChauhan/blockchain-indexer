import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { DatabaseService } from '@/lib/services/databaseService';
import { logError, logInfo } from '@/lib/utils/serverLogger';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const { host, port, database, username, password } = body;

    // Validate required fields
    if (!host || !port || !database || !username || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Test the connection first
    const dbService = DatabaseService.getInstance();
    const isValid = await dbService.testConnection({
      host,
      port,
      database,
      username,
      password
    });

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid database credentials' },
        { status: 400 }
      );
    }

    // Create the connection
    const connection = await prisma.databaseConnection.create({
      data: {
        userId: session.user.id,
        host,
        port,
        database,
        username,
        password: await dbService.encryptPassword(password),
        status: 'active'
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

    logInfo('Successfully created database connection', {
      component: 'ConnectionsAPI',
      action: 'Connect',
      userId: session.user.id,
      connectionId: connection.id
    });

    return NextResponse.json({ data: connection });
  } catch (error) {
    logError('Failed to create database connection', error as Error, {
      component: 'ConnectionsAPI',
      action: 'Connect'
    });
    return NextResponse.json(
      { error: 'Failed to create connection' },
      { status: 500 }
    );
  }
} 