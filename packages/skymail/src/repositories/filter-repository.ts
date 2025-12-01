/**
 * SkyMail Filter Repository
 *
 * Database operations for email filters (rules):
 * - CRUD operations
 * - Filter execution tracking
 * - User filter management
 */

import type { Pool } from "pg";
import type { EmailFilter, FilterCondition, FilterAction } from "../types";

export interface CreateFilterInput {
  userId: string;
  name: string;
  isEnabled?: boolean;
  conditions: FilterCondition[];
  actions: FilterAction[];
  sortOrder?: number;
}

export interface UpdateFilterInput {
  name?: string;
  isEnabled?: boolean;
  conditions?: FilterCondition[];
  actions?: FilterAction[];
  sortOrder?: number;
}

export class FilterRepository {
  constructor(private pool: Pool) {}

  /**
   * Create a new filter
   */
  async create(input: CreateFilterInput): Promise<EmailFilter> {
    const query = `
      INSERT INTO email_filters (
        user_id, name, is_enabled, conditions, actions, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      input.userId,
      input.name,
      input.isEnabled ?? true,
      JSON.stringify(input.conditions),
      JSON.stringify(input.actions),
      input.sortOrder ?? 0,
    ];

    const result = await this.pool.query(query, values);
    return this.mapRowToFilter(result.rows[0]);
  }

  /**
   * Find filter by ID
   */
  async findById(id: string, userId: string): Promise<EmailFilter | null> {
    const query = `
      SELECT * FROM email_filters
      WHERE id = $1 AND user_id = $2
    `;

    const result = await this.pool.query(query, [id, userId]);
    return result.rows[0] ? this.mapRowToFilter(result.rows[0]) : null;
  }

  /**
   * List all filters for a user
   */
  async findAll(
    userId: string,
    onlyEnabled: boolean = false,
  ): Promise<EmailFilter[]> {
    let query = `
      SELECT * FROM email_filters
      WHERE user_id = $1
    `;

    if (onlyEnabled) {
      query += " AND is_enabled = true";
    }

    query += " ORDER BY sort_order ASC, created_at ASC";

    const result = await this.pool.query(query, [userId]);
    return result.rows.map((row) => this.mapRowToFilter(row));
  }

  /**
   * Update filter
   */
  async update(
    id: string,
    userId: string,
    updates: UpdateFilterInput,
  ): Promise<EmailFilter> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex}`);
      values.push(updates.name);
      paramIndex++;
    }

    if (updates.isEnabled !== undefined) {
      setClauses.push(`is_enabled = $${paramIndex}`);
      values.push(updates.isEnabled);
      paramIndex++;
    }

    if (updates.conditions !== undefined) {
      setClauses.push(`conditions = $${paramIndex}`);
      values.push(JSON.stringify(updates.conditions));
      paramIndex++;
    }

    if (updates.actions !== undefined) {
      setClauses.push(`actions = $${paramIndex}`);
      values.push(JSON.stringify(updates.actions));
      paramIndex++;
    }

    if (updates.sortOrder !== undefined) {
      setClauses.push(`sort_order = $${paramIndex}`);
      values.push(updates.sortOrder);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      throw new Error("No updates provided");
    }

    const query = `
      UPDATE email_filters
      SET ${setClauses.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
      RETURNING *
    `;

    values.push(id, userId);

    const result = await this.pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error("Filter not found");
    }

    return this.mapRowToFilter(result.rows[0]);
  }

  /**
   * Delete filter
   */
  async delete(id: string, userId: string): Promise<void> {
    const query = `
      DELETE FROM email_filters
      WHERE id = $1 AND user_id = $2
    `;

    await this.pool.query(query, [id, userId]);
  }

  /**
   * Toggle filter enabled/disabled
   */
  async toggleEnabled(id: string, userId: string): Promise<EmailFilter> {
    const query = `
      UPDATE email_filters
      SET is_enabled = NOT is_enabled, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const result = await this.pool.query(query, [id, userId]);

    if (result.rows.length === 0) {
      throw new Error("Filter not found");
    }

    return this.mapRowToFilter(result.rows[0]);
  }

  /**
   * Reorder filters
   */
  async reorder(userId: string, filterIds: string[]): Promise<void> {
    // Update sort order for each filter
    for (let i = 0; i < filterIds.length; i++) {
      const query = `
        UPDATE email_filters
        SET sort_order = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND user_id = $3
      `;

      await this.pool.query(query, [i, filterIds[i], userId]);
    }
  }

  /**
   * Get filter count for user
   */
  async getCount(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) FROM email_filters
      WHERE user_id = $1
    `;

    const result = await this.pool.query(query, [userId]);
    return parseInt(result.rows[0].count);
  }

  /**
   * Get enabled filter count
   */
  async getEnabledCount(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) FROM email_filters
      WHERE user_id = $1 AND is_enabled = true
    `;

    const result = await this.pool.query(query, [userId]);
    return parseInt(result.rows[0].count);
  }

  /**
   * Duplicate filter
   */
  async duplicate(id: string, userId: string): Promise<EmailFilter> {
    const original = await this.findById(id, userId);

    if (!original) {
      throw new Error("Filter not found");
    }

    return await this.create({
      userId,
      name: `${original.name} (Copy)`,
      isEnabled: false, // Disabled by default
      conditions: original.conditions,
      actions: original.actions,
      sortOrder: original.sortOrder + 1,
    });
  }

  /**
   * Test filter against conditions (doesn't execute actions)
   */
  async testFilter(
    filterId: string,
    userId: string,
    emailId: string,
  ): Promise<boolean> {
    // This would be implemented in the FilterService
    // Repository just stores/retrieves data
    throw new Error("Use FilterService.testFilter() instead");
  }

  /**
   * Map database row to EmailFilter object
   */
  private mapRowToFilter(row: any): EmailFilter {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      isEnabled: row.is_enabled,
      conditions: JSON.parse(row.conditions),
      actions: JSON.parse(row.actions),
      sortOrder: row.sort_order,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

/**
 * Create filter repository instance
 */
export function createFilterRepository(pool: Pool): FilterRepository {
  return new FilterRepository(pool);
}
