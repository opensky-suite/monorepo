/**
 * Create audit_logs table for security event tracking
 * Issue #33: Security audit logs
 */

import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Audit logs table
  pgm.createTable("audit_logs", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    user_id: {
      type: "uuid",
      notNull: false, // Nullable for failed login attempts
      references: "users(id)",
      onDelete: "SET NULL",
    },
    event_type: {
      type: "varchar(50)",
      notNull: true,
    },
    event_category: {
      type: "varchar(20)",
      notNull: true,
    },
    status: {
      type: "varchar(20)",
      notNull: true,
    },
    ip_address: {
      type: "inet",
      notNull: false,
    },
    user_agent: {
      type: "text",
      notNull: false,
    },
    metadata: {
      type: "jsonb",
      notNull: false,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  // Indexes for common queries
  pgm.createIndex("audit_logs", "user_id");
  pgm.createIndex("audit_logs", "event_type");
  pgm.createIndex("audit_logs", "event_category");
  pgm.createIndex("audit_logs", "created_at");
  pgm.createIndex("audit_logs", ["user_id", "created_at"]);
  pgm.createIndex("audit_logs", "metadata", { method: "gin" });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("audit_logs");
}
