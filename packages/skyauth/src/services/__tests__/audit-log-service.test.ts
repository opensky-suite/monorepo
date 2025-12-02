/**
 * Audit Log Service Tests
 * Issue #33: Security audit logs
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AuditLogService,
  AuditEventType,
  AuditEventCategory,
  AuditEventStatus,
  CreateAuditLogParams,
} from "../audit-log-service.js";

const createMockPool = () => ({
  query: vi.fn(),
});

describe("AuditLogService", () => {
  let mockPool: ReturnType<typeof createMockPool>;
  let service: AuditLogService;

  beforeEach(() => {
    mockPool = createMockPool();
    service = new AuditLogService(mockPool as any);
  });

  describe("log", () => {
    it("should create an audit log entry with all fields", async () => {
      const params: CreateAuditLogParams = {
        userId: "user-123",
        eventType: AuditEventType.LOGIN_SUCCESS,
        eventCategory: AuditEventCategory.AUTHENTICATION,
        status: AuditEventStatus.SUCCESS,
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        metadata: { sessionId: "session-456" },
      };

      const mockRow = {
        id: "log-123",
        user_id: "user-123",
        event_type: "login_success",
        event_category: "authentication",
        status: "success",
        ip_address: "192.168.1.1",
        user_agent: "Mozilla/5.0",
        metadata: { sessionId: "session-456" },
        created_at: new Date("2025-01-01"),
      };

      mockPool.query.mockResolvedValue({ rows: [mockRow] });

      const result = await service.log(params);

      expect(result.id).toBe("log-123");
      expect(result.userId).toBe("user-123");
      expect(result.eventType).toBe(AuditEventType.LOGIN_SUCCESS);
      expect(result.eventCategory).toBe(AuditEventCategory.AUTHENTICATION);
      expect(result.status).toBe(AuditEventStatus.SUCCESS);
      expect(result.metadata).toEqual({ sessionId: "session-456" });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO audit_logs"),
        [
          "user-123",
          "login_success",
          "authentication",
          "success",
          "192.168.1.1",
          "Mozilla/5.0",
          JSON.stringify({ sessionId: "session-456" }),
        ],
      );
    });

    it("should create audit log without optional fields", async () => {
      const params: CreateAuditLogParams = {
        eventType: AuditEventType.LOGIN_FAILED,
        eventCategory: AuditEventCategory.AUTHENTICATION,
        status: AuditEventStatus.FAILURE,
      };

      const mockRow = {
        id: "log-456",
        user_id: null,
        event_type: "login_failed",
        event_category: "authentication",
        status: "failure",
        ip_address: null,
        user_agent: null,
        metadata: null,
        created_at: new Date(),
      };

      mockPool.query.mockResolvedValue({ rows: [mockRow] });

      const result = await service.log(params);

      expect(result.userId).toBeNull();
      expect(result.ipAddress).toBeNull();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO audit_logs"),
        [null, "login_failed", "authentication", "failure", null, null, null],
      );
    });
  });

  describe("query", () => {
    it("should query logs with all filters", async () => {
      const mockRows = [
        {
          id: "log-1",
          user_id: "user-123",
          event_type: "login_success",
          event_category: "authentication",
          status: "success",
          created_at: new Date(),
        },
      ];

      mockPool.query.mockResolvedValue({ rows: mockRows });

      const startDate = new Date("2025-01-01");
      const endDate = new Date("2025-01-31");

      const result = await service.query({
        userId: "user-123",
        eventType: AuditEventType.LOGIN_SUCCESS,
        eventCategory: AuditEventCategory.AUTHENTICATION,
        status: AuditEventStatus.SUCCESS,
        startDate,
        endDate,
        limit: 50,
        offset: 10,
      });

      expect(result).toHaveLength(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE"),
        expect.arrayContaining([
          "user-123",
          "login_success",
          "authentication",
          "success",
          startDate,
          endDate,
          50,
          10,
        ]),
      );
    });

    it("should query logs with no filters", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.query();

      expect(result).toEqual([]);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.not.stringContaining("WHERE"),
        [100, 0], // default limit and offset
      );
    });

    it("should use default limit of 100", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.query({ userId: "user-123" });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([100, 0]),
      );
    });
  });

  describe("getUserLogs", () => {
    it("should get logs for a specific user", async () => {
      const mockRows = [
        {
          id: "log-1",
          user_id: "user-123",
          event_type: "login_success",
          event_category: "authentication",
          status: "success",
          created_at: new Date(),
        },
        {
          id: "log-2",
          user_id: "user-123",
          event_type: "password_changed",
          event_category: "password",
          status: "success",
          created_at: new Date(),
        },
      ];

      mockPool.query.mockResolvedValue({ rows: mockRows });

      const result = await service.getUserLogs("user-123", 50);

      expect(result).toHaveLength(2);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("user_id = $1"),
        expect.arrayContaining(["user-123", 50]),
      );
    });

    it("should use default limit of 100", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.getUserLogs("user-123");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([100]),
      );
    });
  });

  describe("getRecentSecurityEvents", () => {
    it("should get security events from last 24 hours by default", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.getRecentSecurityEvents();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("event_category = $1"),
        expect.arrayContaining(["security"]),
      );
    });

    it("should accept custom hours parameter", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.getRecentSecurityEvents(48, 200);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([200]),
      );
    });
  });

  describe("getFailedLoginAttempts", () => {
    it("should get failed login attempts for a user", async () => {
      const mockRows = [
        {
          id: "log-1",
          user_id: "user-123",
          event_type: "login_failed",
          event_category: "authentication",
          status: "failure",
          ip_address: "192.168.1.1",
          created_at: new Date(),
        },
      ];

      mockPool.query.mockResolvedValue({ rows: mockRows });

      const result = await service.getFailedLoginAttempts("user-123", 12);

      expect(result).toHaveLength(1);
      expect(result[0].eventType).toBe(AuditEventType.LOGIN_FAILED);
    });
  });

  describe("countEventsByType", () => {
    it("should count events by type", async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { event_type: "login_success", count: "150" },
          { event_type: "login_failed", count: "25" },
        ],
      });

      const counts = await service.countEventsByType(
        AuditEventCategory.AUTHENTICATION,
        24,
      );

      expect(counts.get("login_success")).toBe(150);
      expect(counts.get("login_failed")).toBe(25);
      expect(counts.size).toBe(2);
    });

    it("should return empty map if no events", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const counts = await service.countEventsByType(
        AuditEventCategory.SECURITY,
      );

      expect(counts.size).toBe(0);
    });
  });

  describe("deleteOldLogs", () => {
    it("should delete logs older than specified days", async () => {
      mockPool.query.mockResolvedValue({ rowCount: 500 });

      const deleted = await service.deleteOldLogs(90);

      expect(deleted).toBe(500);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM audit_logs"),
        expect.any(Array),
      );
    });

    it("should return 0 if no logs deleted", async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      const deleted = await service.deleteOldLogs(30);

      expect(deleted).toBe(0);
    });

    it("should handle null rowCount", async () => {
      mockPool.query.mockResolvedValue({ rowCount: null });

      const deleted = await service.deleteOldLogs(30);

      expect(deleted).toBe(0);
    });
  });

  describe("AuditEventType enum", () => {
    it("should have all expected event types", () => {
      expect(AuditEventType.LOGIN_SUCCESS).toBe("login_success");
      expect(AuditEventType.LOGIN_FAILED).toBe("login_failed");
      expect(AuditEventType.LOGOUT).toBe("logout");
      expect(AuditEventType.PASSWORD_CHANGED).toBe("password_changed");
      expect(AuditEventType.TWO_FACTOR_ENABLED).toBe("two_factor_enabled");
      expect(AuditEventType.ACCOUNT_LOCKED).toBe("account_locked");
      expect(AuditEventType.API_KEY_CREATED).toBe("api_key_created");
    });
  });

  describe("AuditEventCategory enum", () => {
    it("should have all expected categories", () => {
      expect(AuditEventCategory.AUTHENTICATION).toBe("authentication");
      expect(AuditEventCategory.ACCOUNT).toBe("account");
      expect(AuditEventCategory.PASSWORD).toBe("password");
      expect(AuditEventCategory.TWO_FACTOR).toBe("two_factor");
      expect(AuditEventCategory.OAUTH).toBe("oauth");
      expect(AuditEventCategory.API_KEY).toBe("api_key");
      expect(AuditEventCategory.SECURITY).toBe("security");
    });
  });

  describe("AuditEventStatus enum", () => {
    it("should have all expected statuses", () => {
      expect(AuditEventStatus.SUCCESS).toBe("success");
      expect(AuditEventStatus.FAILURE).toBe("failure");
      expect(AuditEventStatus.WARNING).toBe("warning");
    });
  });
});
