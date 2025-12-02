/**
 * Add account lockout fields to users table
 * Issue #32: Account lockout after failed attempts
 */

import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Add lockout fields to users table
  pgm.addColumns("users", {
    failed_login_attempts: {
      type: "integer",
      notNull: true,
      default: 0,
    },
    locked_until: {
      type: "timestamptz",
      notNull: false,
    },
    last_failed_login_at: {
      type: "timestamptz",
      notNull: false,
    },
  });

  // Create index for locked accounts query
  pgm.createIndex("users", "locked_until");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex("users", "locked_until");
  pgm.dropColumns("users", [
    "failed_login_attempts",
    "locked_until",
    "last_failed_login_at",
  ]);
}
