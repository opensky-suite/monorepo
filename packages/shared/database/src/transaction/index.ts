/**
 * Transaction Helpers
 * PRODUCTION-READY - Real transaction management, no mocks
 */

import { PoolClient } from 'pg';
import { DatabasePool } from '../pool/index.js';

/**
 * Transaction isolation levels
 */
export enum IsolationLevel {
  READ_UNCOMMITTED = 'READ UNCOMMITTED',
  READ_COMMITTED = 'READ COMMITTED',
  REPEATABLE_READ = 'REPEATABLE READ',
  SERIALIZABLE = 'SERIALIZABLE',
}

/**
 * Transaction options
 */
export interface TransactionOptions {
  isolationLevel?: IsolationLevel;
  readOnly?: boolean;
  deferrable?: boolean;
}

/**
 * Transaction Manager
 * Handles database transactions with proper error handling and rollback
 */
export class TransactionManager {
  constructor(private db: DatabasePool) {}

  /**
   * Execute a function within a transaction
   * Automatically commits on success, rolls back on error
   * 
   * @example
   * ```ts
   * await txManager.execute(async (client) => {
   *   await client.query('INSERT INTO users (email) VALUES ($1)', [email]);
   *   await client.query('INSERT INTO profiles (user_id) VALUES ($1)', [userId]);
   * });
   * ```
   */
  async execute<T>(
    callback: (client: PoolClient) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T> {
    const client = await this.db.getClient();

    try {
      // Begin transaction with options
      await this.begin(client, options);

      // Execute callback
      const result = await callback(client);

      // Commit transaction
      await this.commit(client);

      return result;
    } catch (error) {
      // Rollback on error
      await this.rollback(client);
      
      console.error('TransactionManager: Transaction failed and rolled back', {
        error: error instanceof Error ? error.message : String(error),
      });
      
      throw error;
    } finally {
      // Always release client back to pool
      client.release();
    }
  }

  /**
   * Begin a transaction
   */
  async begin(client: PoolClient, options?: TransactionOptions): Promise<void> {
    let sql = 'BEGIN';

    if (options) {
      const parts: string[] = [];

      if (options.isolationLevel) {
        parts.push(`ISOLATION LEVEL ${options.isolationLevel}`);
      }

      if (options.readOnly) {
        parts.push('READ ONLY');
      }

      if (options.deferrable) {
        parts.push('DEFERRABLE');
      }

      if (parts.length > 0) {
        sql += ' ' + parts.join(' ');
      }
    }

    await client.query(sql);
  }

  /**
   * Commit a transaction
   */
  async commit(client: PoolClient): Promise<void> {
    await client.query('COMMIT');
  }

  /**
   * Rollback a transaction
   */
  async rollback(client: PoolClient): Promise<void> {
    try {
      await client.query('ROLLBACK');
    } catch (error) {
      // Log but don't throw - we're already in error handling
      console.error('TransactionManager: Rollback failed', error);
    }
  }

  /**
   * Create a savepoint within a transaction
   */
  async savepoint(client: PoolClient, name: string): Promise<void> {
    await client.query(`SAVEPOINT ${name}`);
  }

  /**
   * Release a savepoint
   */
  async releaseSavepoint(client: PoolClient, name: string): Promise<void> {
    await client.query(`RELEASE SAVEPOINT ${name}`);
  }

  /**
   * Rollback to a savepoint
   */
  async rollbackToSavepoint(client: PoolClient, name: string): Promise<void> {
    await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
  }
}

/**
 * Standalone transaction helper (convenience function)
 * 
 * @example
 * ```ts
 * import { transaction } from '@opensky/database/transaction';
 * 
 * await transaction(db, async (client) => {
 *   await client.query('INSERT INTO ...');
 * });
 * ```
 */
export async function transaction<T>(
  db: DatabasePool,
  callback: (client: PoolClient) => Promise<T>,
  options?: TransactionOptions,
): Promise<T> {
  const txManager = new TransactionManager(db);
  return txManager.execute(callback, options);
}

/**
 * Nested transaction helper using savepoints
 * Useful for complex transactions with multiple rollback points
 * 
 * @example
 * ```ts
 * await transaction(db, async (client) => {
 *   await client.query('INSERT INTO users ...');
 *   
 *   await nestedTransaction(client, 'savepoint1', async () => {
 *     await client.query('INSERT INTO profiles ...');
 *     // This can rollback without affecting outer transaction
 *   });
 * });
 * ```
 */
export async function nestedTransaction<T>(
  client: PoolClient,
  savepointName: string,
  callback: () => Promise<T>,
): Promise<T> {
  await client.query(`SAVEPOINT ${savepointName}`);

  try {
    const result = await callback();
    await client.query(`RELEASE SAVEPOINT ${savepointName}`);
    return result;
  } catch (error) {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
    throw error;
  }
}
