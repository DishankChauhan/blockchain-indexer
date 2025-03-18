import prisma from './prisma';

interface DbConnection {
  id: string;
  url: string;
  status: string;
}

export async function getDbConnection(id: string): Promise<DbConnection | null> {
  const connection = await prisma.databaseConnection.findUnique({
    where: { id },
  });

  if (!connection) {
    return null;
  }

  return {
    id: connection.id,
    url: `postgresql://${connection.username}:${connection.password}@${connection.host}:${connection.port}/${connection.database}`,
    status: connection.status,
  };
} 