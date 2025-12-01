/**
 * SkyMail Email Repository
 *
 * Database operations for emails:
 * - CRUD operations
 * - Querying with filters
 * - Batch operations
 * - Transaction support
 */

import type { Pool, PoolClient } from "pg";
import type {
  Email,
  CreateEmailInput,
  UpdateEmailInput,
  SearchEmailsInput,
  EmailAddress,
} from "../types";

export class EmailRepository {
  constructor(private pool: Pool) {}

  /**
   * Create a new email
   */
  async create(input: CreateEmailInput): Promise<Email> {
    const query = `
      INSERT INTO emails (
        user_id, message_id, from_address, from_name,
        to_addresses, cc_addresses, bcc_addresses,
        subject, body_text, body_html,
        is_draft, in_reply_to, references, size_bytes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      )
      RETURNING *
    `;

    const sizeBytes =
      (input.bodyText || "").length + (input.bodyHtml || "").length;
    const messageId = input.inReplyTo || this.generateMessageId();

    const values = [
      input.userId,
      messageId,
      input.fromAddress,
      input.fromName,
      JSON.stringify(input.toAddresses),
      JSON.stringify(input.ccAddresses || []),
      JSON.stringify(input.bccAddresses || []),
      input.subject,
      input.bodyText,
      input.bodyHtml,
      input.isDraft ?? true,
      input.inReplyTo,
      input.references,
      sizeBytes,
    ];

    const result = await this.pool.query(query, values);
    return this.mapRowToEmail(result.rows[0]);
  }

  /**
   * Find email by ID
   */
  async findById(id: string, userId: string): Promise<Email | null> {
    const query = `
      SELECT * FROM emails
      WHERE id = $1 AND user_id = $2
    `;

    const result = await this.pool.query(query, [id, userId]);
    return result.rows[0] ? this.mapRowToEmail(result.rows[0]) : null;
  }

  /**
   * Find emails with filters
   */
  async find(
    filters: SearchEmailsInput,
  ): Promise<{ emails: Email[]; total: number }> {
    const conditions: string[] = ["user_id = $1"];
    const values: any[] = [filters.userId];
    let paramIndex = 2;

    // Build WHERE clause
    if (filters.labelIds && filters.labelIds.length > 0) {
      conditions.push(`id IN (
        SELECT email_id FROM email_label_mappings
        WHERE label_id = ANY($${paramIndex})
      )`);
      values.push(filters.labelIds);
      paramIndex++;
    }

    if (filters.isRead !== undefined) {
      conditions.push(`is_read = $${paramIndex}`);
      values.push(filters.isRead);
      paramIndex++;
    }

    if (filters.isStarred !== undefined) {
      conditions.push(`is_starred = $${paramIndex}`);
      values.push(filters.isStarred);
      paramIndex++;
    }

    if (filters.hasAttachment !== undefined) {
      conditions.push(`has_attachments = $${paramIndex}`);
      values.push(filters.hasAttachment);
      paramIndex++;
    }

    if (filters.fromAddress) {
      conditions.push(`from_address ILIKE $${paramIndex}`);
      values.push(`%${filters.fromAddress}%`);
      paramIndex++;
    }

    if (filters.dateFrom) {
      conditions.push(`received_at >= $${paramIndex}`);
      values.push(filters.dateFrom);
      paramIndex++;
    }

    if (filters.dateTo) {
      conditions.push(`received_at <= $${paramIndex}`);
      values.push(filters.dateTo);
      paramIndex++;
    }

    // Exclude trashed and spam by default
    conditions.push("is_trashed = false");
    conditions.push("is_spam = false");

    const whereClause = conditions.join(" AND ");

    // Count total
    const countQuery = `SELECT COUNT(*) FROM emails WHERE ${whereClause}`;
    const countResult = await this.pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Get emails
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const query = `
      SELECT * FROM emails
      WHERE ${whereClause}
      ORDER BY received_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit, offset);

    const result = await this.pool.query(query, values);
    const emails = result.rows.map((row) => this.mapRowToEmail(row));

    return { emails, total };
  }

  /**
   * Update email
   */
  async update(
    id: string,
    userId: string,
    updates: UpdateEmailInput,
  ): Promise<Email> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.isRead !== undefined) {
      setClauses.push(`is_read = $${paramIndex}`);
      values.push(updates.isRead);
      paramIndex++;

      if (updates.isRead) {
        setClauses.push(`read_at = CURRENT_TIMESTAMP`);
      }
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

      if (updates.isTrashed) {
        setClauses.push(`trashed_at = CURRENT_TIMESTAMP`);
      } else {
        setClauses.push(`trashed_at = NULL`);
      }
    }

    if (updates.isSpam !== undefined) {
      setClauses.push(`is_spam = $${paramIndex}`);
      values.push(updates.isSpam);
      paramIndex++;
    }

    if (updates.snoozedUntil !== undefined) {
      setClauses.push(`snoozed_until = $${paramIndex}`);
      values.push(updates.snoozedUntil);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      throw new Error("No updates provided");
    }

    const query = `
      UPDATE emails
      SET ${setClauses.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
      RETURNING *
    `;

    values.push(id, userId);

    const result = await this.pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error("Email not found");
    }

    return this.mapRowToEmail(result.rows[0]);
  }

  /**
   * Delete email (permanent)
   */
  async delete(id: string, userId: string): Promise<void> {
    const query = `
      DELETE FROM emails
      WHERE id = $1 AND user_id = $2
    `;

    await this.pool.query(query, [id, userId]);
  }

  /**
   * Bulk update emails
   */
  async bulkUpdate(
    ids: string[],
    userId: string,
    updates: UpdateEmailInput,
  ): Promise<void> {
    if (ids.length === 0) return;

    const setClauses: string[] = [];
    const values: any[] = [ids, userId];
    let paramIndex = 3;

    if (updates.isRead !== undefined) {
      setClauses.push(`is_read = $${paramIndex}`);
      values.push(updates.isRead);
      paramIndex++;
    }

    if (updates.isStarred !== undefined) {
      setClauses.push(`is_starred = $${paramIndex}`);
      values.push(updates.isStarred);
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

    if (setClauses.length === 0) return;

    const query = `
      UPDATE emails
      SET ${setClauses.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ANY($1) AND user_id = $2
    `;

    await this.pool.query(query, values);
  }

  /**
   * Full-text search
   */
  async search(
    userId: string,
    searchQuery: string,
    limit: number = 50,
  ): Promise<Email[]> {
    const query = `
      SELECT *, ts_rank(
        to_tsvector('english', coalesce(subject, '') || ' ' || coalesce(body_text, '')),
        plainto_tsquery('english', $2)
      ) AS rank
      FROM emails
      WHERE user_id = $1
        AND to_tsvector('english', coalesce(subject, '') || ' ' || coalesce(body_text, ''))
        @@ plainto_tsquery('english', $2)
      ORDER BY rank DESC, received_at DESC
      LIMIT $3
    `;

    const result = await this.pool.query(query, [userId, searchQuery, limit]);
    return result.rows.map((row) => this.mapRowToEmail(row));
  }

  /**
   * Get email count by label
   */
  async getCountByLabel(userId: string, labelId: string): Promise<number> {
    const query = `
      SELECT COUNT(*)
      FROM emails e
      INNER JOIN email_label_mappings elm ON e.id = elm.email_id
      WHERE e.user_id = $1 AND elm.label_id = $2
        AND e.is_trashed = false AND e.is_spam = false
    `;

    const result = await this.pool.query(query, [userId, labelId]);
    return parseInt(result.rows[0].count);
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*)
      FROM emails
      WHERE user_id = $1 AND is_read = false
        AND is_trashed = false AND is_spam = false
    `;

    const result = await this.pool.query(query, [userId]);
    return parseInt(result.rows[0].count);
  }

  /**
   * Execute in transaction
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();

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
   * Map database row to Email object
   */
  private mapRowToEmail(row: any): Email {
    return {
      id: row.id,
      userId: row.user_id,
      messageId: row.message_id,
      inReplyTo: row.in_reply_to,
      references: row.references,
      threadId: row.thread_id,
      fromAddress: row.from_address,
      fromName: row.from_name,
      toAddresses: JSON.parse(row.to_addresses),
      ccAddresses: JSON.parse(row.cc_addresses),
      bccAddresses: JSON.parse(row.bcc_addresses),
      subject: row.subject,
      bodyText: row.body_text,
      bodyHtml: row.body_html,
      isDraft: row.is_draft,
      isSent: row.is_sent,
      isRead: row.is_read,
      isStarred: row.is_starred,
      isImportant: row.is_important,
      isArchived: row.is_archived,
      isTrashed: row.is_trashed,
      isSpam: row.is_spam,
      spamScore: row.spam_score ? parseFloat(row.spam_score) : undefined,
      sizeBytes: row.size_bytes,
      hasAttachments: row.has_attachments,
      receivedAt: new Date(row.received_at),
      sentAt: row.sent_at ? new Date(row.sent_at) : undefined,
      readAt: row.read_at ? new Date(row.read_at) : undefined,
      trashedAt: row.trashed_at ? new Date(row.trashed_at) : undefined,
      snoozedUntil: row.snoozed_until ? new Date(row.snoozed_until) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Generate Message-ID
   */
  private generateMessageId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `<${timestamp}.${random}@skymail.local>`;
  }
}

/**
 * Create email repository instance
 */
export function createEmailRepository(pool: Pool): EmailRepository {
  return new EmailRepository(pool);
}
