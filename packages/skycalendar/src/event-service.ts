/**
 * Calendar Event Service
 * Core CRUD operations for calendar events with recurring event support
 */

import { Pool } from "pg";
import { RRule } from "rrule";
import { DateTime } from "luxon";
import type {
  CalendarEvent,
  CreateEventRequest,
  UpdateEventRequest,
  ListEventsOptions,
  EventOccurrence,
  EventVisibility,
  EventStatus,
  AttendeeRole,
  ReminderMethod,
} from "./types.js";

export class EventService {
  constructor(private pool: Pool) {}

  /**
   * Create a new calendar event
   */
  async createEvent(
    userId: string,
    calendarId: string,
    request: CreateEventRequest,
  ): Promise<CalendarEvent> {
    // Validate calendar ownership or permissions
    await this.validateCalendarAccess(userId, calendarId, "edit");

    // Parse dates and timezone
    const timezone = request.timezone || "UTC";
    const startTime = this.parseDateTime(request.startTime, timezone);
    const endTime = this.parseDateTime(request.endTime, timezone);

    // Validate recurrence rule if provided
    if (request.recurrenceRule) {
      this.validateRecurrenceRule(request.recurrenceRule);
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Insert event
      const eventResult = await client.query<CalendarEvent>(
        `INSERT INTO events (
          title, description, location, start_time, end_time, timezone,
          is_all_day, owner_id, calendar_id, visibility, status,
          recurrence_rule, meeting_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          request.title,
          request.description || null,
          request.location || null,
          startTime,
          endTime,
          timezone,
          request.isAllDay || false,
          userId,
          calendarId,
          request.visibility || "public",
          request.status || "confirmed",
          request.recurrenceRule || null,
          request.meetingUrl || null,
        ],
      );

      const event = eventResult.rows[0];

      // Add attendees if provided
      if (request.attendees && request.attendees.length > 0) {
        for (const attendee of request.attendees) {
          await client.query(
            `INSERT INTO event_attendees (event_id, user_id, email, display_name, role)
             SELECT $1, u.id, $2, u.display_name, $3
             FROM users u
             WHERE u.email = $2`,
            [event.id, attendee.email, attendee.role || "required"],
          );
        }
      }

      // Add reminders if provided
      if (request.reminders && request.reminders.length > 0) {
        for (const reminder of request.reminders) {
          await client.query(
            `INSERT INTO event_reminders (event_id, method, minutes_before)
             VALUES ($1, $2, $3)`,
            [event.id, reminder.method, reminder.minutesBefore],
          );
        }
      }

      await client.query("COMMIT");
      return this.mapEventRow(event);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a single event by ID
   */
  async getEvent(eventId: string, userId: string): Promise<CalendarEvent> {
    const result = await this.pool.query<CalendarEvent>(
      `SELECT e.* FROM events e
       WHERE e.id = $1
         AND e.deleted_at IS NULL
         AND (
           e.owner_id = $2
           OR EXISTS (
             SELECT 1 FROM calendar_shares cs
             WHERE cs.calendar_id = e.calendar_id
               AND cs.shared_with = $2
               AND cs.permission IN ('view', 'edit', 'owner')
           )
         )`,
      [eventId, userId],
    );

    if (result.rows.length === 0) {
      throw new Error("Event not found or access denied");
    }

    return this.mapEventRow(result.rows[0]);
  }

  /**
   * Update an existing event
   */
  async updateEvent(
    eventId: string,
    userId: string,
    request: UpdateEventRequest,
  ): Promise<CalendarEvent> {
    const event = await this.getEvent(eventId, userId);

    // Check edit permission
    if (event.ownerId !== userId) {
      await this.validateCalendarAccess(
        userId,
        event.calendarId as string,
        "edit",
      );
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (request.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(request.title);
    }
    if (request.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(request.description);
    }
    if (request.location !== undefined) {
      updates.push(`location = $${paramIndex++}`);
      values.push(request.location);
    }
    if (request.startTime !== undefined) {
      const timezone = request.timezone || event.timezone;
      updates.push(`start_time = $${paramIndex++}`);
      values.push(this.parseDateTime(request.startTime, timezone));
    }
    if (request.endTime !== undefined) {
      const timezone = request.timezone || event.timezone;
      updates.push(`end_time = $${paramIndex++}`);
      values.push(this.parseDateTime(request.endTime, timezone));
    }
    if (request.timezone !== undefined) {
      updates.push(`timezone = $${paramIndex++}`);
      values.push(request.timezone);
    }
    if (request.isAllDay !== undefined) {
      updates.push(`is_all_day = $${paramIndex++}`);
      values.push(request.isAllDay);
    }
    if (request.visibility !== undefined) {
      updates.push(`visibility = $${paramIndex++}`);
      values.push(request.visibility);
    }
    if (request.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(request.status);
    }
    if (request.recurrenceRule !== undefined) {
      if (request.recurrenceRule) {
        this.validateRecurrenceRule(request.recurrenceRule);
      }
      updates.push(`recurrence_rule = $${paramIndex++}`);
      values.push(request.recurrenceRule);
    }

    if (updates.length === 0) {
      return event;
    }

    values.push(eventId);
    const result = await this.pool.query<CalendarEvent>(
      `UPDATE events SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING *`,
      values,
    );

    return this.mapEventRow(result.rows[0]);
  }

  /**
   * Delete an event (soft delete)
   */
  async deleteEvent(eventId: string, userId: string): Promise<void> {
    const event = await this.getEvent(eventId, userId);

    // Only owner can delete
    if (event.ownerId !== userId) {
      throw new Error("Only event owner can delete");
    }

    await this.pool.query(
      `UPDATE events SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [eventId],
    );
  }

  /**
   * List events for a user with optional filters
   */
  async listEvents(
    userId: string,
    options: ListEventsOptions = {},
  ): Promise<CalendarEvent[]> {
    const conditions: string[] = ["e.deleted_at IS NULL"];
    const values: any[] = [];
    let paramIndex = 1;

    // Calendar filter
    if (options.calendarId) {
      conditions.push(`e.calendar_id = $${paramIndex++}`);
      values.push(options.calendarId);
    }

    // Date range filter
    if (options.startDate) {
      conditions.push(`e.end_time >= $${paramIndex++}`);
      values.push(options.startDate);
    }
    if (options.endDate) {
      conditions.push(`e.start_time <= $${paramIndex++}`);
      values.push(options.endDate);
    }

    // Access control
    conditions.push(`(
      e.owner_id = $${paramIndex}
      OR EXISTS (
        SELECT 1 FROM calendar_shares cs
        WHERE cs.calendar_id = e.calendar_id
          AND cs.shared_with = $${paramIndex}
          AND cs.permission IN ('view', 'edit', 'owner')
      )
    )`);
    values.push(userId);
    paramIndex++;

    const limit = options.maxResults || 100;
    const result = await this.pool.query<CalendarEvent>(
      `SELECT e.* FROM events e
       WHERE ${conditions.join(" AND ")}
       ORDER BY e.start_time ASC
       LIMIT ${limit}`,
      values,
    );

    return result.rows.map((row) => this.mapEventRow(row));
  }

  /**
   * Expand recurring events into occurrences
   */
  async getEventOccurrences(
    eventId: string,
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<EventOccurrence[]> {
    const event = await this.getEvent(eventId, userId);

    if (!event.recurrenceRule) {
      // Not a recurring event, return single occurrence
      return [
        {
          originalEvent: event,
          occurrenceStart: event.startTime,
          occurrenceEnd: event.endTime,
        },
      ];
    }

    // Parse RRule and generate occurrences
    const rrule = RRule.fromString(event.recurrenceRule);
    const occurrences = rrule.between(startDate, endDate, true);

    const eventDuration = event.endTime.getTime() - event.startTime.getTime();

    return occurrences.map((occurrenceStart) => ({
      originalEvent: event,
      occurrenceStart,
      occurrenceEnd: new Date(occurrenceStart.getTime() + eventDuration),
    }));
  }

  // Helper methods

  private async validateCalendarAccess(
    userId: string,
    calendarId: string,
    requiredPermission: "view" | "edit",
  ): Promise<void> {
    const result = await this.pool.query(
      `SELECT c.owner_id, cs.permission
       FROM calendars c
       LEFT JOIN calendar_shares cs ON cs.calendar_id = c.id AND cs.shared_with = $1
       WHERE c.id = $2 AND c.deleted_at IS NULL`,
      [userId, calendarId],
    );

    if (result.rows.length === 0) {
      throw new Error("Calendar not found");
    }

    const { owner_id, permission } = result.rows[0];

    // Owner has all permissions
    if (owner_id === userId) {
      return;
    }

    // Check shared permission
    if (!permission) {
      throw new Error("Access denied");
    }

    if (
      requiredPermission === "edit" &&
      !["edit", "owner"].includes(permission)
    ) {
      throw new Error("Edit permission required");
    }
  }

  private parseDateTime(dateInput: Date | string, timezone: string): Date {
    if (dateInput instanceof Date) {
      return dateInput;
    }

    const dt = DateTime.fromISO(dateInput as string, { zone: timezone });
    if (!dt.isValid) {
      throw new Error(`Invalid date: ${dateInput}`);
    }

    return dt.toJSDate();
  }

  private validateRecurrenceRule(rruleString: string): void {
    try {
      RRule.fromString(rruleString);
    } catch (error) {
      throw new Error(`Invalid recurrence rule: ${rruleString}`);
    }
  }

  private mapEventRow(row: any): CalendarEvent {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      location: row.location,
      startTime: row.start_time,
      endTime: row.end_time,
      timezone: row.timezone,
      isAllDay: row.is_all_day,
      ownerId: row.owner_id,
      calendarId: row.calendar_id,
      visibility: row.visibility as EventVisibility,
      status: row.status as EventStatus,
      recurrenceRule: row.recurrence_rule,
      recurrenceId: row.recurrence_id,
      meetingUrl: row.meeting_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    };
  }
}
