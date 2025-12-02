/**
 * Session Management Service Tests
 * Issue #31: Session management and active session list
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { SessionManagementService } from "../session-management.js";
import { NotFoundError, UnauthorizedError } from "../../errors.js";
import type { Session } from "@opensky/types";

const createMockPool = () => ({
  query: vi.fn(),
});

describe("SessionManagementService", () => {
  let mockPool: ReturnType<typeof createMockPool>;
  let service: SessionManagementService;

  beforeEach(() => {
    mockPool = createMockPool();
    service = new SessionManagementService(mockPool as any);
  });

  describe("getActiveSessions", () => {
    it("should return all active sessions for a user", async () => {
      const mockSessions: Session[] = [
        {
          id: "session-1",
          userId: "user-123",
          token: "token-1",
          expiresAt: new Date("2025-12-31"),
          createdAt: new Date("2025-01-01"),
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
          ipAddress: "192.168.1.1",
        },
        {
          id: "session-2",
          userId: "user-123",
          token: "token-2",
          expiresAt: new Date("2025-12-30"),
          createdAt: new Date("2024-12-31"),
          userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1",
          ipAddress: "192.168.1.2",
        },
      ];

      mockPool.query.mockResolvedValue({ rows: mockSessions });

      const sessions = await service.getActiveSessions("user-123", "token-1");

      expect(sessions).toHaveLength(2);
      expect(sessions[0].isCurrent).toBe(true);
      expect(sessions[1].isCurrent).toBe(false);
      expect(sessions[0].deviceInfo.browser).toBe("Chrome");
      expect(sessions[0].deviceInfo.os).toBe("Windows");
      expect(sessions[1].deviceInfo.browser).toBe("Safari");
      expect(sessions[1].deviceInfo.os).toBe("iOS");
    });

    it("should mark no session as current if no currentToken provided", async () => {
      const mockSessions: Session[] = [
        {
          id: "session-1",
          userId: "user-123",
          token: "token-1",
          expiresAt: new Date("2025-12-31"),
          createdAt: new Date(),
          userAgent: "Chrome",
        },
      ];

      mockPool.query.mockResolvedValue({ rows: mockSessions });

      const sessions = await service.getActiveSessions("user-123");

      expect(sessions[0].isCurrent).toBe(false);
    });

    it("should return empty array if no active sessions", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const sessions = await service.getActiveSessions("user-123");

      expect(sessions).toEqual([]);
    });

    it("should parse Firefox user agent correctly", async () => {
      const mockSessions: Session[] = [
        {
          id: "session-1",
          userId: "user-123",
          token: "token-1",
          expiresAt: new Date("2025-12-31"),
          createdAt: new Date(),
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
        },
      ];

      mockPool.query.mockResolvedValue({ rows: mockSessions });

      const sessions = await service.getActiveSessions("user-123");

      expect(sessions[0].deviceInfo.browser).toBe("Firefox");
      expect(sessions[0].deviceInfo.os).toBe("Windows");
    });

    it("should parse macOS Safari user agent correctly", async () => {
      const mockSessions: Session[] = [
        {
          id: "session-1",
          userId: "user-123",
          token: "token-1",
          expiresAt: new Date("2025-12-31"),
          createdAt: new Date(),
          userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
        },
      ];

      mockPool.query.mockResolvedValue({ rows: mockSessions });

      const sessions = await service.getActiveSessions("user-123");

      expect(sessions[0].deviceInfo.browser).toBe("Safari");
      expect(sessions[0].deviceInfo.os).toBe("macOS");
      expect(sessions[0].deviceInfo.device).toBe("Desktop");
    });

    it("should detect Android mobile device", async () => {
      const mockSessions: Session[] = [
        {
          id: "session-1",
          userId: "user-123",
          token: "token-1",
          expiresAt: new Date("2025-12-31"),
          createdAt: new Date(),
          userAgent:
            "Mozilla/5.0 (Linux; Android 13) Chrome/120.0.0.0 Mobile Safari/537.36",
        },
      ];

      mockPool.query.mockResolvedValue({ rows: mockSessions });

      const sessions = await service.getActiveSessions("user-123");

      expect(sessions[0].deviceInfo.os).toBe("Android");
      expect(sessions[0].deviceInfo.device).toBe("Mobile");
    });

    it("should detect iPad tablet", async () => {
      const mockSessions: Session[] = [
        {
          id: "session-1",
          userId: "user-123",
          token: "token-1",
          expiresAt: new Date("2025-12-31"),
          createdAt: new Date(),
          userAgent:
            "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        },
      ];

      mockPool.query.mockResolvedValue({ rows: mockSessions });

      const sessions = await service.getActiveSessions("user-123");

      expect(sessions[0].deviceInfo.os).toBe("iOS");
      expect(sessions[0].deviceInfo.device).toBe("Tablet");
    });

    it("should handle missing user agent", async () => {
      const mockSessions: Session[] = [
        {
          id: "session-1",
          userId: "user-123",
          token: "token-1",
          expiresAt: new Date("2025-12-31"),
          createdAt: new Date(),
          userAgent: undefined,
        },
      ];

      mockPool.query.mockResolvedValue({ rows: mockSessions });

      const sessions = await service.getActiveSessions("user-123");

      expect(sessions[0].deviceInfo).toEqual({});
    });
  });

  describe("revokeSession", () => {
    it("should revoke a specific session", async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });

      await service.revokeSession("user-123", "session-1", "session-2");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM sessions"),
        ["session-1", "user-123"],
      );
    });

    it("should throw UnauthorizedError when trying to revoke current session", async () => {
      await expect(
        service.revokeSession("user-123", "session-1", "session-1"),
      ).rejects.toThrow("Cannot revoke your current session");

      // Verify error properties
      try {
        await service.revokeSession("user-123", "session-1", "session-1");
        expect.fail("Should have thrown");
      } catch (error: any) {
        expect(error.code).toBe("UNAUTHORIZED");
      }
    });

    it("should throw NotFoundError when session doesn't exist", async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      await expect(
        service.revokeSession("user-123", "nonexistent", "current"),
      ).rejects.toThrow("Session not found");

      // Verify error properties
      try {
        await service.revokeSession("user-123", "nonexistent", "current");
        expect.fail("Should have thrown");
      } catch (error: any) {
        expect(error.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("revokeAllOtherSessions", () => {
    it("should revoke all sessions except current", async () => {
      mockPool.query.mockResolvedValue({ rowCount: 3 });

      const count = await service.revokeAllOtherSessions(
        "user-123",
        "session-current",
      );

      expect(count).toBe(3);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("id != $2"),
        ["user-123", "session-current"],
      );
    });

    it("should return 0 if no other sessions exist", async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      const count = await service.revokeAllOtherSessions(
        "user-123",
        "session-current",
      );

      expect(count).toBe(0);
    });

    it("should handle null rowCount", async () => {
      mockPool.query.mockResolvedValue({ rowCount: null });

      const count = await service.revokeAllOtherSessions(
        "user-123",
        "session-current",
      );

      expect(count).toBe(0);
    });
  });

  describe("revokeAllSessions", () => {
    it("should revoke all sessions including current", async () => {
      mockPool.query.mockResolvedValue({ rowCount: 5 });

      const count = await service.revokeAllSessions("user-123");

      expect(count).toBe(5);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM sessions WHERE user_id = $1"),
        ["user-123"],
      );
    });

    it("should return 0 if no sessions exist", async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      const count = await service.revokeAllSessions("user-123");

      expect(count).toBe(0);
    });
  });

  describe("getSession", () => {
    it("should return session if exists and belongs to user", async () => {
      const mockSession: Session = {
        id: "session-1",
        userId: "user-123",
        token: "token-1",
        expiresAt: new Date("2025-12-31"),
        createdAt: new Date(),
        userAgent: "Chrome",
      };

      mockPool.query.mockResolvedValue({ rows: [mockSession] });

      const session = await service.getSession("session-1", "user-123");

      expect(session).not.toBeNull();
      expect(session?.id).toBe("session-1");
      expect(session?.isCurrent).toBe(false);
    });

    it("should return null if session doesn't exist", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const session = await service.getSession("nonexistent", "user-123");

      expect(session).toBeNull();
    });

    it("should return null if session belongs to different user", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const session = await service.getSession("session-1", "wrong-user");

      expect(session).toBeNull();
    });
  });

  describe("cleanupExpiredSessions", () => {
    it("should delete expired sessions", async () => {
      mockPool.query.mockResolvedValue({ rowCount: 10 });

      const count = await service.cleanupExpiredSessions();

      expect(count).toBe(10);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("expires_at < CURRENT_TIMESTAMP"),
      );
    });

    it("should return 0 if no expired sessions", async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      const count = await service.cleanupExpiredSessions();

      expect(count).toBe(0);
    });
  });

  describe("getSessionCount", () => {
    it("should return active session count", async () => {
      mockPool.query.mockResolvedValue({ rows: [{ count: "5" }] });

      const count = await service.getSessionCount("user-123");

      expect(count).toBe(5);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("COUNT(*) as count"),
        ["user-123"],
      );
    });

    it("should return 0 if no active sessions", async () => {
      mockPool.query.mockResolvedValue({ rows: [{ count: "0" }] });

      const count = await service.getSessionCount("user-123");

      expect(count).toBe(0);
    });
  });
});
