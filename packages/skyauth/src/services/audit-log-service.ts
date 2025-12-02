/**
 * Security Audit Log Service
 * Issue #33: Security audit logs
 *
 * Tracks all security-related events for compliance and forensics.
 */

import { Pool } from "pg";

export enum AuditEventType {
  // Authentication events
  LOGIN_SUCCESS = "login_success",
  LOGIN_FAILED = "login_failed",
  LOGOUT = "logout",
  SESSION_REVOKED = "session_revoked",

  // Account management
  USER_CREATED = "user_created",
  USER_UPDATED = "user_updated",
  USER_DELETED = "user_deleted",
  EMAIL_VERIFIED = "email_verified",

  // Password events
  PASSWORD_CHANGED = "password_changed",
  PASSWORD_RESET_REQUESTED = "password_reset_requested",
  PASSWORD_RESET_COMPLETED = "password_reset_completed",

  // 2FA events
  TWO_FACTOR_ENABLED = "two_factor_enabled",
  TWO_FACTOR_DISABLED = "two_factor_disabled",
  TWO_FACTOR_VERIFIED = "two_factor_verified",
  TWO_FACTOR_FAILED = "two_factor_failed",

  // OAuth events
  OAUTH_LINKED = "oauth_linked",
  OAUTH_UNLINKED = "oauth_unlinked",

  // API key events
  API_KEY_CREATED = "api_key_created",
  API_KEY_REVOKED = "api_key_revoked",

  // Security events
  ACCOUNT_LOCKED = "account_locked",
  ACCOUNT_UNLOCKED = "account_unlocked",
  SUSPICIOUS_ACTIVITY = "suspicious_activity",
}

export enum AuditEventCategory {
  AUTHENTICATION = "authentication",
  ACCOUNT = "account",
  PASSWORD = "password",
  TWO_FACTOR = "two_factor",
  OAUTH = "oauth",
  API_KEY = "api_key",
  SECURITY = "security",
}

export enum AuditEventStatus {
  SUCCESS = "success",
  FAILURE = "failure",
  WARNING = "warning",
}

export interface AuditLogEntry {
  id: string;
  userId?: string;
  eventType: AuditEventType;
  eventCategory: AuditEventCategory;
  status: AuditEventStatus;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface CreateAuditLogParams {
  userId?: string;
  eventType: AuditEventType;
  eventCategory: AuditEventCategory;
  status: AuditEventStatus;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export interface AuditLogQuery {
  userId?: string;
  eventType?: AuditEventType;
  eventCategory?: AuditEventCategory;
  status?: AuditEventStatus;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export class AuditLogService {
  constructor(private pool: Pool) {}

  /**
   * Create a new audit log entry
   */
  async log(params: CreateAuditLogParams): Promise<AuditLogEntry> {
    const result = await this.pool.query(
      `INSERT INTO audit_logs (
        user_id, event_type, event_category, status,
        ip_address, user_agent, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        params.userId || null,
        params.eventType,
        params.eventCategory,
        params.status,
        params.ipAddress || null,
        params.userAgent || null,
        params.metadata ? JSON.stringify(params.metadata) : null,
      ],
    );

    return this.mapAuditLog(result.rows[0]);
  }

  /**
   * Query audit logs with filters
   */
  async query(filters: AuditLogQuery = {}): Promise<AuditLogEntry[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (filters.userId) {
      conditions.push(`user_id = $${paramCount++}`);
      params.push(filters.userId);
    }

    if (filters.eventType) {
      conditions.push(`event_type = $${paramCount++}`);
      params.push(filters.eventType);
    }

    if (filters.eventCategory) {
      conditions.push(`event_category = $${paramCount++}`);
      params.push(filters.eventCategory);
    }

    if (filters.status) {
      conditions.push(`status = $${paramCount++}`);
      params.push(filters.status);
    }

    if (filters.startDate) {
      conditions.push(`created_at >= $${paramCount++}`);
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      conditions.push(`created_at <= $${paramCount++}`);
      params.push(filters.endDate);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const query = `
      SELECT * FROM audit_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    params.push(limit, offset);

    const result = await this.pool.query(query, params);
    return result.rows.map((row) => this.mapAuditLog(row));
  }

  /**
   * Get audit logs for a specific user
   */
  async getUserLogs(userId: string, limit = 100): Promise<AuditLogEntry[]> {
    return this.query({ userId, limit });
  }

  /**
   * Get recent security events
   */
  async getRecentSecurityEvents(
    hours = 24,
    limit = 100,
  ): Promise<AuditLogEntry[]> {
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.query({
      eventCategory: AuditEventCategory.SECURITY,
      startDate,
      limit,
    });
  }

  /**
   * Get failed login attempts for a user
   */
  async getFailedLoginAttempts(
    userId: string,
    hours = 24,
  ): Promise<AuditLogEntry[]> {
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.query({
      userId,
      eventType: AuditEventType.LOGIN_FAILED,
      startDate,
    });
  }

  /**
   * Count events by type
   */
  async countEventsByType(
    eventCategory: AuditEventCategory,
    hours = 24,
  ): Promise<Map<string, number>> {
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

    const result = await this.pool.query(
      `SELECT event_type, COUNT(*) as count
       FROM audit_logs
       WHERE event_category = $1 AND created_at >= $2
       GROUP BY event_type`,
      [eventCategory, startDate],
    );

    const counts = new Map<string, number>();
    for (const row of result.rows) {
      counts.set(row.event_type, parseInt(row.count, 10));
    }

    return counts;
  }

  /**
   * Delete old audit logs (for GDPR compliance)
   */
  async deleteOldLogs(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date(
      Date.now() - olderThanDays * 24 * 60 * 60 * 1000,
    );

    const result = await this.pool.query(
      `DELETE FROM audit_logs WHERE created_at < $1`,
      [cutoffDate],
    );

    return result.rowCount || 0;
  }

  /**
   * Map database row to AuditLogEntry
   */
  private mapAuditLog(row: any): AuditLogEntry {
    return {
      id: row.id,
      userId: row.user_id,
      eventType: row.event_type as AuditEventType,
      eventCategory: row.event_category as AuditEventCategory,
      status: row.status as AuditEventStatus,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      metadata: row.metadata,
      createdAt: new Date(row.created_at),
    };
  }
}
