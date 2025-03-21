import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logError } from '@/lib/utils/serverLogger';

const ALLOWED_TABLES = ['nft_bids', 'nft_prices', 'lending_rates', 'token_prices'];
const PAGE_SIZE = 10;

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table');
    const page = parseInt(searchParams.get('page') || '1');

    if (!table || !ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ 
        error: 'Invalid table specified',
        status: 400
      }, { status: 400 });
    }

    // Get the database connection for the user
    const dbConnection = await prisma.databaseConnection.findFirst({
      where: {
        userId: session.user.id,
        status: 'active'
      }
    });

    if (!dbConnection) {
      return NextResponse.json({ 
        error: 'No active database connection found',
        status: 400
      }, { status: 400 });
    }

    // Connect to the user's database
    const userDb = await prisma.$queryRaw<Record<string, any>[]>`
      SELECT * FROM ${table}
      ORDER BY timestamp DESC
      LIMIT ${PAGE_SIZE}
      OFFSET ${(page - 1) * PAGE_SIZE}
    `;

    // Get total count
    const [{ count }] = await prisma.$queryRaw<[{ count: string }]>`
      SELECT COUNT(*) as count FROM ${table}
    `;

    // Get column names
    const columns = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = ${table}
      ORDER BY ordinal_position
    `;

    return NextResponse.json({
      data: {
        columns: columns.map(col => col.column_name),
        rows: userDb,
        totalCount: parseInt(count)
      },
      status: 200
    });
  } catch (error) {
    await logError('Failed to fetch table data', error as Error, {
      component: 'DataBrowserAPI',
      action: 'GET'
    });
    return NextResponse.json({ 
      error: 'Failed to fetch data',
      status: 500
    }, { status: 500 });
  }
} 