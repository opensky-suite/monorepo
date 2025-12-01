/**
 * PostgreSQL Password Reset Repository
 */

import { Pool } from "pg";
import type { PasswordReset } from "@opensky/types";

export class PasswordResetRepository {
  constructor(private pool: Pool) {}

  async create(
    data: Omit<PasswordReset, "id" | "createdAt">,
  ): Promise<PasswordReset> {
    const result = await this.pool.query<PasswordReset>(
      `INSERT INTO password_resets (user_id, token, expires_at)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.userId, data.token, data.expiresAt],
    );

    return this.mapRow(result.rows[0]);
  }

  async findByToken(token: string): Promise<PasswordReset | null> {
    const result = await this.pool.query<PasswordReset>(
      `SELECT * FROM password_resets WHERE token = $1`,
      [token],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  async markAsUsed(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id],
    );
  }

  private mapRow(row: any): PasswordReset {
    return {
      id: row.id,
      userId: row.user_id,
      token: row.token,
      expiresAt: row.expires_at,
      usedAt: row.used_at,
      createdAt: row.created_at,
    };
  }
}
