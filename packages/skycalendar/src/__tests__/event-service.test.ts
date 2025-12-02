/**
 * Event Service Tests
 * Comprehensive test coverage for calendar event operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Pool } from "pg";
import { EventService } from "../event-service.js";
import type { CreateEventRequest, UpdateEventRequest } from "../types.js";

describe("EventService", () => {
  let pool: Pool;
  let service: EventService;
  const testUserId = "user-123";
  const testCalendarId = "calendar-123";

  beforeEach(() => {
    pool = new Pool();
    service = new EventService(pool);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createEvent", () => {
    it("should create a basic event", async () => {
      const mockEvent = {
        id: "event-123",
        title: "Team Meeting",
        description: "Weekly sync",
        location: "Conference Room A",
        start_time: new Date("2024-01-15T10:00:00Z"),
        end_time: new Date("2024-01-15T11:00:00Z"),
        timezone: "America/New_York",
        is_all_day: false,
        owner_id: testUserId,
        calendar_id: testCalendarId,
        visibility: "public",
        status: "confirmed",
        recurrence_rule: null,
        recurrence_id: null,
        meeting_url: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      };

      const mockClient = {
        query: vi
          .fn()
          .mockResolvedValueOnce({ rows: [{ owner_id: testUserId }] }) // validateCalendarAccess
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockEvent] }) // INSERT event
          .mockResolvedValueOnce(undefined), // COMMIT
        release: vi.fn(),
      };

      vi.spyOn(pool, "connect").mockResolvedValue(mockClient as any);

      const request: CreateEventRequest = {
        title: "Team Meeting",
        description: "Weekly sync",
        location: "Conference Room A",
        startTime: "2024-01-15T10:00:00",
        endTime: "2024-01-15T11:00:00",
        timezone: "America/New_York",
      };

      const result = await service.createEvent(
        testUserId,
        testCalendarId,
        request,
      );

      expect(result.id).toBe("event-123");
      expect(result.title).toBe("Team Meeting");
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("should create event with attendees", async () => {
      const mockEvent = {
        id: "event-123",
        title: "Team Meeting",
        start_time: new Date("2024-01-15T10:00:00Z"),
        end_time: new Date("2024-01-15T11:00:00Z"),
        timezone: "UTC",
        is_all_day: false,
        owner_id: testUserId,
        calendar_id: testCalendarId,
        visibility: "public",
        status: "confirmed",
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockClient = {
        query: vi
          .fn()
          .mockResolvedValueOnce({ rows: [{ owner_id: testUserId }] })
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockEvent] }) // INSERT event
          .mockResolvedValueOnce(undefined) // INSERT attendee
          .mockResolvedValueOnce(undefined), // COMMIT
        release: vi.fn(),
      };

      vi.spyOn(pool, "connect").mockResolvedValue(mockClient as any);

      const request: CreateEventRequest = {
        title: "Team Meeting",
        startTime: new Date("2024-01-15T10:00:00Z"),
        endTime: new Date("2024-01-15T11:00:00Z"),
        attendees: [{ email: "alice@example.com", role: "required" }],
      };

      const result = await service.createEvent(
        testUserId,
        testCalendarId,
        request,
      );

      expect(result.id).toBe("event-123");
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO event_attendees"),
        expect.any(Array),
      );
    });

    it("should create recurring event", async () => {
      const rrule = "FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=10";
      const mockEvent = {
        id: "event-123",
        title: "Standup",
        start_time: new Date("2024-01-15T09:00:00Z"),
        end_time: new Date("2024-01-15T09:15:00Z"),
        timezone: "UTC",
        is_all_day: false,
        owner_id: testUserId,
        calendar_id: testCalendarId,
        visibility: "public",
        status: "confirmed",
        recurrence_rule: rrule,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockClient = {
        query: vi
          .fn()
          .mockResolvedValueOnce({ rows: [{ owner_id: testUserId }] })
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce({ rows: [mockEvent] })
          .mockResolvedValueOnce(undefined),
        release: vi.fn(),
      };

      vi.spyOn(pool, "connect").mockResolvedValue(mockClient as any);

      const request: CreateEventRequest = {
        title: "Standup",
        startTime: new Date("2024-01-15T09:00:00Z"),
        endTime: new Date("2024-01-15T09:15:00Z"),
        recurrenceRule: rrule,
      };

      const result = await service.createEvent(
        testUserId,
        testCalendarId,
        request,
      );

      expect(result.recurrenceRule).toBe(rrule);
    });

    it("should rollback on error", async () => {
      const mockClient = {
        query: vi
          .fn()
          .mockResolvedValueOnce({ rows: [{ owner_id: testUserId }] })
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockRejectedValueOnce(new Error("Database error")), // INSERT fails
        release: vi.fn(),
      };

      vi.spyOn(pool, "connect").mockResolvedValue(mockClient as any);

      const request: CreateEventRequest = {
        title: "Test Event",
        startTime: new Date(),
        endTime: new Date(),
      };

      await expect(
        service.createEvent(testUserId, testCalendarId, request),
      ).rejects.toThrow("Database error");

      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    });
  });

  describe("getEvent", () => {
    it("should retrieve event by ID", async () => {
      const mockEvent = {
        id: "event-123",
        title: "Meeting",
        start_time: new Date(),
        end_time: new Date(),
        timezone: "UTC",
        is_all_day: false,
        owner_id: testUserId,
        calendar_id: testCalendarId,
        visibility: "public",
        status: "confirmed",
        created_at: new Date(),
        updated_at: new Date(),
      };

      vi.spyOn(pool, "query").mockResolvedValue({ rows: [mockEvent] } as any);

      const result = await service.getEvent("event-123", testUserId);

      expect(result.id).toBe("event-123");
      expect(result.title).toBe("Meeting");
    });

    it("should throw error for non-existent event", async () => {
      vi.spyOn(pool, "query").mockResolvedValue({ rows: [] } as any);

      await expect(service.getEvent("event-999", testUserId)).rejects.toThrow(
        "Event not found or access denied",
      );
    });
  });

  describe("updateEvent", () => {
    it("should update event fields", async () => {
      const mockEvent = {
        id: "event-123",
        title: "Old Title",
        owner_id: testUserId,
        calendar_id: testCalendarId,
        timezone: "UTC",
        start_time: new Date(),
        end_time: new Date(),
        is_all_day: false,
        visibility: "public",
        status: "confirmed",
        created_at: new Date(),
        updated_at: new Date(),
      };

      const updatedEvent = { ...mockEvent, title: "New Title" };

      vi.spyOn(pool, "query")
        .mockResolvedValueOnce({ rows: [mockEvent] } as any) // getEvent
        .mockResolvedValueOnce({ rows: [updatedEvent] } as any); // UPDATE

      const request: UpdateEventRequest = {
        title: "New Title",
      };

      const result = await service.updateEvent(
        "event-123",
        testUserId,
        request,
      );

      expect(result.title).toBe("New Title");
    });

    it("should not update if no changes", async () => {
      const mockEvent = {
        id: "event-123",
        title: "Title",
        owner_id: testUserId,
        calendar_id: testCalendarId,
        timezone: "UTC",
        start_time: new Date(),
        end_time: new Date(),
        is_all_day: false,
        visibility: "public",
        status: "confirmed",
        created_at: new Date(),
        updated_at: new Date(),
      };

      vi.spyOn(pool, "query").mockResolvedValue({ rows: [mockEvent] } as any);

      const result = await service.updateEvent("event-123", testUserId, {});

      expect(result.id).toBe("event-123");
      expect(pool.query).toHaveBeenCalledTimes(1); // Only getEvent
    });
  });

  describe("deleteEvent", () => {
    it("should soft delete event", async () => {
      const mockEvent = {
        id: "event-123",
        owner_id: testUserId,
        calendar_id: testCalendarId,
        title: "Event",
        timezone: "UTC",
        start_time: new Date(),
        end_time: new Date(),
        is_all_day: false,
        visibility: "public",
        status: "confirmed",
        created_at: new Date(),
        updated_at: new Date(),
      };

      vi.spyOn(pool, "query")
        .mockResolvedValueOnce({ rows: [mockEvent] } as any) // getEvent
        .mockResolvedValueOnce({} as any); // UPDATE deleted_at

      await service.deleteEvent("event-123", testUserId);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE events SET deleted_at"),
        ["event-123"],
      );
    });

    it("should throw error if not owner", async () => {
      const mockEvent = {
        id: "event-123",
        owner_id: "other-user",
        calendar_id: testCalendarId,
        title: "Event",
        timezone: "UTC",
        start_time: new Date(),
        end_time: new Date(),
        is_all_day: false,
        visibility: "public",
        status: "confirmed",
        created_at: new Date(),
        updated_at: new Date(),
      };

      vi.spyOn(pool, "query").mockResolvedValue({ rows: [mockEvent] } as any);

      await expect(
        service.deleteEvent("event-123", testUserId),
      ).rejects.toThrow("Only event owner can delete");
    });
  });

  describe("listEvents", () => {
    it("should list events for user", async () => {
      const mockEvents = [
        {
          id: "event-1",
          title: "Event 1",
          start_time: new Date("2024-01-15T10:00:00Z"),
          end_time: new Date("2024-01-15T11:00:00Z"),
          timezone: "UTC",
          is_all_day: false,
          owner_id: testUserId,
          calendar_id: testCalendarId,
          visibility: "public",
          status: "confirmed",
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: "event-2",
          title: "Event 2",
          start_time: new Date("2024-01-16T14:00:00Z"),
          end_time: new Date("2024-01-16T15:00:00Z"),
          timezone: "UTC",
          is_all_day: false,
          owner_id: testUserId,
          calendar_id: testCalendarId,
          visibility: "public",
          status: "confirmed",
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      vi.spyOn(pool, "query").mockResolvedValue({ rows: mockEvents } as any);

      const result = await service.listEvents(testUserId);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe("Event 1");
      expect(result[1].title).toBe("Event 2");
    });

    it("should filter by date range", async () => {
      vi.spyOn(pool, "query").mockResolvedValue({ rows: [] } as any);

      const startDate = new Date("2024-01-15T00:00:00Z");
      const endDate = new Date("2024-01-31T23:59:59Z");

      await service.listEvents(testUserId, { startDate, endDate });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("e.end_time >="),
        expect.arrayContaining([startDate, endDate, testUserId]),
      );
    });
  });

  describe("getEventOccurrences", () => {
    it("should return single occurrence for non-recurring event", async () => {
      const mockEvent = {
        id: "event-123",
        title: "One-time Meeting",
        start_time: new Date("2024-01-15T10:00:00Z"),
        end_time: new Date("2024-01-15T11:00:00Z"),
        timezone: "UTC",
        is_all_day: false,
        owner_id: testUserId,
        calendar_id: testCalendarId,
        visibility: "public",
        status: "confirmed",
        recurrence_rule: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      vi.spyOn(pool, "query").mockResolvedValue({ rows: [mockEvent] } as any);

      const startDate = new Date("2024-01-01T00:00:00Z");
      const endDate = new Date("2024-01-31T23:59:59Z");

      const occurrences = await service.getEventOccurrences(
        "event-123",
        testUserId,
        startDate,
        endDate,
      );

      expect(occurrences).toHaveLength(1);
      expect(occurrences[0].originalEvent.id).toBe("event-123");
    });

    it("should expand recurring event occurrences", async () => {
      const mockEvent = {
        id: "event-123",
        title: "Daily Standup",
        start_time: new Date("2024-01-15T09:00:00Z"),
        end_time: new Date("2024-01-15T09:15:00Z"),
        timezone: "UTC",
        is_all_day: false,
        owner_id: testUserId,
        calendar_id: testCalendarId,
        visibility: "public",
        status: "confirmed",
        recurrence_rule: "FREQ=DAILY;COUNT=5",
        created_at: new Date(),
        updated_at: new Date(),
      };

      vi.spyOn(pool, "query").mockResolvedValue({ rows: [mockEvent] } as any);

      const startDate = new Date("2024-01-15T00:00:00Z");
      const endDate = new Date("2024-01-20T23:59:59Z");

      const occurrences = await service.getEventOccurrences(
        "event-123",
        testUserId,
        startDate,
        endDate,
      );

      expect(occurrences.length).toBeGreaterThan(1);
      expect(occurrences[0].originalEvent.recurrenceRule).toBe(
        "FREQ=DAILY;COUNT=5",
      );
    });
  });
});
