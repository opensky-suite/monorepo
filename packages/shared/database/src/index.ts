/**
 * @opensky/database - Shared database utilities for OpenSky Suite
 * 
 * PRODUCTION-READY PostgreSQL utilities with no mocks or shims.
 * All functions are real implementations that fail fast if misconfigured.
 * 
 * @example
 * ```ts
 * import { DatabasePool, createDatabaseConfig } from '@opensky/database';
 * import { transaction } from '@opensky/database/transaction';
 * import { BaseRepository } from '@opensky/database/repository';
 * 
 * // Create database pool
 * const config = createDatabaseConfig();
 * const db = new DatabasePool(config);
 * 
 * // Execute queries
 * const users = await db.query('SELECT * FROM users WHERE email = $1', [email]);
 * 
 * // Use transactions
 * await transaction(db, async (client) => {
 *   await client.query('INSERT INTO users...');
 *   await client.query('INSERT INTO profiles...');
 * });
 * 
 * // Extend BaseRepository
 * class UserRepository extends BaseRepository<User> {
 *   constructor(db: DatabasePool) {
 *     super(db, 'users');
 *   }
 * }
 * ```
 */

// Re-export all modules
export * from './pool/index.js';
export * from './transaction/index.js';
export * from './repository/index.js';
export * from './query/index.js';
