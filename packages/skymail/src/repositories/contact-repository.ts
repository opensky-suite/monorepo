/**
 * SkyMail Contact Repository
 *
 * Database operations for email contacts:
 * - Contact management
 * - Auto-population from emails
 * - Frequency tracking
 * - Contact blocking
 */

import type { Pool } from "pg";
import type { EmailContact } from "../types";

export interface CreateContactInput {
  userId: string;
  emailAddress: string;
  name?: string;
  avatarUrl?: string;
  phone?: string;
  notes?: string;
}

export interface UpdateContactInput {
  name?: string;
  avatarUrl?: string;
  phone?: string;
  notes?: string;
  isBlocked?: boolean;
}

export class ContactRepository {
  constructor(private pool: Pool) {}

  /**
   * Create or update contact
   */
  async upsert(input: CreateContactInput): Promise<EmailContact> {
    const query = `
      INSERT INTO email_contacts (
        user_id, email_address, name, avatar_url, phone, notes, email_count
      ) VALUES ($1, $2, $3, $4, $5, $6, 1)
      ON CONFLICT (user_id, email_address)
      DO UPDATE SET
        name = COALESCE(EXCLUDED.name, email_contacts.name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, email_contacts.avatar_url),
        phone = COALESCE(EXCLUDED.phone, email_contacts.phone),
        notes = COALESCE(EXCLUDED.notes, email_contacts.notes),
        email_count = email_contacts.email_count + 1,
        last_emailed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      input.userId,
      input.emailAddress.toLowerCase(),
      input.name,
      input.avatarUrl,
      input.phone,
      input.notes,
    ];

    const result = await this.pool.query(query, values);
    return this.mapRowToContact(result.rows[0]);
  }

  /**
   * Find contact by email address
   */
  async findByEmail(
    emailAddress: string,
    userId: string,
  ): Promise<EmailContact | null> {
    const query = `
      SELECT * FROM email_contacts
      WHERE email_address = $1 AND user_id = $2
    `;

    const result = await this.pool.query(query, [
      emailAddress.toLowerCase(),
      userId,
    ]);
    return result.rows[0] ? this.mapRowToContact(result.rows[0]) : null;
  }

  /**
   * Find contact by ID
   */
  async findById(id: string, userId: string): Promise<EmailContact | null> {
    const query = `
      SELECT * FROM email_contacts
      WHERE id = $1 AND user_id = $2
    `;

    const result = await this.pool.query(query, [id, userId]);
    return result.rows[0] ? this.mapRowToContact(result.rows[0]) : null;
  }

  /**
   * List all contacts
   */
  async findAll(
    userId: string,
    options: {
      search?: string;
      isBlocked?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ contacts: EmailContact[]; total: number }> {
    const conditions: string[] = ["user_id = $1"];
    const values: any[] = [userId];
    let paramIndex = 2;

    if (options.search) {
      conditions.push(`(
        email_address ILIKE $${paramIndex} OR
        name ILIKE $${paramIndex}
      )`);
      values.push(`%${options.search}%`);
      paramIndex++;
    }

    if (options.isBlocked !== undefined) {
      conditions.push(`is_blocked = $${paramIndex}`);
      values.push(options.isBlocked);
      paramIndex++;
    }

    const whereClause = conditions.join(" AND ");

    // Count total
    const countQuery = `SELECT COUNT(*) FROM email_contacts WHERE ${whereClause}`;
    const countResult = await this.pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Get contacts
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const query = `
      SELECT * FROM email_contacts
      WHERE ${whereClause}
      ORDER BY email_count DESC, last_emailed_at DESC, name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit, offset);

    const result = await this.pool.query(query, values);
    const contacts = result.rows.map((row) => this.mapRowToContact(row));

    return { contacts, total };
  }

  /**
   * Update contact
   */
  async update(
    id: string,
    userId: string,
    updates: UpdateContactInput,
  ): Promise<EmailContact> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex}`);
      values.push(updates.name);
      paramIndex++;
    }

    if (updates.avatarUrl !== undefined) {
      setClauses.push(`avatar_url = $${paramIndex}`);
      values.push(updates.avatarUrl);
      paramIndex++;
    }

    if (updates.phone !== undefined) {
      setClauses.push(`phone = $${paramIndex}`);
      values.push(updates.phone);
      paramIndex++;
    }

    if (updates.notes !== undefined) {
      setClauses.push(`notes = $${paramIndex}`);
      values.push(updates.notes);
      paramIndex++;
    }

    if (updates.isBlocked !== undefined) {
      setClauses.push(`is_blocked = $${paramIndex}`);
      values.push(updates.isBlocked);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      throw new Error("No updates provided");
    }

    const query = `
      UPDATE email_contacts
      SET ${setClauses.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
      RETURNING *
    `;

    values.push(id, userId);

    const result = await this.pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error("Contact not found");
    }

    return this.mapRowToContact(result.rows[0]);
  }

  /**
   * Delete contact
   */
  async delete(id: string, userId: string): Promise<void> {
    const query = `
      DELETE FROM email_contacts
      WHERE id = $1 AND user_id = $2
    `;

    await this.pool.query(query, [id, userId]);
  }

  /**
   * Block contact
   */
  async block(id: string, userId: string): Promise<EmailContact> {
    return await this.update(id, userId, { isBlocked: true });
  }

  /**
   * Unblock contact
   */
  async unblock(id: string, userId: string): Promise<EmailContact> {
    return await this.update(id, userId, { isBlocked: false });
  }

  /**
   * Get frequently contacted
   */
  async getFrequentContacts(
    userId: string,
    limit: number = 10,
  ): Promise<EmailContact[]> {
    const query = `
      SELECT * FROM email_contacts
      WHERE user_id = $1 AND is_blocked = false
      ORDER BY email_count DESC, last_emailed_at DESC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [userId, limit]);
    return result.rows.map((row) => this.mapRowToContact(row));
  }

  /**
   * Get recently contacted
   */
  async getRecentContacts(
    userId: string,
    limit: number = 10,
  ): Promise<EmailContact[]> {
    const query = `
      SELECT * FROM email_contacts
      WHERE user_id = $1 AND is_blocked = false AND last_emailed_at IS NOT NULL
      ORDER BY last_emailed_at DESC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [userId, limit]);
    return result.rows.map((row) => this.mapRowToContact(row));
  }

  /**
   * Get blocked contacts
   */
  async getBlockedContacts(userId: string): Promise<EmailContact[]> {
    const query = `
      SELECT * FROM email_contacts
      WHERE user_id = $1 AND is_blocked = true
      ORDER BY email_address ASC
    `;

    const result = await this.pool.query(query, [userId]);
    return result.rows.map((row) => this.mapRowToContact(row));
  }

  /**
   * Increment email count for contact
   */
  async incrementEmailCount(
    emailAddress: string,
    userId: string,
  ): Promise<void> {
    const query = `
      UPDATE email_contacts
      SET 
        email_count = email_count + 1,
        last_emailed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE email_address = $1 AND user_id = $2
    `;

    await this.pool.query(query, [emailAddress.toLowerCase(), userId]);
  }

  /**
   * Auto-populate contact from email
   */
  async autoPopulateFromEmail(
    userId: string,
    emailAddress: string,
    name?: string,
  ): Promise<EmailContact> {
    return await this.upsert({
      userId,
      emailAddress,
      name,
    });
  }

  /**
   * Search contacts by name or email
   */
  async search(
    userId: string,
    query: string,
    limit: number = 20,
  ): Promise<EmailContact[]> {
    const searchQuery = `
      SELECT * FROM email_contacts
      WHERE user_id = $1 AND is_blocked = false
        AND (
          email_address ILIKE $2 OR
          name ILIKE $2
        )
      ORDER BY email_count DESC, last_emailed_at DESC
      LIMIT $3
    `;

    const result = await this.pool.query(searchQuery, [
      userId,
      `%${query}%`,
      limit,
    ]);

    return result.rows.map((row) => this.mapRowToContact(row));
  }

  /**
   * Get contact count
   */
  async getCount(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) FROM email_contacts
      WHERE user_id = $1
    `;

    const result = await this.pool.query(query, [userId]);
    return parseInt(result.rows[0].count);
  }

  /**
   * Get blocked contact count
   */
  async getBlockedCount(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) FROM email_contacts
      WHERE user_id = $1 AND is_blocked = true
    `;

    const result = await this.pool.query(query, [userId]);
    return parseInt(result.rows[0].count);
  }

  /**
   * Merge duplicate contacts
   */
  async mergeDuplicates(
    keepId: string,
    mergeId: string,
    userId: string,
  ): Promise<EmailContact> {
    const keepContact = await this.findById(keepId, userId);
    const mergeContact = await this.findById(mergeId, userId);

    if (!keepContact || !mergeContact) {
      throw new Error("Contact not found");
    }

    // Update keep contact with merged data
    const updates: UpdateContactInput = {};

    if (!keepContact.name && mergeContact.name) {
      updates.name = mergeContact.name;
    }

    if (!keepContact.phone && mergeContact.phone) {
      updates.phone = mergeContact.phone;
    }

    if (!keepContact.avatarUrl && mergeContact.avatarUrl) {
      updates.avatarUrl = mergeContact.avatarUrl;
    }

    // Merge notes
    if (mergeContact.notes) {
      updates.notes = keepContact.notes
        ? `${keepContact.notes}\n\n${mergeContact.notes}`
        : mergeContact.notes;
    }

    // Update email count
    const query = `
      UPDATE email_contacts
      SET email_count = email_count + $1
      WHERE id = $2 AND user_id = $3
    `;

    await this.pool.query(query, [mergeContact.emailCount, keepId, userId]);

    // Delete merge contact
    await this.delete(mergeId, userId);

    // Update and return
    if (Object.keys(updates).length > 0) {
      return await this.update(keepId, userId, updates);
    }

    return (await this.findById(keepId, userId)) as EmailContact;
  }

  /**
   * Map database row to EmailContact object
   */
  private mapRowToContact(row: any): EmailContact {
    return {
      id: row.id,
      userId: row.user_id,
      emailAddress: row.email_address,
      name: row.name,
      avatarUrl: row.avatar_url,
      emailCount: row.email_count,
      lastEmailedAt: row.last_emailed_at
        ? new Date(row.last_emailed_at)
        : undefined,
      phone: row.phone,
      notes: row.notes,
      isBlocked: row.is_blocked,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

/**
 * Create contact repository instance
 */
export function createContactRepository(pool: Pool): ContactRepository {
  return new ContactRepository(pool);
}
