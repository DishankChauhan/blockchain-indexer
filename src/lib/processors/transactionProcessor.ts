import { Pool } from 'pg';
import { getDbConnection } from '../dbConnections';

interface Transaction {
  signature: string;
  slot: number;
  err: any;
  fee: number;
  logs: string[];
  programIds: string[];
  accounts: string[];
  timestamp: number;
}

export async function processTransactions(data: any[], dbConnectionId: string) {
  const dbConnection = await getDbConnection(dbConnectionId);
  if (!dbConnection) {
    throw new Error('Database connection not found');
  }

  const pool = new Pool({
    connectionString: dbConnection.url,
  });

  try {
    await pool.query('BEGIN');

    for (const transaction of data) {
      const {
        signature,
        slot,
        err,
        fee,
        logs,
        programIds,
        accounts,
        timestamp,
      } = transaction;

      // Insert transaction
      await pool.query(
        `INSERT INTO transactions (
          signature,
          slot,
          error,
          fee,
          logs,
          program_ids,
          accounts,
          timestamp,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (signature) DO NOTHING`,
        [
          signature,
          slot,
          err ? JSON.stringify(err) : null,
          fee,
          JSON.stringify(logs),
          JSON.stringify(programIds),
          JSON.stringify(accounts),
          new Date(timestamp * 1000),
        ]
      );

      // Process program interactions
      for (const programId of programIds) {
        await pool.query(
          `INSERT INTO program_interactions (
            transaction_signature,
            program_id,
            created_at
          ) VALUES ($1, $2, NOW())
          ON CONFLICT (transaction_signature, program_id) DO NOTHING`,
          [signature, programId]
        );
      }

      // Process account activities
      for (const account of accounts) {
        await pool.query(
          `INSERT INTO account_activities (
            transaction_signature,
            account_address,
            created_at
          ) VALUES ($1, $2, NOW())
          ON CONFLICT (transaction_signature, account_address) DO NOTHING`,
          [signature, account]
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