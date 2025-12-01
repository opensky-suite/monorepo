/**
 * Tests for User Repository
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Pool } from "pg";
import { UserRepository } from "../user-repository.js";

// These tests require a running PostgreSQL database
// Skip in CI if DB is not available
const dbAvailable = process.env.DATABASE_URL || process.env.DB_HOST;

describe.skipIf(!dbAvailable)("UserRepository", () => {
  let pool: Pool;
  let repo: UserRepository;

  beforeEach(async () => {
    pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ||
        `postgresql://${process.env.DB_USER || "opensky"}:${process.env.DB_PASSWORD || "dev_password_change_in_production"}@${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || "opensky_dev"}`,
    });
    repo = new UserRepository(pool);
  });

  afterEach(async () => {
    await pool.end();
  });

  describe("create and findByEmail", () => {
    it("should create a user and find by email", async () => {
      const userData = {
        email: `test-${Date.now()}@example.com`,
        emailVerified: false,
        passwordHash: "hashed_password",
        firstName: "Test",
        lastName: "User",
        displayName: "Test User",
        twoFactorEnabled: false,
      };

      const created = await repo.create(userData);

      expect(created.id).toBeDefined();
      expect(created.email).toBe(userData.email);
      expect(created.firstName).toBe(userData.firstName);

      const found = await repo.findByEmail(userData.email);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);

      // Cleanup
      await repo.delete(created.id);
    });

    it("should return null for non-existent email", async () => {
      const result = await repo.findByEmail("nonexistent@example.com");
      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("should update user fields", async () => {
      const user = await repo.create({
        email: `update-test-${Date.now()}@example.com`,
        emailVerified: false,
        passwordHash: "hashed",
        firstName: "Original",
        lastName: "Name",
        displayName: "Original Name",
        twoFactorEnabled: false,
      });

      const updated = await repo.update(user.id, {
        firstName: "Updated",
        displayName: "Updated Name",
      });

      expect(updated.firstName).toBe("Updated");
      expect(updated.displayName).toBe("Updated Name");
      expect(updated.lastName).toBe("Name"); // Unchanged

      // Cleanup
      await repo.delete(user.id);
    });
  });
});
