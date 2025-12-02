/**
 * Account Lockout Service Tests
 * Issue #32: Account lockout after failed attempts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AccountLockoutService,
  DEFAULT_LOCKOUT_CONFIG,
  AccountLockoutConfig,
} from "../account-lockout.js";
import { UnauthorizedError } from "../../errors.js";

// Create mock pool with flexible query responses
const createMockPool = () => {
  return {
    query: vi.fn(),
  };
};

describe("AccountLockoutService", () => {
  let mockPool: ReturnType<typeof createMockPool>;
  let service: AccountLockoutService;

  beforeEach(() => {
    mockPool = createMockPool();
    service = new AccountLockoutService(mockPool as any);
  });

  describe("checkLockout", () => {
    it("should pass when user is not locked", async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          {
            id: "user-123",
            locked_until: null,
            failed_login_attempts: 2,
          },
        ],
      });

      await expect(
        service.checkLockout("user@example.com"),
      ).resolves.not.toThrow();
    });

    it("should throw UnauthorizedError when account is locked", async () => {
      const futureTime = new Date(Date.now() + 10 * 60 * 1000); // 10 mins future

      mockPool.query.mockResolvedValue({
        rows: [
          {
            id: "user-123",
            locked_until: futureTime,
            failed_login_attempts: 5,
          },
        ],
      });

      await expect(service.checkLockout("user@example.com")).rejects.toThrow(
        /Account is locked/,
      );

      // Verify it's an UnauthorizedError by checking properties
      try {
        await service.checkLockout("user@example.com");
        expect.fail("Should have thrown");
      } catch (error: any) {
        expect(error.code).toBe("UNAUTHORIZED");
        expect(error.statusCode).toBe(401);
      }
    });

    it("should unlock account when lockout period expired", async () => {
      const pastTime = new Date(Date.now() - 5 * 60 * 1000); // 5 mins ago

      mockPool.query.mockResolvedValue({
        rows: [
          {
            id: "user-123",
            locked_until: pastTime,
            failed_login_attempts: 5,
          },
        ],
      });

      await service.checkLockout("user@example.com");

      // Should call unlockAccount
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE users"),
        ["user-123"],
      );
    });

    it("should not throw when user doesn't exist", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await expect(
        service.checkLockout("nonexistent@example.com"),
      ).resolves.not.toThrow();
    });
  });

  describe("recordFailedAttempt", () => {
    it("should increment failed attempts on first failure", async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          {
            id: "user-123",
            failed_login_attempts: 0,
            last_failed_login_at: null,
          },
        ],
      });

      await service.recordFailedAttempt("user@example.com");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE users"),
        expect.arrayContaining([1, expect.any(Date), "user-123"]),
      );
    });

    it("should lock account after max attempts", async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          {
            id: "user-123",
            failed_login_attempts: 4, // One more will hit the limit
            last_failed_login_at: new Date(),
          },
        ],
      });

      await service.recordFailedAttempt("user@example.com");

      // Should set locked_until
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("locked_until = $3"),
        expect.arrayContaining([
          5, // attempts
          expect.any(Date), // last_failed_login_at
          expect.any(Date), // locked_until
          "user-123",
        ]),
      );
    });

    it("should reset counter if outside attempt window", async () => {
      const oldAttempt = new Date(Date.now() - 20 * 60 * 1000); // 20 mins ago

      mockPool.query.mockResolvedValue({
        rows: [
          {
            id: "user-123",
            failed_login_attempts: 3,
            last_failed_login_at: oldAttempt,
          },
        ],
      });

      await service.recordFailedAttempt("user@example.com");

      // Should reset to 1, not increment to 4
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE users"),
        expect.arrayContaining([1, expect.any(Date), "user-123"]),
      );
    });

    it("should not throw when user doesn't exist", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await expect(
        service.recordFailedAttempt("nonexistent@example.com"),
      ).resolves.not.toThrow();
    });
  });

  describe("resetFailedAttempts", () => {
    it("should reset all lockout fields on successful login", async () => {
      await service.resetFailedAttempts("user-123");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("failed_login_attempts = 0"),
        ["user-123"],
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("last_failed_login_at = NULL"),
        ["user-123"],
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("locked_until = NULL"),
        ["user-123"],
      );
    });
  });

  describe("unlockAccount", () => {
    it("should manually unlock account", async () => {
      await service.unlockAccount("user-123");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("failed_login_attempts = 0"),
        ["user-123"],
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("locked_until = NULL"),
        ["user-123"],
      );
    });
  });

  describe("getLockoutStatus", () => {
    it("should return unlocked status for normal user", async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          {
            failed_login_attempts: 2,
            locked_until: null,
          },
        ],
      });

      const status = await service.getLockoutStatus("user-123");

      expect(status).toEqual({
        isLocked: false,
        attempts: 2,
        lockedUntil: undefined,
      });
    });

    it("should return locked status for locked user", async () => {
      const futureTime = new Date(Date.now() + 10 * 60 * 1000);

      mockPool.query.mockResolvedValue({
        rows: [
          {
            failed_login_attempts: 5,
            locked_until: futureTime,
          },
        ],
      });

      const status = await service.getLockoutStatus("user-123");

      expect(status.isLocked).toBe(true);
      expect(status.attempts).toBe(5);
      expect(status.lockedUntil).toEqual(futureTime);
    });

    it("should return unlocked if lockout period expired", async () => {
      const pastTime = new Date(Date.now() - 5 * 60 * 1000);

      mockPool.query.mockResolvedValue({
        rows: [
          {
            failed_login_attempts: 5,
            locked_until: pastTime,
          },
        ],
      });

      const status = await service.getLockoutStatus("user-123");

      expect(status.isLocked).toBe(false);
      expect(status.lockedUntil).toBeUndefined();
    });

    it("should throw error when user not found", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await expect(service.getLockoutStatus("nonexistent")).rejects.toThrow(
        "User not found",
      );
    });
  });

  describe("custom configuration", () => {
    it("should use custom max attempts", async () => {
      const customConfig: AccountLockoutConfig = {
        maxAttempts: 3,
        lockoutDuration: 30,
        attemptWindow: 10,
      };

      const customService = new AccountLockoutService(
        mockPool as any,
        customConfig,
      );

      mockPool.query.mockResolvedValue({
        rows: [
          {
            id: "user-123",
            failed_login_attempts: 2, // One more will hit limit of 3
            last_failed_login_at: new Date(),
          },
        ],
      });

      await customService.recordFailedAttempt("user@example.com");

      // Should lock after 3 attempts
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("locked_until"),
        expect.any(Array),
      );
    });

    it("should use default config when not provided", () => {
      const defaultService = new AccountLockoutService(mockPool as any);
      expect((defaultService as any).config).toEqual(DEFAULT_LOCKOUT_CONFIG);
    });
  });
});
