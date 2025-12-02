/**
 * Tests for API Key Service
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiKeyService } from "../api-keys.js";
import type { ApiKeyRepository } from "../api-keys.js";
import type { AuthConfig } from "../../types.js";
import { UnauthorizedError, ValidationError } from "../../errors.js";

const createMockApiKeyRepo = (): ApiKeyRepository => ({
  create: vi.fn(),
  findByPrefix: vi.fn(),
  findByUserId: vi.fn(),
  updateLastUsed: vi.fn(),
  revoke: vi.fn(),
  delete: vi.fn(),
});

const mockConfig: AuthConfig = {
  jwtSecret: "test-secret",
  jwtAccessExpiry: "15m",
  jwtRefreshExpiry: "7d",
  passwordSaltRounds: 10,
  emailVerificationExpiry: 24 * 60 * 60 * 1000,
  passwordResetExpiry: 60 * 60 * 1000,
};

describe("ApiKeyService", () => {
  let service: ApiKeyService;
  let apiKeyRepo: ApiKeyRepository;

  beforeEach(() => {
    apiKeyRepo = createMockApiKeyRepo();
    service = new ApiKeyService(mockConfig, apiKeyRepo);
  });

  describe("createApiKey", () => {
    it("should create an API key with correct format", async () => {
      const userId = "user-123";
      const keyData = {
        name: "Test API Key",
        scopes: ["read", "write"],
      };

      vi.mocked(apiKeyRepo.create).mockResolvedValue({
        id: "key-123",
        userId,
        name: keyData.name,
        keyHash: "hashed-key",
        prefix: "sky_12345678",
        scopes: keyData.scopes,
        createdAt: new Date(),
      });

      const result = await service.createApiKey(userId, keyData);

      expect(result.key).toMatch(/^sky_[a-zA-Z0-9_-]{32}$/);
      expect(result.prefix).toMatch(/^sky_[a-zA-Z0-9_-]{8}$/);
      expect(result.name).toBe(keyData.name);
      expect(result.scopes).toEqual(keyData.scopes);
    });

    it("should throw ValidationError for empty name", async () => {
      const keyData = {
        name: "",
        scopes: ["read"],
      };

      await expect(service.createApiKey("user-123", keyData)).rejects.toThrow(
        /character/i,
      );
    });

    it("should create key with expiry when provided", async () => {
      const userId = "user-123";
      const keyData = {
        name: "Test Key",
        scopes: ["read"],
        expiresInDays: 30,
      };

      vi.mocked(apiKeyRepo.create).mockResolvedValue({
        id: "key-123",
        userId,
        name: keyData.name,
        keyHash: "hashed-key",
        prefix: "sky_12345678",
        scopes: keyData.scopes,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      });

      const result = await service.createApiKey(userId, keyData);

      expect(result.expiresAt).toBeDefined();
    });
  });

  describe("verifyApiKey", () => {
    it("should throw UnauthorizedError for invalid format", async () => {
      await expect(service.verifyApiKey("invalid-key")).rejects.toThrow(
        "Invalid API key format",
      );
    });

    it("should throw UnauthorizedError for unknown key", async () => {
      vi.mocked(apiKeyRepo.findByPrefix).mockResolvedValue(null);

      await expect(service.verifyApiKey("sky_unknownkey123")).rejects.toThrow(
        /invalid/i,
      );
    });

    it("should throw UnauthorizedError for revoked key", async () => {
      vi.mocked(apiKeyRepo.findByPrefix).mockResolvedValue({
        id: "key-123",
        userId: "user-123",
        name: "Test Key",
        keyHash: "hashed-key",
        prefix: "sky_12345678",
        scopes: ["read"],
        revokedAt: new Date(),
        createdAt: new Date(),
      });

      await expect(service.verifyApiKey("sky_12345678xxx")).rejects.toThrow(
        "revoked",
      );
    });

    it("should throw UnauthorizedError for expired key", async () => {
      vi.mocked(apiKeyRepo.findByPrefix).mockResolvedValue({
        id: "key-123",
        userId: "user-123",
        name: "Test Key",
        keyHash: "hashed-key",
        prefix: "sky_12345678",
        scopes: ["read"],
        expiresAt: new Date(Date.now() - 1000),
        createdAt: new Date(),
      });

      await expect(service.verifyApiKey("sky_12345678xxx")).rejects.toThrow(
        "expired",
      );
    });
  });

  describe("listApiKeys", () => {
    it("should return list of keys without keyHash", async () => {
      const userId = "user-123";

      vi.mocked(apiKeyRepo.findByUserId).mockResolvedValue([
        {
          id: "key-1",
          userId,
          name: "Key 1",
          keyHash: "secret-hash-1",
          prefix: "sky_aaaaaaaa",
          scopes: ["read"],
          createdAt: new Date(),
        },
        {
          id: "key-2",
          userId,
          name: "Key 2",
          keyHash: "secret-hash-2",
          prefix: "sky_bbbbbbbb",
          scopes: ["write"],
          createdAt: new Date(),
        },
      ]);

      const result = await service.listApiKeys(userId);

      expect(result).toHaveLength(2);
      expect(result[0]).not.toHaveProperty("keyHash");
      expect(result[1]).not.toHaveProperty("keyHash");
      expect(result[0].name).toBe("Key 1");
      expect(result[1].name).toBe("Key 2");
    });
  });
});
