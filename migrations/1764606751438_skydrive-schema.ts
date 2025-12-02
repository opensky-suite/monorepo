/**
 * SkyDrive Database Schema
 *
 * Tables:
 * - folders: Folder hierarchy with materialized paths
 * - files: File metadata with versioning support
 * - file_versions: Historical versions of files
 * - file_shares: File sharing permissions
 * - folder_shares: Folder sharing permissions
 *
 * Features:
 * - Materialized path for folder hierarchy
 * - Soft delete with trash recovery
 * - Version control for files
 * - Granular sharing permissions
 * - Storage quota tracking
 */

import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Folders table - hierarchical structure with materialized paths
  pgm.createTable("folders", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    name: {
      type: "varchar(255)",
      notNull: true,
    },
    owner_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    parent_id: {
      type: "uuid",
      notNull: false,
      references: "folders(id)",
      onDelete: "CASCADE",
    },
    path: {
      type: "text",
      notNull: true,
      comment:
        "Materialized path for efficient hierarchy queries (e.g., /root/subfolder/)",
    },
    deleted_at: {
      type: "timestamptz",
      notNull: false,
      comment: "Soft delete timestamp for trash/recovery",
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

  pgm.createIndex("folders", "owner_id");
  pgm.createIndex("folders", "parent_id");
  pgm.createIndex("folders", "path");
  pgm.createIndex("folders", "deleted_at");
  pgm.createIndex("folders", ["owner_id", "parent_id", "name"], {
    unique: true,
    where: "deleted_at IS NULL",
    name: "unique_folder_name_per_parent",
  });

  // Files table - file metadata with versioning
  pgm.createTable("files", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    name: {
      type: "varchar(255)",
      notNull: true,
    },
    mime_type: {
      type: "varchar(255)",
      notNull: true,
    },
    size: {
      type: "bigint",
      notNull: true,
      comment: "File size in bytes",
    },
    owner_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    folder_id: {
      type: "uuid",
      notNull: false,
      references: "folders(id)",
      onDelete: "CASCADE",
      comment: "NULL for root-level files",
    },
    path: {
      type: "text",
      notNull: true,
      comment: "Full path including filename (e.g., /folder/document.pdf)",
    },
    storage_key: {
      type: "text",
      notNull: true,
      comment: "Key/path in storage backend (S3, MinIO, local)",
    },
    version: {
      type: "integer",
      notNull: true,
      default: 1,
      comment: "Current version number",
    },
    checksum: {
      type: "varchar(64)",
      notNull: true,
      comment: "SHA-256 checksum for integrity verification",
    },
    deleted_at: {
      type: "timestamptz",
      notNull: false,
      comment: "Soft delete timestamp for trash/recovery",
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

  pgm.createIndex("files", "owner_id");
  pgm.createIndex("files", "folder_id");
  pgm.createIndex("files", "path");
  pgm.createIndex("files", "checksum");
  pgm.createIndex("files", "deleted_at");
  pgm.createIndex("files", "mime_type");
  pgm.createIndex("files", ["owner_id", "folder_id", "name"], {
    unique: true,
    where: "deleted_at IS NULL",
    name: "unique_file_name_per_folder",
  });

  // File versions table - version history
  pgm.createTable("file_versions", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    file_id: {
      type: "uuid",
      notNull: true,
      references: "files(id)",
      onDelete: "CASCADE",
    },
    version: {
      type: "integer",
      notNull: true,
    },
    size: {
      type: "bigint",
      notNull: true,
    },
    storage_key: {
      type: "text",
      notNull: true,
    },
    checksum: {
      type: "varchar(64)",
      notNull: true,
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

  pgm.createIndex("file_versions", "file_id");
  pgm.createIndex("file_versions", ["file_id", "version"], {
    unique: true,
  });
  pgm.createIndex("file_versions", "created_at");

  // File shares table - file-level sharing permissions
  pgm.createTable("file_shares", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    file_id: {
      type: "uuid",
      notNull: true,
      references: "files(id)",
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
      notNull: false,
      references: "users(id)",
      onDelete: "CASCADE",
      comment: "NULL for public shares",
    },
    permission: {
      type: "varchar(20)",
      notNull: true,
      check: "permission IN ('view', 'comment', 'edit')",
    },
    expires_at: {
      type: "timestamptz",
      notNull: false,
      comment: "NULL for permanent shares",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("file_shares", "file_id");
  pgm.createIndex("file_shares", "shared_with");
  pgm.createIndex("file_shares", "expires_at");
  pgm.createIndex("file_shares", ["file_id", "shared_with"], {
    unique: true,
    where: "shared_with IS NOT NULL",
    name: "unique_file_share_per_user",
  });

  // Folder shares table - folder-level sharing permissions (inherited by children)
  pgm.createTable("folder_shares", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    folder_id: {
      type: "uuid",
      notNull: true,
      references: "folders(id)",
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
      notNull: false,
      references: "users(id)",
      onDelete: "CASCADE",
      comment: "NULL for public shares",
    },
    permission: {
      type: "varchar(20)",
      notNull: true,
      check: "permission IN ('view', 'comment', 'edit')",
    },
    expires_at: {
      type: "timestamptz",
      notNull: false,
      comment: "NULL for permanent shares",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("folder_shares", "folder_id");
  pgm.createIndex("folder_shares", "shared_with");
  pgm.createIndex("folder_shares", "expires_at");
  pgm.createIndex("folder_shares", ["folder_id", "shared_with"], {
    unique: true,
    where: "shared_with IS NOT NULL",
    name: "unique_folder_share_per_user",
  });

  // Storage quota tracking table
  pgm.createTable("storage_quotas", {
    user_id: {
      type: "uuid",
      primaryKey: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    quota_bytes: {
      type: "bigint",
      notNull: true,
      default: 15000000000, // 15 GB default
      comment: "Total storage quota in bytes",
    },
    used_bytes: {
      type: "bigint",
      notNull: true,
      default: 0,
      comment: "Currently used storage in bytes",
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("storage_quotas", "used_bytes");

  // Apply updated_at trigger to tables
  const tablesWithUpdatedAt = ["folders", "files", "storage_quotas"];

  for (const table of tablesWithUpdatedAt) {
    pgm.createTrigger(table, `update_${table}_updated_at`, {
      when: "BEFORE",
      operation: "UPDATE",
      function: "update_updated_at_column",
      level: "ROW",
    });
  }

  // Create function to update storage quota on file changes
  pgm.createFunction(
    "update_storage_quota",
    [],
    {
      returns: "trigger",
      language: "plpgsql",
      replace: true,
    },
    `
    DECLARE
      size_delta bigint;
    BEGIN
      -- Calculate size change
      IF TG_OP = 'INSERT' THEN
        size_delta := NEW.size;
      ELSIF TG_OP = 'UPDATE' THEN
        size_delta := NEW.size - OLD.size;
      ELSIF TG_OP = 'DELETE' THEN
        size_delta := -OLD.size;
      END IF;

      -- Update user quota
      INSERT INTO storage_quotas (user_id, used_bytes)
      VALUES (
        COALESCE(NEW.owner_id, OLD.owner_id),
        size_delta
      )
      ON CONFLICT (user_id) DO UPDATE
      SET used_bytes = storage_quotas.used_bytes + size_delta,
          updated_at = current_timestamp;

      RETURN NEW;
    END;
    `,
  );

  // Trigger to update storage quota on file insert/update/delete
  pgm.createTrigger("files", "update_storage_quota_trigger", {
    when: "AFTER",
    operation: ["INSERT", "UPDATE", "DELETE"],
    function: "update_storage_quota",
    level: "ROW",
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop triggers
  pgm.dropTrigger("files", "update_storage_quota_trigger", { ifExists: true });

  const tablesWithUpdatedAt = ["folders", "files", "storage_quotas"];
  for (const table of tablesWithUpdatedAt) {
    pgm.dropTrigger(table, `update_${table}_updated_at`, { ifExists: true });
  }

  // Drop functions
  pgm.dropFunction("update_storage_quota", [], { ifExists: true });

  // Drop tables (in reverse order of dependencies)
  pgm.dropTable("storage_quotas", { ifExists: true });
  pgm.dropTable("folder_shares", { ifExists: true });
  pgm.dropTable("file_shares", { ifExists: true });
  pgm.dropTable("file_versions", { ifExists: true });
  pgm.dropTable("files", { ifExists: true });
  pgm.dropTable("folders", { ifExists: true });
}
