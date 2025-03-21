import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DatabaseService } from '@/lib/services/databaseService';
import { logError } from '@/lib/utils/serverLogger';
import { DatabaseCredentials } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    if (!data.host || !data.port || !data.database || !data.username || !data.password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate port number
    const port = parseInt(data.port);
    if (isNaN(port) || port <= 0 || port > 65535) {
      return NextResponse.json(
        { error: 'Invalid port number' },
        { status: 400 }
      );
    }

    const credentials: DatabaseCredentials = {
      name: `${data.database}@${data.host}:${port}`,
      host: data.host,
      port: parseInt(data.port),
      database: data.database,
      username: data.username,
      password: data.password
    };

    const dbService = DatabaseService.getInstance();
    const isValid = await dbService.testConnection(credentials);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Failed to connect to database' },
        { status: 400 }
      );
    }

    const connection = await dbService.saveConnection(session.user.id, credentials);

    return NextResponse.json({ success: true, connection });
  } catch (error) {
    logError('Failed to connect to database', error as Error, {
      component: 'DatabaseAPI',
      action: 'connect'
    });
    return NextResponse.json(
      { error: 'Failed to connect to database' },
      { status: 500 }
    );
  }
} 