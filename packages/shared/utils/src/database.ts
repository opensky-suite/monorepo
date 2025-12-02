/**
 * Shared Database Utilities
 *
 * Common database helpers for all OpenSky products:
 * - Connection pooling
 * - Query builders
 * - Transaction helpers
 * - Migration utilities
 */

import type { Pool, PoolClient, QueryResult } from "pg";

/**
 * Execute query with automatic error handling
 */
export async function executeQuery<T = any>(
  pool: Pool,
  query: string,
  values?: any[],
): Promise<QueryResult<T>> {
  try {
    return await pool.query(query, values);
  } catch (error) {
    console.error("Database query error:", error);
    throw new DatabaseError(
      "Query execution failed",
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Execute in transaction
 */
export async function withTransaction<T>(
  pool: Pool,
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
 * Build WHERE clause from conditions
 */
export function buildWhereClause(
  conditions: Record<string, any>,
  startIndex: number = 1,
): { clause: string; values: any[]; nextIndex: number } {
  const clauses: string[] = [];
  const values: any[] = [];
  let paramIndex = startIndex;

  for (const [key, value] of Object.entries(conditions)) {
    if (value === undefined) continue;

    if (value === null) {
      clauses.push(`${key} IS NULL`);
    } else if (Array.isArray(value)) {
      clauses.push(`${key} = ANY($${paramIndex})`);
      values.push(value);
      paramIndex++;
    } else {
      clauses.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  return {
    clause: clauses.length > 0 ? clauses.join(" AND ") : "1=1",
    values,
    nextIndex: paramIndex,
  };
}

/**
 * Build UPDATE SET clause
 */
export function buildSetClause(
  updates: Record<string, any>,
  startIndex: number = 1,
): { clause: string; values: any[]; nextIndex: number } {
  const clauses: string[] = [];
  const values: any[] = [];
  let paramIndex = startIndex;

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;

    clauses.push(`${key} = $${paramIndex}`);
    values.push(value);
    paramIndex++;
  }

  if (clauses.length === 0) {
    throw new Error("No updates provided");
  }

  return {
    clause: clauses.join(", "),
    values,
    nextIndex: paramIndex,
  };
}

/**
 * Paginate query results
 */
export function buildPaginationClause(
  limit?: number,
  offset?: number,
  paramIndex: number = 1,
): { clause: string; values: any[]; nextIndex: number } {
  const defaultLimit = 50;
  const actualLimit = limit || defaultLimit;
  const actualOffset = offset || 0;

  return {
    clause: `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    values: [actualLimit, actualOffset],
    nextIndex: paramIndex + 2,
  };
}

/**
 * Convert snake_case to camelCase
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert camelCase to snake_case
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Map database row to object with camelCase keys
 */
export function mapRowToCamelCase<T = any>(row: any): T {
  const result: any = {};

  for (const [key, value] of Object.entries(row)) {
    result[snakeToCamel(key)] = value;
  }

  return result as T;
}

/**
 * Map object with camelCase keys to snake_case for database
 */
export function mapCamelToSnake(obj: any): any {
  const result: any = {};

  for (const [key, value] of Object.entries(obj)) {
    result[camelToSnake(key)] = value;
  }

  return result;
}

/**
 * Check if table exists
 */
export async function tableExists(
  pool: Pool,
  tableName: string,
): Promise<boolean> {
  const query = `
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name = $1
    )
  `;

  const result = await pool.query(query, [tableName]);
  return result.rows[0].exists;
}

/**
 * Get table row count
 */
export async function getTableCount(
  pool: Pool,
  tableName: string,
): Promise<number> {
  const query = `SELECT COUNT(*) FROM ${tableName}`;
  const result = await pool.query(query);
  return parseInt(result.rows[0].count);
}

/**
 * Batch insert helper
 */
export async function batchInsert<T>(
  pool: Pool,
  tableName: string,
  columns: string[],
  rows: any[][],
  batchSize: number = 100,
): Promise<void> {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    const values: any[] = [];
    const valuePlaceholders: string[] = [];

    batch.forEach((row, rowIndex) => {
      const placeholders = columns.map((_, colIndex) => {
        const paramIndex = rowIndex * columns.length + colIndex + 1;
        return `$${paramIndex}`;
      });
      valuePlaceholders.push(`(${placeholders.join(", ")})`);
      values.push(...row);
    });

    const query = `
      INSERT INTO ${tableName} (${columns.join(", ")})
      VALUES ${valuePlaceholders.join(", ")}
    `;

    await pool.query(query, values);
  }
}

/**
 * Database Error class
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

/**
 * Retry failed queries
 */
export async function retryQuery<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)));
      }
    }
  }

  throw lastError;
}

/**
 * Build full-text search query
 */
export function buildFullTextSearch(
  columns: string[],
  searchTerm: string,
  paramIndex: number = 1,
): { clause: string; value: string; nextIndex: number } {
  const searchColumns = columns.join(" || ' ' || ");

  return {
    clause: `to_tsvector('english', ${searchColumns}) @@ plainto_tsquery('english', $${paramIndex})`,
    value: searchTerm,
    nextIndex: paramIndex + 1,
  };
}
