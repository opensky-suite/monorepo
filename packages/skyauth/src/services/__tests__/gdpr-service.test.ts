/**
 * GDPR Service Tests
 * Issue #34: GDPR compliance - data export
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GdprService } from "../gdpr-service.js";

const createMockPool = () => ({
  query: vi.fn(),
});

describe("GdprService", () => {
  let mockPool: ReturnType<typeof createMockPool>;
  let service: GdprService;

  beforeEach(() => {
    mockPool = createMockPool();
    service = new GdprService(mockPool as any);
  });

  describe("exportUserData", () => {
    it("should export all user data", async () => {
      const userId = "user-123";
      const now = new Date();

      // Mock user profile
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              email: "user@example.com",
              first_name: "John",
              last_name: "Doe",
              display_name: "John Doe",
              avatar_url: "https://example.com/avatar.jpg",
              email_verified: true,
              two_factor_enabled: false,
              created_at: now,
              updated_at: now,
              last_login_at: now,
            },
          ],
        })
        // Mock sessions
        .mockResolvedValueOnce({
          rows: [
            {
              id: "session-1",
              ip_address: "192.168.1.1",
              user_agent: "Chrome/120",
              created_at: now,
              expires_at: now,
            },
          ],
        })
        // Mock OAuth providers
        .mockResolvedValueOnce({
          rows: [
            {
              provider: "google",
              provider_email: "user@gmail.com",
              created_at: now,
            },
          ],
        })
        // Mock API keys
        .mockResolvedValueOnce({
          rows: [
            {
              id: "key-1",
              name: "Test Key",
              prefix: "sky_12345678",
              scopes: ["read", "write"],
              created_at: now,
              expires_at: now,
              last_used_at: now,
              revoked_at: null,
            },
          ],
        })
        // Mock audit logs
        .mockResolvedValueOnce({
          rows: [
            {
              event_type: "login_success",
              event_category: "authentication",
              status: "success",
              ip_address: "192.168.1.1",
              created_at: now,
            },
          ],
        });

      const result = await service.exportUserData(userId);

      expect(result.userId).toBe(userId);
      expect(result.exportDate).toBeDefined();
      expect(result.profile.email).toBe("user@example.com");
      expect(result.profile.firstName).toBe("John");
      expect(result.sessions).toHaveLength(1);
      expect(result.oauthProviders).toHaveLength(1);
      expect(result.apiKeys).toHaveLength(1);
      expect(result.auditLogs).toHaveLength(1);
    });

    it("should throw error when user not found", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // No user
        .mockResolvedValueOnce({ rows: [] }) // sessions
        .mockResolvedValueOnce({ rows: [] }) // oauth
        .mockResolvedValueOnce({ rows: [] }) // api keys
        .mockResolvedValueOnce({ rows: [] }); // audit logs

      await expect(service.exportUserData("nonexistent")).rejects.toThrow(
        "User not found",
      );
    });

    it("should handle user with no sessions", async () => {
      const userId = "user-123";
      const now = new Date();

      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              email: "user@example.com",
              first_name: "John",
              last_name: "Doe",
              display_name: "John Doe",
              email_verified: true,
              two_factor_enabled: false,
              created_at: now,
              updated_at: now,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // No sessions
        .mockResolvedValueOnce({ rows: [] }) // No OAuth
        .mockResolvedValueOnce({ rows: [] }) // No API keys
        .mockResolvedValueOnce({ rows: [] }); // No audit logs

      const result = await service.exportUserData(userId);

      expect(result.sessions).toHaveLength(0);
      expect(result.oauthProviders).toHaveLength(0);
      expect(result.apiKeys).toHaveLength(0);
      expect(result.auditLogs).toHaveLength(0);
    });

    it("should handle optional fields being null", async () => {
      const userId = "user-123";
      const now = new Date();

      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              email: "user@example.com",
              first_name: "John",
              last_name: "Doe",
              display_name: "John Doe",
              avatar_url: null,
              email_verified: false,
              two_factor_enabled: false,
              created_at: now,
              updated_at: now,
              last_login_at: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: "key-1",
              name: "Test",
              prefix: "sky_123",
              scopes: null, // null scopes
              created_at: now,
              expires_at: null,
              last_used_at: null,
              revoked_at: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.exportUserData(userId);

      expect(result.profile.avatarUrl).toBeFalsy();
      expect(result.profile.lastLoginAt).toBeFalsy();
      expect(result.apiKeys[0].scopes).toEqual([]);
      expect(result.apiKeys[0].expiresAt).toBeUndefined();
    });

    it("should format dates as ISO strings", async () => {
      const userId = "user-123";
      const specificDate = new Date("2025-06-15T10:30:00Z");

      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              email: "user@example.com",
              first_name: "Test",
              last_name: "User",
              display_name: "Test User",
              email_verified: true,
              two_factor_enabled: false,
              created_at: specificDate,
              updated_at: specificDate,
              last_login_at: specificDate,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.exportUserData(userId);

      expect(result.profile.createdAt).toBe("2025-06-15T10:30:00.000Z");
      expect(result.profile.lastLoginAt).toBe("2025-06-15T10:30:00.000Z");
    });
  });

  describe("generateExportFile", () => {
    it("should generate valid JSON", async () => {
      const userId = "user-123";
      const now = new Date();

      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              email: "user@example.com",
              first_name: "John",
              last_name: "Doe",
              display_name: "John Doe",
              email_verified: true,
              two_factor_enabled: false,
              created_at: now,
              updated_at: now,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const jsonString = await service.generateExportFile(userId);
      const parsed = JSON.parse(jsonString);

      expect(parsed.userId).toBe(userId);
      expect(parsed.profile.email).toBe("user@example.com");
    });

    it("should format JSON with indentation", async () => {
      const userId = "user-123";
      const now = new Date();

      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              email: "user@example.com",
              first_name: "Test",
              last_name: "User",
              display_name: "Test User",
              email_verified: true,
              two_factor_enabled: false,
              created_at: now,
              updated_at: now,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const jsonString = await service.generateExportFile(userId);

      // Check that it has proper formatting (newlines and indentation)
      expect(jsonString).toContain("\n");
      expect(jsonString).toContain("  "); // 2-space indentation
    });
  });

  describe("data privacy", () => {
    it("should not export password hash", async () => {
      const userId = "user-123";
      const now = new Date();

      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              email: "user@example.com",
              first_name: "John",
              last_name: "Doe",
              display_name: "John Doe",
              password_hash: "secret-hash", // This should NOT appear in export
              email_verified: true,
              two_factor_enabled: false,
              created_at: now,
              updated_at: now,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.exportUserData(userId);
      const jsonString = JSON.stringify(result);

      expect(jsonString).not.toContain("password");
      expect(jsonString).not.toContain("secret-hash");
    });

    it("should not export OAuth access tokens", async () => {
      const userId = "user-123";
      const now = new Date();

      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              email: "user@example.com",
              first_name: "John",
              last_name: "Doe",
              display_name: "John Doe",
              email_verified: true,
              two_factor_enabled: false,
              created_at: now,
              updated_at: now,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              provider: "google",
              provider_email: "user@gmail.com",
              access_token: "secret-token", // Should not be queried
              refresh_token: "secret-refresh", // Should not be queried
              created_at: now,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.exportUserData(userId);
      const jsonString = JSON.stringify(result);

      // Verify OAuth export only has safe fields
      expect(result.oauthProviders[0]).toHaveProperty("provider");
      expect(result.oauthProviders[0]).toHaveProperty("providerEmail");
      expect(result.oauthProviders[0]).not.toHaveProperty("accessToken");
      expect(result.oauthProviders[0]).not.toHaveProperty("refreshToken");
    });

    it("should not export API key hashes", async () => {
      const userId = "user-123";
      const now = new Date();

      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              email: "user@example.com",
              first_name: "John",
              last_name: "Doe",
              display_name: "John Doe",
              email_verified: true,
              two_factor_enabled: false,
              created_at: now,
              updated_at: now,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: "key-1",
              name: "Test Key",
              prefix: "sky_123",
              key_hash: "secret-hash", // Should not be queried
              scopes: ["read"],
              created_at: now,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.exportUserData(userId);
      const jsonString = JSON.stringify(result);

      expect(result.apiKeys[0]).toHaveProperty("prefix");
      expect(result.apiKeys[0]).not.toHaveProperty("keyHash");
      expect(jsonString).not.toContain("keyHash");
    });

    it("should not export session tokens", async () => {
      const userId = "user-123";
      const now = new Date();

      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              email: "user@example.com",
              first_name: "John",
              last_name: "Doe",
              display_name: "John Doe",
              email_verified: true,
              two_factor_enabled: false,
              created_at: now,
              updated_at: now,
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: "session-1",
              token: "secret-session-token", // Should not be queried
              ip_address: "192.168.1.1",
              user_agent: "Chrome",
              created_at: now,
              expires_at: now,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.exportUserData(userId);

      expect(result.sessions[0]).not.toHaveProperty("token");
    });
  });
});
