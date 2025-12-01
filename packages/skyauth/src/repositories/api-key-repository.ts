/**
 * PostgreSQL API Key Repository
 */

import { Pool } from "pg";
import type { ApiKey } from "@opensky/types";

export class ApiKeyRepository {
  constructor(private pool: Pool) {}

  async create(data: Omit<ApiKey, "id" | "createdAt">): Promise<ApiKey> {
    const result = await this.pool.query<ApiKey>(
      `INSERT INTO api_keys (
        user_id, name, key_hash, prefix, scopes, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        data.userId,
        data.name,
        data.keyHash,
        data.prefix,
        data.scopes,
        data.expiresAt,
      ],
    );

    return this.mapRow(result.rows[0]);
  }

  async findByPrefix(prefix: string): Promise<ApiKey | null> {
    const result = await this.pool.query<ApiKey>(
      `SELECT * FROM api_keys WHERE prefix = $1`,
      [prefix],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  async findByUserId(userId: string): Promise<ApiKey[]> {
    const result = await this.pool.query<ApiKey>(
      `SELECT * FROM api_keys WHERE user_id = $1 AND revoked_at IS NULL
       ORDER BY created_at DESC`,
      [userId],
    );

    return result.rows.map((row) => this.mapRow(row));
  }

  async updateLastUsed(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id],
    );
  }

  async revoke(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE api_keys SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id],
    );
  }

  async delete(id: string): Promise<void> {
    await this.pool.query(`DELETE FROM api_keys WHERE id = $1`, [id]);
  }

  private mapRow(row: any): ApiKey {
    return {
      id: row.id,
      userId: row.user_id,
      orgId: row.org_id,
      name: row.name,
      keyHash: row.key_hash,
      prefix: row.prefix,
      scopes: row.scopes || [],
      lastUsedAt: row.last_used_at,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      createdAt: row.created_at,
    };
  }
}
