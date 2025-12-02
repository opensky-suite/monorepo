/**
 * SkyChat Database Schema
 *
 * Tables:
 * - channels: Chat channels (public, private, DMs, group DMs)
 * - channel_members: Channel membership and roles
 * - messages: Chat messages with threading support
 * - message_attachments: File attachments on messages
 * - reactions: Message reactions (emoji)
 * - mentions: @mentions tracking
 * - presence_status: User online/offline status
 * - webhooks: Integration webhooks
 *
 * Features:
 * - Slack-style threading
 * - Real-time messaging foundation
 * - Unread tracking
 * - Message reactions
 * - User presence
 * - File attachments
 * - Webhooks for integrations
 */

import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Channels table
  pgm.createTable("channels", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    name: {
      type: "varchar(80)",
      notNull: true,
    },
    description: {
      type: "text",
      notNull: false,
    },
    type: {
      type: "varchar(20)",
      notNull: true,
      check: "type IN ('public', 'private', 'direct', 'group')",
    },
    organization_id: {
      type: "uuid",
      notNull: false,
      references: "organizations(id)",
      onDelete: "CASCADE",
      comment: "NULL for personal/DM channels",
    },
    created_by: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "RESTRICT",
    },
    is_archived: {
      type: "boolean",
      notNull: true,
      default: false,
    },
    is_general: {
      type: "boolean",
      notNull: true,
      default: false,
      comment: "Default channel for organization",
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

  pgm.createIndex("channels", "organization_id");
  pgm.createIndex("channels", "type");
  pgm.createIndex("channels", "created_by");
  pgm.createIndex("channels", "is_archived");
  pgm.createIndex("channels", ["organization_id", "name"], {
    unique: true,
    where: "organization_id IS NOT NULL AND is_archived = FALSE",
  });

  // Channel members table
  pgm.createTable("channel_members", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    channel_id: {
      type: "uuid",
      notNull: true,
      references: "channels(id)",
      onDelete: "CASCADE",
    },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    role: {
      type: "varchar(20)",
      notNull: true,
      default: "'member'",
      check: "role IN ('member', 'admin', 'owner')",
    },
    last_read_at: {
      type: "timestamptz",
      notNull: false,
      comment: "Last message read timestamp for unread tracking",
    },
    notification_level: {
      type: "varchar(20)",
      notNull: true,
      default: "'all'",
      check: "notification_level IN ('all', 'mentions', 'none')",
    },
    joined_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("channel_members", "channel_id");
  pgm.createIndex("channel_members", "user_id");
  pgm.createIndex("channel_members", ["channel_id", "user_id"], {
    unique: true,
  });

  // Messages table
  pgm.createTable("messages", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    channel_id: {
      type: "uuid",
      notNull: true,
      references: "channels(id)",
      onDelete: "CASCADE",
    },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    content: {
      type: "text",
      notNull: true,
    },
    thread_id: {
      type: "uuid",
      notNull: false,
      references: "messages(id)",
      onDelete: "CASCADE",
      comment: "Parent message for threaded replies",
    },
    reply_count: {
      type: "integer",
      notNull: true,
      default: 0,
      comment: "Number of thread replies",
    },
    last_reply_at: {
      type: "timestamptz",
      notNull: false,
      comment: "Timestamp of last thread reply",
    },
    is_pinned: {
      type: "boolean",
      notNull: true,
      default: false,
    },
    is_edited: {
      type: "boolean",
      notNull: true,
      default: false,
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

  pgm.createIndex("messages", "channel_id");
  pgm.createIndex("messages", "user_id");
  pgm.createIndex("messages", "thread_id");
  pgm.createIndex("messages", "created_at");
  pgm.createIndex("messages", "deleted_at");
  pgm.createIndex("messages", ["channel_id", "created_at"]);

  // Full-text search on message content
  pgm.addIndex("messages", ["content"], {
    name: "messages_content_search_idx",
    method: "gin",
    opclass: { content: "gin_trgm_ops" },
  });

  // Message attachments table
  pgm.createTable("message_attachments", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    message_id: {
      type: "uuid",
      notNull: true,
      references: "messages(id)",
      onDelete: "CASCADE",
    },
    file_id: {
      type: "uuid",
      notNull: true,
      references: "files(id)",
      onDelete: "RESTRICT",
      comment: "SkyDrive file integration",
    },
    file_name: {
      type: "varchar(255)",
      notNull: true,
    },
    file_size: {
      type: "bigint",
      notNull: true,
    },
    mime_type: {
      type: "varchar(255)",
      notNull: true,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("message_attachments", "message_id");
  pgm.createIndex("message_attachments", "file_id");

  // Reactions table
  pgm.createTable("reactions", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    message_id: {
      type: "uuid",
      notNull: true,
      references: "messages(id)",
      onDelete: "CASCADE",
    },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    emoji: {
      type: "varchar(50)",
      notNull: true,
      comment: "Emoji shortcode or unicode",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("reactions", "message_id");
  pgm.createIndex("reactions", ["message_id", "user_id", "emoji"], {
    unique: true,
  });

  // Mentions table
  pgm.createTable("mentions", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    message_id: {
      type: "uuid",
      notNull: true,
      references: "messages(id)",
      onDelete: "CASCADE",
    },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
      comment: "Who was mentioned",
    },
    mentioned_by: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
      comment: "Who mentioned them",
    },
    is_read: {
      type: "boolean",
      notNull: true,
      default: false,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("mentions", "message_id");
  pgm.createIndex("mentions", "user_id");
  pgm.createIndex("mentions", ["user_id", "is_read"]);

  // Presence status table
  pgm.createTable("presence_status", {
    user_id: {
      type: "uuid",
      primaryKey: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    status: {
      type: "varchar(20)",
      notNull: true,
      default: "'offline'",
      check: "status IN ('online', 'away', 'dnd', 'offline')",
    },
    status_text: {
      type: "varchar(100)",
      notNull: false,
      comment: "Custom status message",
    },
    last_active_at: {
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

  pgm.createIndex("presence_status", "status");
  pgm.createIndex("presence_status", "last_active_at");

  // Webhooks table
  pgm.createTable("webhooks", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    channel_id: {
      type: "uuid",
      notNull: true,
      references: "channels(id)",
      onDelete: "CASCADE",
    },
    name: {
      type: "varchar(100)",
      notNull: true,
    },
    url: {
      type: "text",
      notNull: true,
    },
    secret: {
      type: "text",
      notNull: true,
      comment: "HMAC secret for signing",
    },
    events: {
      type: "text[]",
      notNull: true,
      default: "{}",
      comment: "Which events to trigger on",
    },
    is_active: {
      type: "boolean",
      notNull: true,
      default: true,
    },
    created_by: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("webhooks", "channel_id");
  pgm.createIndex("webhooks", "is_active");

  // Apply updated_at trigger
  const tablesWithUpdatedAt = ["channels", "messages", "presence_status"];

  for (const table of tablesWithUpdatedAt) {
    pgm.createTrigger(table, `update_${table}_updated_at`, {
      when: "BEFORE",
      operation: "UPDATE",
      function: "update_updated_at_column",
      level: "ROW",
    });
  }

  // Function to update reply count on thread messages
  pgm.createFunction(
    "update_thread_reply_count",
    [],
    {
      returns: "trigger",
      language: "plpgsql",
      replace: true,
    },
    `
    BEGIN
      IF NEW.thread_id IS NOT NULL THEN
        UPDATE messages
        SET reply_count = reply_count + 1,
            last_reply_at = NEW.created_at
        WHERE id = NEW.thread_id;
      END IF;
      RETURN NEW;
    END;
    `,
  );

  pgm.createTrigger("messages", "increment_thread_reply_count", {
    when: "AFTER",
    operation: "INSERT",
    function: "update_thread_reply_count",
    level: "ROW",
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop triggers
  pgm.dropTrigger("messages", "increment_thread_reply_count", {
    ifExists: true,
  });

  const tablesWithUpdatedAt = ["channels", "messages", "presence_status"];
  for (const table of tablesWithUpdatedAt) {
    pgm.dropTrigger(table, `update_${table}_updated_at`, { ifExists: true });
  }

  // Drop functions
  pgm.dropFunction("update_thread_reply_count", [], { ifExists: true });

  // Drop tables
  pgm.dropTable("webhooks", { ifExists: true });
  pgm.dropTable("presence_status", { ifExists: true });
  pgm.dropTable("mentions", { ifExists: true });
  pgm.dropTable("reactions", { ifExists: true });
  pgm.dropTable("message_attachments", { ifExists: true });
  pgm.dropTable("messages", { ifExists: true });
  pgm.dropTable("channel_members", { ifExists: true });
  pgm.dropTable("channels", { ifExists: true });
}
