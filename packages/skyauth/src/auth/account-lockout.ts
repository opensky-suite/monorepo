/**
 * Account Lockout Service
 * Issue #32: Account lockout after failed attempts
 *
 * Protects against brute force attacks by locking accounts
 * after too many failed login attempts.
 */

import { Pool } from "pg";
import { UnauthorizedError } from "../errors.js";

export interface AccountLockoutConfig {
  maxAttempts: number; // Max failed attempts before lockout
  lockoutDuration: number; // Lockout duration in minutes
  attemptWindow: number; // Time window to count attempts (minutes)
}

export const DEFAULT_LOCKOUT_CONFIG: AccountLockoutConfig = {
  maxAttempts: 5,
  lockoutDuration: 15, // 15 minutes
  attemptWindow: 15, // Count attempts in last 15 minutes
};

export class AccountLockoutService {
  constructor(
    private pool: Pool,
    private config: AccountLockoutConfig = DEFAULT_LOCKOUT_CONFIG,
  ) {}

  /**
   * Check if account is currently locked
   * @throws UnauthorizedError if account is locked
   */
  async checkLockout(email: string): Promise<void> {
    const result = await this.pool.query(
      `SELECT id, locked_until, failed_login_attempts
       FROM users
       WHERE email = $1`,
      [email],
    );

    if (result.rows.length === 0) {
      // User doesn't exist - don't reveal this
      return;
    }

    const user = result.rows[0];

    if (user.locked_until) {
      const lockedUntil = new Date(user.locked_until);
      const now = new Date();

      if (now < lockedUntil) {
        const minutesRemaining = Math.ceil(
          (lockedUntil.getTime() - now.getTime()) / 1000 / 60,
        );
        throw new UnauthorizedError(
          `Account is locked due to too many failed login attempts. Try again in ${minutesRemaining} minutes.`,
        );
      }

      // Lockout period expired - unlock account
      await this.unlockAccount(user.id);
    }
  }

  /**
   * Record a failed login attempt
   * Locks account if max attempts exceeded
   */
  async recordFailedAttempt(email: string): Promise<void> {
    const result = await this.pool.query(
      `SELECT id, failed_login_attempts, last_failed_login_at
       FROM users  
       WHERE email = $1`,
      [email],
    );

    if (result.rows.length === 0) {
      // User doesn't exist - don't reveal this
      return;
    }

    const user = result.rows[0];
    const now = new Date();
    const attemptWindowMs = this.config.attemptWindow * 60 * 1000;

    // Check if last failed attempt was outside the window
    let attempts = user.failed_login_attempts || 0;
    if (user.last_failed_login_at) {
      const lastAttempt = new Date(user.last_failed_login_at);
      const timeSinceLastAttempt = now.getTime() - lastAttempt.getTime();

      if (timeSinceLastAttempt > attemptWindowMs) {
        // Reset counter if outside window
        attempts = 0;
      }
    }

    attempts += 1;

    if (attempts >= this.config.maxAttempts) {
      // Lock the account
      const lockedUntil = new Date(
        now.getTime() + this.config.lockoutDuration * 60 * 1000,
      );

      await this.pool.query(
        `UPDATE users
         SET failed_login_attempts = $1,
             last_failed_login_at = $2,
             locked_until = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [attempts, now, lockedUntil, user.id],
      );
    } else {
      // Increment attempt counter
      await this.pool.query(
        `UPDATE users
         SET failed_login_attempts = $1,
             last_failed_login_at = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [attempts, now, user.id],
      );
    }
  }

  /**
   * Reset failed login attempts on successful login
   */
  async resetFailedAttempts(userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE users
       SET failed_login_attempts = 0,
           last_failed_login_at = NULL,
           locked_until = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [userId],
    );
  }

  /**
   * Manually unlock an account (admin action)
   */
  async unlockAccount(userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE users
       SET failed_login_attempts = 0,
           last_failed_login_at = NULL,
           locked_until = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [userId],
    );
  }

  /**
   * Get lockout status for a user
   */
  async getLockoutStatus(userId: string): Promise<{
    isLocked: boolean;
    attempts: number;
    lockedUntil?: Date;
  }> {
    const result = await this.pool.query(
      `SELECT failed_login_attempts, locked_until
       FROM users
       WHERE id = $1`,
      [userId],
    );

    if (result.rows.length === 0) {
      throw new Error("User not found");
    }

    const user = result.rows[0];
    const now = new Date();
    const lockedUntil = user.locked_until ? new Date(user.locked_until) : null;
    const isLocked = lockedUntil ? now < lockedUntil : false;

    return {
      isLocked,
      attempts: user.failed_login_attempts || 0,
      lockedUntil: isLocked ? lockedUntil : undefined,
    };
  }
}
