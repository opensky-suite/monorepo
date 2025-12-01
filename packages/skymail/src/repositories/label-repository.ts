/**
 * SkyMail Label Repository
 *
 * Database operations for labels:
 * - CRUD operations for labels
 * - Label-email associations
 * - System label management
 */

import type { Pool } from "pg";
import type { EmailLabel } from "../types";

export interface CreateLabelInput {
  userId: string;
  name: string;
  color?: string;
  isSystem?: boolean;
  sortOrder?: number;
}

export interface UpdateLabelInput {
  name?: string;
  color?: string;
  sortOrder?: number;
}

export class LabelRepository {
  constructor(private pool: Pool) {}

  /**
   * Create a new label
   */
  async create(input: CreateLabelInput): Promise<EmailLabel> {
    const query = `
      INSERT INTO email_labels (
        user_id, name, color, is_system, sort_order
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      input.userId,
      input.name,
      input.color || null,
      input.isSystem || false,
      input.sortOrder || 0,
    ];

    const result = await this.pool.query(query, values);
    return this.mapRowToLabel(result.rows[0]);
  }

  /**
   * Find label by ID
   */
  async findById(id: string, userId: string): Promise<EmailLabel | null> {
    const query = `
      SELECT * FROM email_labels
      WHERE id = $1 AND user_id = $2
    `;

    const result = await this.pool.query(query, [id, userId]);
    return result.rows[0] ? this.mapRowToLabel(result.rows[0]) : null;
  }

  /**
   * Find label by name
   */
  async findByName(name: string, userId: string): Promise<EmailLabel | null> {
    const query = `
      SELECT * FROM email_labels
      WHERE name = $1 AND user_id = $2
    `;

    const result = await this.pool.query(query, [name, userId]);
    return result.rows[0] ? this.mapRowToLabel(result.rows[0]) : null;
  }

  /**
   * List all labels for a user
   */
  async findAll(userId: string): Promise<EmailLabel[]> {
    const query = `
      SELECT * FROM email_labels
      WHERE user_id = $1
      ORDER BY is_system DESC, sort_order ASC, name ASC
    `;

    const result = await this.pool.query(query, [userId]);
    return result.rows.map((row) => this.mapRowToLabel(row));
  }

  /**
   * Update label
   */
  async update(
    id: string,
    userId: string,
    updates: UpdateLabelInput,
  ): Promise<EmailLabel> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex}`);
      values.push(updates.name);
      paramIndex++;
    }

    if (updates.color !== undefined) {
      setClauses.push(`color = $${paramIndex}`);
      values.push(updates.color);
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
      UPDATE email_labels
      SET ${setClauses.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
      RETURNING *
    `;

    values.push(id, userId);

    const result = await this.pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error("Label not found");
    }

    return this.mapRowToLabel(result.rows[0]);
  }

  /**
   * Delete label
   */
  async delete(id: string, userId: string): Promise<void> {
    // Don't allow deleting system labels
    const label = await this.findById(id, userId);
    if (label?.isSystem) {
      throw new Error("Cannot delete system label");
    }

    const query = `
      DELETE FROM email_labels
      WHERE id = $1 AND user_id = $2 AND is_system = false
    `;

    await this.pool.query(query, [id, userId]);
  }

  /**
   * Add label to email
   */
  async addToEmail(emailId: string, labelId: string): Promise<void> {
    const query = `
      INSERT INTO email_label_mappings (email_id, label_id)
      VALUES ($1, $2)
      ON CONFLICT (email_id, label_id) DO NOTHING
    `;

    await this.pool.query(query, [emailId, labelId]);
  }

  /**
   * Remove label from email
   */
  async removeFromEmail(emailId: string, labelId: string): Promise<void> {
    const query = `
      DELETE FROM email_label_mappings
      WHERE email_id = $1 AND label_id = $2
    `;

    await this.pool.query(query, [emailId, labelId]);
  }

  /**
   * Get labels for an email
   */
  async getEmailLabels(emailId: string): Promise<EmailLabel[]> {
    const query = `
      SELECT l.*
      FROM email_labels l
      INNER JOIN email_label_mappings elm ON l.id = elm.label_id
      WHERE elm.email_id = $1
      ORDER BY l.is_system DESC, l.sort_order ASC
    `;

    const result = await this.pool.query(query, [emailId]);
    return result.rows.map((row) => this.mapRowToLabel(row));
  }

  /**
   * Get email count for each label
   */
  async getEmailCounts(userId: string): Promise<Map<string, number>> {
    const query = `
      SELECT l.id, COUNT(elm.email_id) as count
      FROM email_labels l
      LEFT JOIN email_label_mappings elm ON l.id = elm.label_id
      LEFT JOIN emails e ON elm.email_id = e.id
        AND e.is_trashed = false AND e.is_spam = false
      WHERE l.user_id = $1
      GROUP BY l.id
    `;

    const result = await this.pool.query(query, [userId]);
    const counts = new Map<string, number>();

    for (const row of result.rows) {
      counts.set(row.id, parseInt(row.count));
    }

    return counts;
  }

  /**
   * Create default system labels for user
   */
  async createSystemLabels(userId: string): Promise<EmailLabel[]> {
    const systemLabels = [
      { name: "Inbox", color: "#4285f4", sortOrder: 0 },
      { name: "Sent", color: "#34a853", sortOrder: 1 },
      { name: "Drafts", color: "#fbbc04", sortOrder: 2 },
      { name: "Spam", color: "#ea4335", sortOrder: 3 },
      { name: "Trash", color: "#5f6368", sortOrder: 4 },
      { name: "Starred", color: "#f9ab00", sortOrder: 5 },
      { name: "Important", color: "#fbbc04", sortOrder: 6 },
    ];

    const labels: EmailLabel[] = [];

    for (const labelData of systemLabels) {
      const label = await this.create({
        userId,
        name: labelData.name,
        color: labelData.color,
        isSystem: true,
        sortOrder: labelData.sortOrder,
      });
      labels.push(label);
    }

    return labels;
  }

  /**
   * Map database row to EmailLabel object
   */
  private mapRowToLabel(row: any): EmailLabel {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      color: row.color,
      isSystem: row.is_system,
      sortOrder: row.sort_order,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

/**
 * Create label repository instance
 */
export function createLabelRepository(pool: Pool): LabelRepository {
  return new LabelRepository(pool);
}
