import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DatabaseService } from '@/lib/services/databaseService';
import { DatabaseCredentials } from '@/types';
import prisma from '@/lib/db';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get the user from the database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return new NextResponse('User not found', { status: 404 });
    }

    const credentials: DatabaseCredentials = await req.json();
    const dbService = DatabaseService.getInstance();
    
    await dbService.saveConnection(user.id, credentials);

    return NextResponse.json({ message: 'Database connection created successfully' });
  } catch (error) {
    console.error('Create connection error:', error);
    return new NextResponse('Failed to create database connection', { status: 500 });
  }
}

export async function GET() {
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

    const dbService = DatabaseService.getInstance();
    const connections = await dbService.listConnections(user.id);

    return NextResponse.json(connections);
  } catch (error) {
    console.error('List connections error:', error);
    return new NextResponse('Failed to list database connections', { status: 500 });
  }
} 