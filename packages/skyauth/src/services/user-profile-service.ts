/**
 * User Profile Management Service
 * Issue #29: Implement user profile management
 */

import { Pool } from "pg";
import type { UserProfile } from "@opensky/types";
import { NotFoundError, ValidationError } from "../errors.js";

export interface UpdateProfileData {
  bio?: string;
  phoneNumber?: string;
  timezone?: string;
  locale?: string;
  notificationEmail?: boolean;
  notificationPush?: boolean;
  notificationSlack?: boolean;
  notificationInApp?: boolean;
}

export class UserProfileService {
  constructor(private pool: Pool) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const result = await this.pool.query<UserProfile>(
      `SELECT * FROM user_profiles WHERE user_id = $1`,
      [userId],
    );

    if (result.rows.length === 0) {
      // Create default profile if it doesn't exist
      return this.createDefaultProfile(userId);
    }

    return this.mapRow(result.rows[0]);
  }

  async updateProfile(
    userId: string,
    data: UpdateProfileData,
  ): Promise<UserProfile> {
    // Check if profile exists
    const existing = await this.pool.query(
      `SELECT user_id FROM user_profiles WHERE user_id = $1`,
      [userId],
    );

    if (existing.rows.length === 0) {
      // Create profile first
      await this.createDefaultProfile(userId);
    }

    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.bio !== undefined) {
      fields.push(`bio = $${paramCount++}`);
      values.push(data.bio);
    }
    if (data.phoneNumber !== undefined) {
      fields.push(`phone_number = $${paramCount++}`);
      values.push(data.phoneNumber);
    }
    if (data.timezone !== undefined) {
      fields.push(`timezone = $${paramCount++}`);
      values.push(data.timezone);
    }
    if (data.locale !== undefined) {
      fields.push(`locale = $${paramCount++}`);
      values.push(data.locale);
    }
    if (data.notificationEmail !== undefined) {
      fields.push(`notification_email = $${paramCount++}`);
      values.push(data.notificationEmail);
    }
    if (data.notificationPush !== undefined) {
      fields.push(`notification_push = $${paramCount++}`);
      values.push(data.notificationPush);
    }
    if (data.notificationSlack !== undefined) {
      fields.push(`notification_slack = $${paramCount++}`);
      values.push(data.notificationSlack);
    }
    if (data.notificationInApp !== undefined) {
      fields.push(`notification_in_app = $${paramCount++}`);
      values.push(data.notificationInApp);
    }

    if (fields.length === 0) {
      throw new ValidationError("No fields to update");
    }

    values.push(userId);

    const result = await this.pool.query<UserProfile>(
      `UPDATE user_profiles SET ${fields.join(", ")} WHERE user_id = $${paramCount} RETURNING *`,
      values,
    );

    return this.mapRow(result.rows[0]);
  }

  async deleteProfile(userId: string): Promise<void> {
    const result = await this.pool.query(
      `DELETE FROM user_profiles WHERE user_id = $1`,
      [userId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError("User profile");
    }
  }

  private async createDefaultProfile(userId: string): Promise<UserProfile> {
    const result = await this.pool.query<UserProfile>(
      `INSERT INTO user_profiles (user_id, timezone, locale)
       VALUES ($1, 'UTC', 'en-US')
       RETURNING *`,
      [userId],
    );

    return this.mapRow(result.rows[0]);
  }

  private mapRow(row: any): UserProfile {
    return {
      userId: row.user_id,
      bio: row.bio,
      phoneNumber: row.phone_number,
      timezone: row.timezone,
      locale: row.locale,
      notificationPreferences: {
        email: row.notification_email,
        push: row.notification_push,
        slack: row.notification_slack,
        inApp: row.notification_in_app,
      },
    };
  }
}
