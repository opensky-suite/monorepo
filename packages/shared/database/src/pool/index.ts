/**
 * PostgreSQL Connection Pool
 * PRODUCTION-READY - No mocks, fails fast if not configured
 */

import { Pool, PoolClient, PoolConfig, QueryResult } from "pg";

/**
 * Database configuration
 */
export interface DatabaseConfig extends PoolConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

/**
 * Query execution result with timing
 */
export interface QueryTiming {
  query: string;
  params?: any[];
  duration: number;
  rowCount: number | null;
}

/**
 * Database Pool Manager
 * Manages PostgreSQL connection pool with monitoring and health checks
 */
export class DatabasePool {
  private pool: Pool;
  private queryTimings: QueryTiming[] = [];
  private slowQueryThreshold: number = 1000; // ms

  constructor(config: DatabaseConfig) {
    // Validate required config
    if (!config.host || !config.database || !config.user || !config.password) {
      throw new Error(
        'DatabasePool: Missing required config (host, database, user, password). ' +
        'Set environment variables: DB_HOST, DB_NAME, DB_USER, DB_PASSWORD'
      );
    }

    this.pool = new Pool(config);

    // Handle unexpected pool errors
    this.pool.on('error', (err: Error) => {
      console.error('DatabasePool: Unexpected error on idle client', err);
      // Don't exit in production - let monitoring/alerting handle it
      // process.exit(-1);
    });

    // Graceful shutdown handlers
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT', () => this.shutdown('SIGINT'));
  }

  /**
   * Execute a query with automatic connection handling and timing
   */
  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const start = Date.now();
    let result: QueryResult;

    try {
      result = await this.pool.query(text, params);
    } catch (error) {
      const duration = Date.now() - start;
      console.error('DatabasePool: Query failed', {
        query: text,
        params,
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    const duration = Date.now() - start;

    // Track query timing
    const timing: QueryTiming = {
      query: text,
      params,
      duration,
      rowCount: result.rowCount,
    };

    this.queryTimings.push(timing);
    
    // Keep only last 100 queries
    if (this.queryTimings.length > 100) {
      this.queryTimings.shift();
    }

    // Warn about slow queries
    if (duration > this.slowQueryThreshold) {
      console.warn('DatabasePool: Slow query detected', {
        query: text,
        duration,
        rowCount: result.rowCount,
        threshold: this.slowQueryThreshold,
      });
    }

    return result.rows as T[];
  }

  /**
   * Execute a single row query (returns first row or null)
   */
  async queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Execute a query that returns a single value
   */
  async queryValue<T = any>(text: string, params?: any[]): Promise<T | null> {
    const row = await this.queryOne<Record<string, T>>(text, params);
    if (!row) return null;
    
    // Return the first column value
    const keys = Object.keys(row);
    return keys.length > 0 ? row[keys[0]] : null;
  }

  /**
   * Get a client from the pool for manual transaction management
   */
  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  /**
   * Check database connectivity
   */
  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    const start = Date.now();
    
    try {
      await this.pool.query('SELECT 1');
      const latency = Date.now() - start;
      return { healthy: true, latency };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      recentQueries: this.queryTimings.slice(-10),
      slowQueries: this.queryTimings.filter(q => q.duration > this.slowQueryThreshold),
    };
  }

  /**
   * Set slow query threshold (in milliseconds)
   */
  setSlowQueryThreshold(ms: number) {
    this.slowQueryThreshold = ms;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(signal?: string): Promise<void> {
    console.log(`DatabasePool: Shutting down${signal ? ` (${signal})` : ''}...`);
    
    try {
      await this.pool.end();
      console.log('DatabasePool: Closed successfully');
    } catch (error) {
      console.error('DatabasePool: Error during shutdown', error);
      throw error;
    }
  }

  /**
   * Get the underlying pg Pool instance (use sparingly)
   */
  getPool(): Pool {
    return this.pool;
  }
}

/**
 * Create database configuration from environment variables
 */
export function createDatabaseConfig(env?: NodeJS.ProcessEnv): DatabaseConfig {
  const e = env || process.env;

  return {
    host: e.DB_HOST || 'localhost',
    port: parseInt(e.DB_PORT || '5432', 10),
    database: e.DB_NAME || 'opensky_dev',
    user: e.DB_USER || 'opensky',
    password: e.DB_PASSWORD || '',
    ssl: e.DB_SSL === 'true',
    max: parseInt(e.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(e.DB_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(e.DB_CONNECT_TIMEOUT || '5000', 10),
  };
}
