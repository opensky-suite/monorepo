/**
 * OAuth2 Provider Integration
 * Issue #24: Implement OAuth2 provider (Google)
 * Issue #25: Implement OAuth2 provider (GitHub)
 */

import { Pool } from "pg";
import type { User, OAuth2Provider } from "@opensky/types";
import { UserRepository } from "../repositories/user-repository.js";
import { ConflictError, NotFoundError } from "../errors.js";

export interface OAuthProfile {
  provider: "google" | "github" | "microsoft" | "slack";
  providerId: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export class OAuthService {
  private userRepo: UserRepository;

  constructor(private pool: Pool) {
    this.userRepo = new UserRepository(pool);
  }

  /**
   * Handle OAuth login/signup
   * Creates user if doesn't exist, otherwise links OAuth provider
   */
  async handleOAuthCallback(profile: OAuthProfile): Promise<User> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      // Check if OAuth provider already linked
      const existingOAuth = await client.query<OAuth2Provider>(
        `SELECT * FROM oauth_providers WHERE provider = $1 AND provider_id = $2`,
        [profile.provider, profile.providerId],
      );

      if (existingOAuth.rows.length > 0) {
        // Update OAuth provider tokens
        await client.query(
          `UPDATE oauth_providers 
           SET access_token = $1, refresh_token = $2, expires_at = $3, updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [
            profile.accessToken,
            profile.refreshToken,
            profile.expiresAt,
            existingOAuth.rows[0].id,
          ],
        );

        // Return existing user
        const user = await this.userRepo.findById(
          existingOAuth.rows[0].user_id,
        );
        await client.query("COMMIT");

        if (!user) {
          throw new NotFoundError("User");
        }

        return user;
      }

      // Check if user exists with this email
      let user = await this.userRepo.findByEmail(profile.email);

      if (!user) {
        // Create new user
        user = await this.userRepo.create({
          email: profile.email,
          emailVerified: true, // OAuth emails are pre-verified
          firstName: profile.firstName,
          lastName: profile.lastName,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          twoFactorEnabled: false,
          // No password for OAuth-only users
        });
      }

      // Link OAuth provider to user
      await client.query(
        `INSERT INTO oauth_providers (
          user_id, provider, provider_id, provider_email,
          access_token, refresh_token, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          user.id,
          profile.provider,
          profile.providerId,
          profile.email,
          profile.accessToken,
          profile.refreshToken,
          profile.expiresAt,
        ],
      );

      await client.query("COMMIT");
      return user;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get user's linked OAuth providers
   */
  async getUserOAuthProviders(userId: string): Promise<OAuth2Provider[]> {
    const result = await this.pool.query<OAuth2Provider>(
      `SELECT * FROM oauth_providers WHERE user_id = $1 ORDER BY created_at`,
      [userId],
    );

    return result.rows.map((row) => this.mapOAuthRow(row));
  }

  /**
   * Unlink OAuth provider from user
   */
  async unlinkOAuthProvider(userId: string, provider: string): Promise<void> {
    // Check if user has password before unlinking
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError("User");
    }

    // Get all OAuth providers for this user
    const providers = await this.getUserOAuthProviders(userId);

    // Don't allow unlinking if it's the only auth method
    if (!user.passwordHash && providers.length === 1) {
      throw new ConflictError(
        "Cannot unlink the only authentication method. Set a password first.",
      );
    }

    const result = await this.pool.query(
      `DELETE FROM oauth_providers WHERE user_id = $1 AND provider = $2`,
      [userId, provider],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError("OAuth provider");
    }
  }

  /**
   * Refresh OAuth access token
   */
  async refreshOAuthToken(
    userId: string,
    provider: string,
    newAccessToken: string,
    newRefreshToken?: string,
    expiresAt?: Date,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE oauth_providers
       SET access_token = $1, refresh_token = COALESCE($2, refresh_token), 
           expires_at = $3, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $4 AND provider = $5`,
      [newAccessToken, newRefreshToken, expiresAt, userId, provider],
    );
  }

  private mapOAuthRow(row: any): OAuth2Provider {
    return {
      id: row.id,
      provider: row.provider,
      userId: row.user_id,
      providerId: row.provider_id,
      providerEmail: row.provider_email,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
