/**
 * PostgreSQL User Repository Implementation
 */

import { Pool } from "pg";
import type { User } from "@opensky/types";

export class UserRepository {
  constructor(private pool: Pool) {}

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.pool.query<User>(
      `SELECT * FROM users WHERE email = $1`,
      [email],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.pool.query<User>(
      `SELECT * FROM users WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  async create(
    data: Omit<User, "id" | "createdAt" | "updatedAt">,
  ): Promise<User> {
    const result = await this.pool.query<User>(
      `INSERT INTO users (
        email, email_verified, password_hash, first_name, last_name,
        display_name, avatar_url, two_factor_enabled, two_factor_secret
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        data.email,
        data.emailVerified,
        data.passwordHash,
        data.firstName,
        data.lastName,
        data.displayName,
        data.avatarUrl,
        data.twoFactorEnabled,
        data.twoFactorSecret,
      ],
    );

    return this.mapRow(result.rows[0]);
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.email !== undefined) {
      fields.push(`email = $${paramCount++}`);
      values.push(data.email);
    }
    if (data.emailVerified !== undefined) {
      fields.push(`email_verified = $${paramCount++}`);
      values.push(data.emailVerified);
    }
    if (data.passwordHash !== undefined) {
      fields.push(`password_hash = $${paramCount++}`);
      values.push(data.passwordHash);
    }
    if (data.firstName !== undefined) {
      fields.push(`first_name = $${paramCount++}`);
      values.push(data.firstName);
    }
    if (data.lastName !== undefined) {
      fields.push(`last_name = $${paramCount++}`);
      values.push(data.lastName);
    }
    if (data.displayName !== undefined) {
      fields.push(`display_name = $${paramCount++}`);
      values.push(data.displayName);
    }
    if (data.avatarUrl !== undefined) {
      fields.push(`avatar_url = $${paramCount++}`);
      values.push(data.avatarUrl);
    }
    if (data.twoFactorEnabled !== undefined) {
      fields.push(`two_factor_enabled = $${paramCount++}`);
      values.push(data.twoFactorEnabled);
    }
    if (data.twoFactorSecret !== undefined) {
      fields.push(`two_factor_secret = $${paramCount++}`);
      values.push(data.twoFactorSecret);
    }

    values.push(id);

    const result = await this.pool.query<User>(
      `UPDATE users SET ${fields.join(", ")} WHERE id = $${paramCount} RETURNING *`,
      values,
    );

    return this.mapRow(result.rows[0]);
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [userId],
    );
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
      passwordHash,
      userId,
    ]);
  }

  async delete(id: string): Promise<void> {
    await this.pool.query(`DELETE FROM users WHERE id = $1`, [id]);
  }

  private mapRow(row: any): User {
    return {
      id: row.id,
      email: row.email,
      emailVerified: row.email_verified,
      passwordHash: row.password_hash,
      firstName: row.first_name,
      lastName: row.last_name,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      twoFactorEnabled: row.two_factor_enabled,
      twoFactorSecret: row.two_factor_secret,
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
