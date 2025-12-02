/**
 * Base Repository Pattern
 * PRODUCTION-READY - Real database operations, no mocks
 */

import { PoolClient } from 'pg';
import { DatabasePool } from '../pool/index.js';
/**
 * NotImplementedError - Throw when a method must be implemented by subclass
 */
class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotImplementedError';
  }
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Base entity interface (all entities should have these fields)
 */
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Base Repository
 * Extend this class for each entity type
 * 
 * @example
 * ```ts
 * interface User extends BaseEntity {
 *   email: string;
 *   name: string;
 * }
 * 
 * class UserRepository extends BaseRepository<User> {
 *   constructor(db: DatabasePool) {
 *     super(db, 'users');
 *   }
 * 
 *   async findByEmail(email: string): Promise<User | null> {
 *     return this.queryOne('SELECT * FROM users WHERE email = $1', [email]);
 *   }
 * }
 * ```
 */
export abstract class BaseRepository<T extends BaseEntity> {
  constructor(
    protected db: DatabasePool,
    protected tableName: string,
  ) {
    if (!tableName) {
      throw new Error('BaseRepository: tableName is required');
    }
  }

  /**
   * Find entity by ID
   */
  async findById(id: string): Promise<T | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE id = $1`;
    return this.db.queryOne<T>(sql, [id]);
  }

  /**
   * Find all entities (use with caution - prefer pagination)
   */
  async findAll(): Promise<T[]> {
    const sql = `SELECT * FROM ${this.tableName} ORDER BY created_at DESC`;
    return this.db.query<T>(sql);
  }

  /**
   * Find entities with pagination
   */
  async findPaginated(params: PaginationParams): Promise<PaginatedResult<T>> {
    const { page, limit } = params;
    const offset = (page - 1) * limit;

    // Get total count
    const countSql = `SELECT COUNT(*) FROM ${this.tableName}`;
    const total = await this.db.queryValue<number>(countSql) || 0;

    // Get paginated data
    const dataSql = `
      SELECT * FROM ${this.tableName}
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const data = await this.db.query<T>(dataSql, [limit, offset]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create a new entity
   * IMPORTANT: Override this method in subclasses with actual INSERT logic
   */
  async create(_data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    throw new NotImplementedError(
      `${this.constructor.name}.create() must be implemented. ` +
      `Add INSERT INTO ${this.tableName} logic in your repository.`
    );
  }

  /**
   * Update an existing entity
   * IMPORTANT: Override this method in subclasses with actual UPDATE logic
   */
  async update(_id: string, _data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>): Promise<T> {
    throw new NotImplementedError(
      `${this.constructor.name}.update() must be implemented. ` +
      `Add UPDATE ${this.tableName} logic in your repository.`
    );
  }

  /**
   * Delete an entity
   */
  async delete(id: string): Promise<void> {
    const sql = `DELETE FROM ${this.tableName} WHERE id = $1`;
    await this.db.query(sql, [id]);
  }

  /**
   * Soft delete (set deleted_at timestamp)
   */
  async softDelete(id: string): Promise<void> {
    const sql = `
      UPDATE ${this.tableName}
      SET deleted_at = NOW()
      WHERE id = $1
    `;
    await this.db.query(sql, [id]);
  }

  /**
   * Count entities
   */
  async count(whereClause?: string, params?: any[]): Promise<number> {
    let sql = `SELECT COUNT(*) FROM ${this.tableName}`;
    
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }

    return await this.db.queryValue<number>(sql, params) || 0;
  }

  /**
   * Check if entity exists
   */
  async exists(id: string): Promise<boolean> {
    const sql = `SELECT EXISTS(SELECT 1 FROM ${this.tableName} WHERE id = $1)`;
    return await this.db.queryValue<boolean>(sql, [id]) || false;
  }

  /**
   * Execute a custom query (use for complex queries)
   */
  protected async query<R = T>(sql: string, params?: any[]): Promise<R[]> {
    return this.db.query<R>(sql, params);
  }

  /**
   * Execute a custom query that returns a single row
   */
  protected async queryOne<R = T>(sql: string, params?: any[]): Promise<R | null> {
    return this.db.queryOne<R>(sql, params);
  }

  /**
   * Execute within a transaction
   */
  protected async withTransaction<R>(
    callback: (client: PoolClient) => Promise<R>,
  ): Promise<R> {
    const client = await this.db.getClient();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Build WHERE clause from object
   * Helper for dynamic queries
   */
  protected buildWhereClause(
    conditions: Record<string, any>,
  ): { clause: string; params: any[] } {
    const keys = Object.keys(conditions);
    
    if (keys.length === 0) {
      return { clause: '', params: [] };
    }

    const clauses = keys.map((key, index) => `${key} = $${index + 1}`);
    const params = keys.map(key => conditions[key]);

    return {
      clause: 'WHERE ' + clauses.join(' AND '),
      params,
    };
  }

  /**
   * Build SET clause for UPDATE
   */
  protected buildSetClause(
    data: Record<string, any>,
    startIndex: number = 1,
  ): { clause: string; params: any[] } {
    const keys = Object.keys(data);
    
    if (keys.length === 0) {
      throw new Error('buildSetClause: No data provided');
    }

    const clauses = keys.map((key, index) => `${key} = $${startIndex + index}`);
    const params = keys.map(key => data[key]);

    return {
      clause: clauses.join(', '),
      params,
    };
  }
}

/**
 * Helper to convert snake_case database columns to camelCase
 */
export function toCamelCase(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = obj[key];
  }
  
  return result;
}

/**
 * Helper to convert camelCase to snake_case for database
 */
export function toSnakeCase(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    result[snakeKey] = obj[key];
  }
  
  return result;
}
