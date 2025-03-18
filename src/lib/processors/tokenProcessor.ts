import { Pool } from 'pg';
import { getDbConnection } from '../dbConnections';

interface TokenTransfer {
  signature: string;
  type: 'transfer' | 'swap';
  mint: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  timestamp: number;
}

export async function processTokenTransfers(data: any[], dbConnectionId: string) {
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
      if (event.type === 'TOKEN') {
        const tokenTransfer: TokenTransfer = {
          signature: event.signature,
          type: event.tokenTransfers?.length > 1 ? 'swap' : 'transfer',
          mint: event.tokenTransfers?.[0]?.mint || '',
          fromAddress: event.tokenTransfers?.[0]?.fromUserAccount || '',
          toAddress: event.tokenTransfers?.[0]?.toUserAccount || '',
          amount: event.tokenTransfers?.[0]?.tokenAmount || 0,
          timestamp: event.timestamp,
        };

        await pool.query(
          `INSERT INTO token_transfers (
            signature,
            type,
            mint,
            from_address,
            to_address,
            amount,
            timestamp,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (signature) DO NOTHING`,
          [
            tokenTransfer.signature,
            tokenTransfer.type,
            tokenTransfer.mint,
            tokenTransfer.fromAddress,
            tokenTransfer.toAddress,
            tokenTransfer.amount,
            new Date(tokenTransfer.timestamp * 1000),
          ]
        );

        // If it's a swap, record the second token transfer
        if (tokenTransfer.type === 'swap' && event.tokenTransfers?.[1]) {
          const swapTransfer: TokenTransfer = {
            ...tokenTransfer,
            mint: event.tokenTransfers[1].mint || '',
            fromAddress: event.tokenTransfers[1].fromUserAccount || '',
            toAddress: event.tokenTransfers[1].toUserAccount || '',
            amount: event.tokenTransfers[1].tokenAmount || 0,
          };

          await pool.query(
            `INSERT INTO token_transfers (
              signature,
              type,
              mint,
              from_address,
              to_address,
              amount,
              timestamp,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            ON CONFLICT (signature) DO NOTHING`,
            [
              swapTransfer.signature,
              swapTransfer.type,
              swapTransfer.mint,
              swapTransfer.fromAddress,
              swapTransfer.toAddress,
              swapTransfer.amount,
              new Date(swapTransfer.timestamp * 1000),
            ]
          );
        }
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