/**
 * SkyMail Thread Repository
 *
 * Database operations for email threads:
 * - Thread management
 * - Email-thread associations
 * - Thread statistics
 */

import type { Pool } from "pg";
import type { EmailThread } from "../types";

export interface CreateThreadInput {
  userId: string;
  subject: string;
  snippet?: string;
}

export interface UpdateThreadInput {
  snippet?: string;
  messageCount?: number;
  unreadCount?: number;
  hasAttachments?: boolean;
  isStarred?: boolean;
  isImportant?: boolean;
  isArchived?: boolean;
  isTrashed?: boolean;
  lastMessageAt?: Date;
}

export class ThreadRepository {
  constructor(private pool: Pool) {}

  /**
   * Create a new thread
   */
  async create(input: CreateThreadInput): Promise<EmailThread> {
    const query = `
      INSERT INTO email_threads (
        user_id, subject, snippet, message_count, unread_count
      ) VALUES ($1, $2, $3, 0, 0)
      RETURNING *
    `;

    const values = [input.userId, input.subject, input.snippet || ""];

    const result = await this.pool.query(query, values);
    return this.mapRowToThread(result.rows[0]);
  }

  /**
   * Find thread by ID
   */
  async findById(id: string, userId: string): Promise<EmailThread | null> {
    const query = `
      SELECT * FROM email_threads
      WHERE id = $1 AND user_id = $2
    `;

    const result = await this.pool.query(query, [id, userId]);
    return result.rows[0] ? this.mapRowToThread(result.rows[0]) : null;
  }

  /**
   * List threads with pagination
   */
  async findAll(
    userId: string,
    options: {
      isArchived?: boolean;
      isTrashed?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ threads: EmailThread[]; total: number }> {
    const conditions: string[] = ["user_id = $1"];
    const values: any[] = [userId];
    let paramIndex = 2;

    if (options.isArchived !== undefined) {
      conditions.push(`is_archived = $${paramIndex}`);
      values.push(options.isArchived);
      paramIndex++;
    }

    if (options.isTrashed !== undefined) {
      conditions.push(`is_trashed = $${paramIndex}`);
      values.push(options.isTrashed);
      paramIndex++;
    }

    const whereClause = conditions.join(" AND ");

    // Count total
    const countQuery = `SELECT COUNT(*) FROM email_threads WHERE ${whereClause}`;
    const countResult = await this.pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Get threads
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const query = `
      SELECT * FROM email_threads
      WHERE ${whereClause}
      ORDER BY last_message_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit, offset);

    const result = await this.pool.query(query, values);
    const threads = result.rows.map((row) => this.mapRowToThread(row));

    return { threads, total };
  }

  /**
   * Update thread
   */
  async update(
    id: string,
    userId: string,
    updates: UpdateThreadInput,
  ): Promise<EmailThread> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.snippet !== undefined) {
      setClauses.push(`snippet = $${paramIndex}`);
      values.push(updates.snippet);
      paramIndex++;
    }

    if (updates.messageCount !== undefined) {
      setClauses.push(`message_count = $${paramIndex}`);
      values.push(updates.messageCount);
      paramIndex++;
    }

    if (updates.unreadCount !== undefined) {
      setClauses.push(`unread_count = $${paramIndex}`);
      values.push(updates.unreadCount);
      paramIndex++;
    }

    if (updates.hasAttachments !== undefined) {
      setClauses.push(`has_attachments = $${paramIndex}`);
      values.push(updates.hasAttachments);
      paramIndex++;
    }

    if (updates.isStarred !== undefined) {
      setClauses.push(`is_starred = $${paramIndex}`);
      values.push(updates.isStarred);
      paramIndex++;
    }

    if (updates.isImportant !== undefined) {
      setClauses.push(`is_important = $${paramIndex}`);
      values.push(updates.isImportant);
      paramIndex++;
    }

    if (updates.isArchived !== undefined) {
      setClauses.push(`is_archived = $${paramIndex}`);
      values.push(updates.isArchived);
      paramIndex++;
    }

    if (updates.isTrashed !== undefined) {
      setClauses.push(`is_trashed = $${paramIndex}`);
      values.push(updates.isTrashed);
      paramIndex++;
    }

    if (updates.lastMessageAt !== undefined) {
      setClauses.push(`last_message_at = $${paramIndex}`);
      values.push(updates.lastMessageAt);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      throw new Error("No updates provided");
    }

    const query = `
      UPDATE email_threads
      SET ${setClauses.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
      RETURNING *
    `;

    values.push(id, userId);

    const result = await this.pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error("Thread not found");
    }

    return this.mapRowToThread(result.rows[0]);
  }

  /**
   * Delete thread and all its emails
   */
  async delete(id: string, userId: string): Promise<void> {
    const query = `
      DELETE FROM email_threads
      WHERE id = $1 AND user_id = $2
    `;

    await this.pool.query(query, [id, userId]);
  }

  /**
   * Get emails in thread
   */
  async getThreadEmails(threadId: string, userId: string): Promise<any[]> {
    const query = `
      SELECT * FROM emails
      WHERE thread_id = $1 AND user_id = $2
      ORDER BY received_at ASC
    `;

    const result = await this.pool.query(query, [threadId, userId]);
    return result.rows;
  }

  /**
   * Update thread statistics from emails
   */
  async updateStatistics(
    threadId: string,
    userId: string,
  ): Promise<EmailThread> {
    const query = `
      UPDATE email_threads t
      SET
        message_count = (
          SELECT COUNT(*) FROM emails
          WHERE thread_id = t.id AND user_id = t.user_id
        ),
        unread_count = (
          SELECT COUNT(*) FROM emails
          WHERE thread_id = t.id AND user_id = t.user_id AND is_read = false
        ),
        has_attachments = (
          SELECT BOOL_OR(has_attachments) FROM emails
          WHERE thread_id = t.id AND user_id = t.user_id
        ),
        is_starred = (
          SELECT BOOL_OR(is_starred) FROM emails
          WHERE thread_id = t.id AND user_id = t.user_id
        ),
        is_important = (
          SELECT BOOL_OR(is_important) FROM emails
          WHERE thread_id = t.id AND user_id = t.user_id
        ),
        last_message_at = (
          SELECT MAX(received_at) FROM emails
          WHERE thread_id = t.id AND user_id = t.user_id
        ),
        snippet = (
          SELECT SUBSTRING(body_text FROM 1 FOR 500)
          FROM emails
          WHERE thread_id = t.id AND user_id = t.user_id
          ORDER BY received_at DESC
          LIMIT 1
        ),
        updated_at = CURRENT_TIMESTAMP
      WHERE t.id = $1 AND t.user_id = $2
      RETURNING *
    `;

    const result = await this.pool.query(query, [threadId, userId]);

    if (result.rows.length === 0) {
      throw new Error("Thread not found");
    }

    return this.mapRowToThread(result.rows[0]);
  }

  /**
   * Increment unread count
   */
  async incrementUnreadCount(threadId: string): Promise<void> {
    const query = `
      UPDATE email_threads
      SET unread_count = unread_count + 1
      WHERE id = $1
    `;

    await this.pool.query(query, [threadId]);
  }

  /**
   * Decrement unread count
   */
  async decrementUnreadCount(threadId: string): Promise<void> {
    const query = `
      UPDATE email_threads
      SET unread_count = GREATEST(0, unread_count - 1)
      WHERE id = $1
    `;

    await this.pool.query(query, [threadId]);
  }

  /**
   * Get thread count by status
   */
  async getCountByStatus(
    userId: string,
    status: {
      isArchived?: boolean;
      isTrashed?: boolean;
    },
  ): Promise<number> {
    const conditions: string[] = ["user_id = $1"];
    const values: any[] = [userId];
    let paramIndex = 2;

    if (status.isArchived !== undefined) {
      conditions.push(`is_archived = $${paramIndex}`);
      values.push(status.isArchived);
      paramIndex++;
    }

    if (status.isTrashed !== undefined) {
      conditions.push(`is_trashed = $${paramIndex}`);
      values.push(status.isTrashed);
      paramIndex++;
    }

    const whereClause = conditions.join(" AND ");
    const query = `SELECT COUNT(*) FROM email_threads WHERE ${whereClause}`;

    const result = await this.pool.query(query, values);
    return parseInt(result.rows[0].count);
  }

  /**
   * Get total unread count across all threads
   */
  async getTotalUnreadCount(userId: string): Promise<number> {
    const query = `
      SELECT COALESCE(SUM(unread_count), 0) as total
      FROM email_threads
      WHERE user_id = $1 AND is_trashed = false
    `;

    const result = await this.pool.query(query, [userId]);
    return parseInt(result.rows[0].total);
  }

  /**
   * Map database row to EmailThread object
   */
  private mapRowToThread(row: any): EmailThread {
    return {
      id: row.id,
      userId: row.user_id,
      subject: row.subject,
      snippet: row.snippet,
      messageCount: row.message_count,
      unreadCount: row.unread_count,
      hasAttachments: row.has_attachments,
      isStarred: row.is_starred,
      isImportant: row.is_important,
      isArchived: row.is_archived,
      isTrashed: row.is_trashed,
      lastMessageAt: new Date(row.last_message_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

/**
 * Create thread repository instance
 */
export function createThreadRepository(pool: Pool): ThreadRepository {
  return new ThreadRepository(pool);
}
