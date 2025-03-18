import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { Client } from 'pg';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { host, port, database, username, password } = body;

    // Test the connection
    const client = new Client({
      host,
      port,
      database,
      user: username,
      password,
    });

    try {
      await client.connect();
      await client.query('SELECT NOW()');
      await client.end();
    } catch (error) {
      return NextResponse.json(
        { error: 'Failed to connect to database' },
        { status: 400 }
      );
    }

    // Store the connection in our database
    const dbConnection = await prisma.databaseConnection.create({
      data: {
        userId: session.user.name as string,
        host,
        port,
        database,
        username,
        password, // In production, encrypt this!
        status: 'active',
        lastConnectedAt: new Date(),
      },
    });

    return NextResponse.json({ 
      message: 'Database connected successfully',
      connection: {
        id: dbConnection.id,
        status: dbConnection.status,
      }
    });
  } catch (error) {
    console.error('Database connection error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 