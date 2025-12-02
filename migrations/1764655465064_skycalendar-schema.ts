/**
 * SkyCalendar Database Schema
 *
 * Tables:
 * - calendars: User calendars with timezone and color settings
 * - calendar_shares: Calendar sharing permissions
 * - events: Calendar events with timezone support
 * - event_attendees: Event attendees with RSVP status
 * - event_reminders: Event reminder notifications
 *
 * Features:
 * - Multi-calendar support per user
 * - Recurring events (RFC 5545 RRule)
 * - Timezone-aware event storage
 * - Attendee management with RSVP
 * - Reminders (email, push, popup)
 * - Calendar sharing with granular permissions
 * - Soft delete for trash recovery
 * - SkyMeet integration (meeting URLs)
 */

import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Calendars table - user calendars
  pgm.createTable("calendars", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    name: {
      type: "varchar(100)",
      notNull: true,
    },
    description: {
      type: "text",
      notNull: false,
    },
    owner_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    color: {
      type: "varchar(7)",
      notNull: true,
      default: "'#1976d2'",
      comment: "Hex color code for calendar display",
    },
    is_default: {
      type: "boolean",
      notNull: true,
      default: false,
      comment: "Default calendar for new events",
    },
    timezone: {
      type: "varchar(50)",
      notNull: true,
      default: "'UTC'",
      comment: "IANA timezone (e.g., America/New_York)",
    },
    deleted_at: {
      type: "timestamptz",
      notNull: false,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("calendars", "owner_id");
  pgm.createIndex("calendars", "deleted_at");
  pgm.createIndex("calendars", ["owner_id", "is_default"]);

  // Calendar shares table
  pgm.createTable("calendar_shares", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    calendar_id: {
      type: "uuid",
      notNull: true,
      references: "calendars(id)",
      onDelete: "CASCADE",
    },
    shared_by: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    shared_with: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    permission: {
      type: "varchar(20)",
      notNull: true,
      check: "permission IN ('view_freebusy', 'view', 'edit', 'owner')",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("calendar_shares", "calendar_id");
  pgm.createIndex("calendar_shares", "shared_with");
  pgm.createIndex("calendar_shares", ["calendar_id", "shared_with"], {
    unique: true,
  });

  // Events table - calendar events
  pgm.createTable("events", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    title: {
      type: "varchar(255)",
      notNull: true,
    },
    description: {
      type: "text",
      notNull: false,
    },
    location: {
      type: "varchar(255)",
      notNull: false,
    },
    start_time: {
      type: "timestamptz",
      notNull: true,
      comment: "Event start time (stored in UTC, displayed in timezone)",
    },
    end_time: {
      type: "timestamptz",
      notNull: true,
      comment: "Event end time (stored in UTC, displayed in timezone)",
    },
    timezone: {
      type: "varchar(50)",
      notNull: true,
      default: "'UTC'",
      comment: "Event timezone for display",
    },
    is_all_day: {
      type: "boolean",
      notNull: true,
      default: false,
    },
    owner_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    calendar_id: {
      type: "uuid",
      notNull: true,
      references: "calendars(id)",
      onDelete: "CASCADE",
    },
    visibility: {
      type: "varchar(20)",
      notNull: true,
      default: "'public'",
      check: "visibility IN ('public', 'private', 'confidential')",
    },
    status: {
      type: "varchar(20)",
      notNull: true,
      default: "'confirmed'",
      check: "status IN ('confirmed', 'tentative', 'cancelled')",
    },
    recurrence_rule: {
      type: "text",
      notNull: false,
      comment: "RFC 5545 RRule string for recurring events",
    },
    recurrence_id: {
      type: "uuid",
      notNull: false,
      references: "events(id)",
      onDelete: "CASCADE",
      comment: "Parent event ID for recurring event instances",
    },
    meeting_url: {
      type: "text",
      notNull: false,
      comment: "SkyMeet meeting URL integration",
    },
    deleted_at: {
      type: "timestamptz",
      notNull: false,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("events", "owner_id");
  pgm.createIndex("events", "calendar_id");
  pgm.createIndex("events", "start_time");
  pgm.createIndex("events", "end_time");
  pgm.createIndex("events", ["start_time", "end_time"]);
  pgm.createIndex("events", "recurrence_id");
  pgm.createIndex("events", "deleted_at");

  // Event attendees table
  pgm.createTable("event_attendees", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    event_id: {
      type: "uuid",
      notNull: true,
      references: "events(id)",
      onDelete: "CASCADE",
    },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    email: {
      type: "citext",
      notNull: true,
    },
    display_name: {
      type: "varchar(200)",
      notNull: true,
    },
    role: {
      type: "varchar(20)",
      notNull: true,
      default: "'required'",
      check: "role IN ('required', 'optional', 'chair', 'non_participant')",
    },
    status: {
      type: "varchar(20)",
      notNull: true,
      default: "'needs_action'",
      check: "status IN ('accepted', 'declined', 'tentative', 'needs_action')",
    },
    comment: {
      type: "text",
      notNull: false,
      comment: "Optional RSVP comment",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("event_attendees", "event_id");
  pgm.createIndex("event_attendees", "user_id");
  pgm.createIndex("event_attendees", ["event_id", "user_id"], {
    unique: true,
  });
  pgm.createIndex("event_attendees", "status");

  // Event reminders table
  pgm.createTable("event_reminders", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    event_id: {
      type: "uuid",
      notNull: true,
      references: "events(id)",
      onDelete: "CASCADE",
    },
    method: {
      type: "varchar(20)",
      notNull: true,
      check: "method IN ('email', 'notification', 'popup')",
    },
    minutes_before: {
      type: "integer",
      notNull: true,
      comment: "Minutes before event start to send reminder",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("event_reminders", "event_id");
  pgm.createIndex("event_reminders", ["event_id", "method", "minutes_before"], {
    unique: true,
  });

  // Apply updated_at trigger to tables
  const tablesWithUpdatedAt = ["calendars", "events", "event_attendees"];

  for (const table of tablesWithUpdatedAt) {
    pgm.createTrigger(table, `update_${table}_updated_at`, {
      when: "BEFORE",
      operation: "UPDATE",
      function: "update_updated_at_column",
      level: "ROW",
    });
  }
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop triggers
  const tablesWithUpdatedAt = ["calendars", "events", "event_attendees"];
  for (const table of tablesWithUpdatedAt) {
    pgm.dropTrigger(table, `update_${table}_updated_at`, { ifExists: true });
  }

  // Drop tables (in reverse order of dependencies)
  pgm.dropTable("event_reminders", { ifExists: true });
  pgm.dropTable("event_attendees", { ifExists: true });
  pgm.dropTable("events", { ifExists: true });
  pgm.dropTable("calendar_shares", { ifExists: true });
  pgm.dropTable("calendars", { ifExists: true });
}
