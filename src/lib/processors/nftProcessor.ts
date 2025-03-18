import { Pool } from 'pg';
import { getDbConnection } from '../dbConnections';

interface NFTEvent {
  signature: string;
  type: 'mint' | 'transfer' | 'sale';
  mint: string;
  owner?: string;
  price?: number;
  timestamp: number;
}

export async function processNFTEvents(data: any[], dbConnectionId: string) {
  const dbConnection = await getDbConnection(dbConnectionId);
  if (!dbConnection) {
    throw new Error('Database connection not found');
  }

  const pool = new Pool({
    connectionString: dbConnection.url,
  });

  try {
    await pool.query('BEGIN');

    for (const event of data) {
      if (event.type === 'NFT') {
        const nftEvent: NFTEvent = {
          signature: event.signature,
          type: event.description.includes('Mint') ? 'mint' : 
                event.description.includes('Sale') ? 'sale' : 'transfer',
          mint: event.nft?.mint || '',
          owner: event.nft?.owner,
          price: event.amount,
          timestamp: event.timestamp,
        };

        await pool.query(
          `INSERT INTO nft_events (
            signature,
            type,
            mint,
            owner,
            price,
            timestamp,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
          ON CONFLICT (signature) DO NOTHING`,
          [
            nftEvent.signature,
            nftEvent.type,
            nftEvent.mint,
            nftEvent.owner,
            nftEvent.price,
            new Date(nftEvent.timestamp * 1000),
          ]
        );
      }
    }

    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  } finally {
    await pool.end();
  }
} 