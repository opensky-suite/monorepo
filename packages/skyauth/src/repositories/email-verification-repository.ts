/**
 * PostgreSQL Email Verification Repository
 */

import { Pool } from "pg";
import type { EmailVerification } from "@opensky/types";

export class EmailVerificationRepository {
  constructor(private pool: Pool) {}

  async create(
    data: Omit<EmailVerification, "id" | "createdAt">,
  ): Promise<EmailVerification> {
    const result = await this.pool.query<EmailVerification>(
      `INSERT INTO email_verifications (user_id, email, token, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.userId, data.email, data.token, data.expiresAt],
    );

    return this.mapRow(result.rows[0]);
  }

  async findByToken(token: string): Promise<EmailVerification | null> {
    const result = await this.pool.query<EmailVerification>(
      `SELECT * FROM email_verifications WHERE token = $1`,
      [token],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  async markAsVerified(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE email_verifications SET verified_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id],
    );

    // Also update the user's email_verified status
    const verification = await this.pool.query<{ user_id: string }>(
      `SELECT user_id FROM email_verifications WHERE id = $1`,
      [id],
    );

    if (verification.rows.length > 0) {
      await this.pool.query(
        `UPDATE users SET email_verified = true WHERE id = $1`,
        [verification.rows[0].user_id],
      );
    }
  }

  private mapRow(row: any): EmailVerification {
    return {
      id: row.id,
      userId: row.user_id,
      email: row.email,
      token: row.token,
      expiresAt: row.expires_at,
      verifiedAt: row.verified_at,
      createdAt: row.created_at,
    };
  }
}
