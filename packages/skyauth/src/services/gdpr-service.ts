/**
 * GDPR Data Export Service
 * Issue #34: GDPR compliance - data export
 *
 * Implements GDPR Article 20 - Right to Data Portability
 * Exports all user data in a structured, machine-readable format (JSON)
 */

import { Pool } from "pg";
import type { User, Session, OAuth2Provider, ApiKey } from "@opensky/types";

export interface UserDataExport {
  exportDate: string;
  userId: string;
  profile: UserProfileExport;
  sessions: SessionExport[];
  oauthProviders: OAuthProviderExport[];
  apiKeys: ApiKeyExport[];
  auditLogs: AuditLogExport[];
}

export interface UserProfileExport {
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl?: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface SessionExport {
  id: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  expiresAt: string;
}

export interface OAuthProviderExport {
  provider: string;
  providerEmail: string;
  linkedAt: string;
}

export interface ApiKeyExport {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
  revokedAt?: string;
}

export interface AuditLogExport {
  eventType: string;
  eventCategory: string;
  status: string;
  ipAddress?: string;
  timestamp: string;
}

export class GdprService {
  constructor(private pool: Pool) {}

  /**
   * Export all user data in GDPR-compliant format
   * Implements Article 20 - Right to Data Portability
   */
  async exportUserData(userId: string): Promise<UserDataExport> {
    const [profile, sessions, oauthProviders, apiKeys, auditLogs] =
      await Promise.all([
        this.getUserProfile(userId),
        this.getUserSessions(userId),
        this.getUserOAuthProviders(userId),
        this.getUserApiKeys(userId),
        this.getUserAuditLogs(userId),
      ]);

    if (!profile) {
      throw new Error("User not found");
    }

    return {
      exportDate: new Date().toISOString(),
      userId,
      profile,
      sessions,
      oauthProviders,
      apiKeys,
      auditLogs,
    };
  }

  /**
   * Get user profile data
   */
  private async getUserProfile(
    userId: string,
  ): Promise<UserProfileExport | null> {
    const result = await this.pool.query(
      `SELECT email, first_name, last_name, display_name, avatar_url,
              email_verified, two_factor_enabled, created_at, updated_at, last_login_at
       FROM users WHERE id = $1`,
      [userId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      emailVerified: row.email_verified,
      twoFactorEnabled: row.two_factor_enabled,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      lastLoginAt: row.last_login_at
        ? new Date(row.last_login_at).toISOString()
        : undefined,
    };
  }

  /**
   * Get user sessions
   */
  private async getUserSessions(userId: string): Promise<SessionExport[]> {
    const result = await this.pool.query(
      `SELECT id, ip_address, user_agent, created_at, expires_at
       FROM sessions WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: new Date(row.created_at).toISOString(),
      expiresAt: new Date(row.expires_at).toISOString(),
    }));
  }

  /**
   * Get user OAuth providers (without sensitive tokens)
   */
  private async getUserOAuthProviders(
    userId: string,
  ): Promise<OAuthProviderExport[]> {
    const result = await this.pool.query(
      `SELECT provider, provider_email, created_at
       FROM oauth_providers WHERE user_id = $1 ORDER BY created_at`,
      [userId],
    );

    return result.rows.map((row) => ({
      provider: row.provider,
      providerEmail: row.provider_email,
      linkedAt: new Date(row.created_at).toISOString(),
    }));
  }

  /**
   * Get user API keys (without sensitive data)
   */
  private async getUserApiKeys(userId: string): Promise<ApiKeyExport[]> {
    const result = await this.pool.query(
      `SELECT id, name, prefix, scopes, created_at, expires_at, last_used_at, revoked_at
       FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      scopes: row.scopes || [],
      createdAt: new Date(row.created_at).toISOString(),
      expiresAt: row.expires_at
        ? new Date(row.expires_at).toISOString()
        : undefined,
      lastUsedAt: row.last_used_at
        ? new Date(row.last_used_at).toISOString()
        : undefined,
      revokedAt: row.revoked_at
        ? new Date(row.revoked_at).toISOString()
        : undefined,
    }));
  }

  /**
   * Get user audit logs
   */
  private async getUserAuditLogs(userId: string): Promise<AuditLogExport[]> {
    const result = await this.pool.query(
      `SELECT event_type, event_category, status, ip_address, created_at
       FROM audit_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1000`,
      [userId],
    );

    return result.rows.map((row) => ({
      eventType: row.event_type,
      eventCategory: row.event_category,
      status: row.status,
      ipAddress: row.ip_address,
      timestamp: new Date(row.created_at).toISOString(),
    }));
  }

  /**
   * Generate downloadable JSON file content
   */
  async generateExportFile(userId: string): Promise<string> {
    const data = await this.exportUserData(userId);
    return JSON.stringify(data, null, 2);
  }
}
