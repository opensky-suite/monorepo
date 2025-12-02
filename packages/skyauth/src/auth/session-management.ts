/**
 * Session Management Service
 * Issue #31: Session management and active session list
 *
 * Allows users to view and manage their active sessions across devices.
 */

import { Pool } from "pg";
import type { Session } from "@opensky/types";
import { NotFoundError, UnauthorizedError } from "../errors.js";

export interface SessionInfo extends Session {
  isCurrent: boolean;
  deviceInfo: {
    browser?: string;
    os?: string;
    device?: string;
  };
  location?: {
    city?: string;
    country?: string;
  };
}

export class SessionManagementService {
  constructor(private pool: Pool) {}

  /**
   * Parse user agent string to extract device information
   */
  private parseUserAgent(userAgent: string): {
    browser?: string;
    os?: string;
    device?: string;
  } {
    if (!userAgent) {
      return {};
    }

    const ua = userAgent.toLowerCase();
    const deviceInfo: { browser?: string; os?: string; device?: string } = {};

    // Detect browser
    if (ua.includes("firefox")) {
      deviceInfo.browser = "Firefox";
    } else if (ua.includes("edg")) {
      deviceInfo.browser = "Edge";
    } else if (ua.includes("chrome")) {
      deviceInfo.browser = "Chrome";
    } else if (ua.includes("safari") && !ua.includes("chrome")) {
      deviceInfo.browser = "Safari";
    } else if (ua.includes("opera") || ua.includes("opr")) {
      deviceInfo.browser = "Opera";
    }

    // Detect OS (order matters - check mobile first)
    if (ua.includes("android")) {
      deviceInfo.os = "Android";
    } else if (ua.includes("iphone") || ua.includes("ipad")) {
      deviceInfo.os = "iOS";
    } else if (ua.includes("windows")) {
      deviceInfo.os = "Windows";
    } else if (ua.includes("mac os")) {
      deviceInfo.os = "macOS";
    } else if (ua.includes("linux")) {
      deviceInfo.os = "Linux";
    }

    // Detect device type
    if (
      ua.includes("mobile") ||
      ua.includes("android") ||
      ua.includes("iphone")
    ) {
      deviceInfo.device = "Mobile";
    } else if (ua.includes("tablet") || ua.includes("ipad")) {
      deviceInfo.device = "Tablet";
    } else {
      deviceInfo.device = "Desktop";
    }

    return deviceInfo;
  }

  /**
   * Get all active sessions for a user
   */
  async getActiveSessions(
    userId: string,
    currentToken?: string,
  ): Promise<SessionInfo[]> {
    const result = await this.pool.query<Session>(
      `SELECT * FROM sessions
       WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC`,
      [userId],
    );

    return result.rows.map((session) => ({
      ...session,
      isCurrent: currentToken ? session.token === currentToken : false,
      deviceInfo: this.parseUserAgent(session.userAgent || ""),
      // Location detection would require IP geolocation service
      // For now, just return empty
      location: undefined,
    }));
  }

  /**
   * Revoke a specific session
   * Prevents revoking your own current session
   */
  async revokeSession(
    userId: string,
    sessionId: string,
    currentSessionId: string,
  ): Promise<void> {
    // Don't allow revoking current session
    if (sessionId === currentSessionId) {
      throw new UnauthorizedError(
        "Cannot revoke your current session. Use logout instead.",
      );
    }

    const result = await this.pool.query(
      `DELETE FROM sessions
       WHERE id = $1 AND user_id = $2`,
      [sessionId, userId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError("Session");
    }
  }

  /**
   * Revoke all sessions except the current one
   * Useful for "log out everywhere else" functionality
   */
  async revokeAllOtherSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM sessions
       WHERE user_id = $1 AND id != $2`,
      [userId, currentSessionId],
    );

    return result.rowCount || 0;
  }

  /**
   * Revoke all sessions (including current)
   * Used during password change or security events
   */
  async revokeAllSessions(userId: string): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM sessions WHERE user_id = $1`,
      [userId],
    );

    return result.rowCount || 0;
  }

  /**
   * Get session by ID and verify ownership
   */
  async getSession(
    sessionId: string,
    userId: string,
  ): Promise<SessionInfo | null> {
    const result = await this.pool.query<Session>(
      `SELECT * FROM sessions
       WHERE id = $1 AND user_id = $2`,
      [sessionId, userId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const session = result.rows[0];
    return {
      ...session,
      isCurrent: false, // Unknown without current token
      deviceInfo: this.parseUserAgent(session.userAgent || ""),
      location: undefined,
    };
  }

  /**
   * Clean up expired sessions (maintenance task)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP`,
    );

    return result.rowCount || 0;
  }

  /**
   * Get session count for a user
   */
  async getSessionCount(userId: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT COUNT(*) as count FROM sessions
       WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP`,
      [userId],
    );

    return parseInt(result.rows[0].count, 10);
  }
}
