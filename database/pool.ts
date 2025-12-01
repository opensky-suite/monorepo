/**
 * PostgreSQL Connection Pool
 */

import { Pool, PoolClient } from "pg";
import { dbConfig } from "./config.js";

// Create connection pool
export const pool = new Pool(dbConfig);

// Handle pool errors
pool.on("error", (err: Error) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  pool.end(() => {
    console.log("Database pool closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  pool.end(() => {
    console.log("Database pool closed");
    process.exit(0);
  });
});

/**
 * Execute a query with automatic connection handling
 */
export async function query<T = any>(
  text: string,
  params?: any[],
): Promise<T[]> {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;

  if (duration > 1000) {
    console.warn("Slow query detected:", {
      text,
      duration,
      rows: res.rowCount,
    });
  }

  return res.rows;
}

/**
 * Execute a transaction
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Check database connectivity
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch (error) {
    console.error("Database health check failed:", error);
    return false;
  }
}

export default pool;
