/**
 * SkyDrive Starred Items Table
 * For tracking user favorites/starred files and folders
 */

import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("starred_items", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    item_id: {
      type: "uuid",
      notNull: true,
      comment: "ID of the file or folder",
    },
    item_type: {
      type: "varchar(10)",
      notNull: true,
      check: "item_type IN ('file', 'folder')",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("starred_items", "user_id");
  pgm.createIndex("starred_items", ["user_id", "item_id", "item_type"], {
    unique: true,
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("starred_items", { ifExists: true });
}
