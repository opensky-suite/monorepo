/**
 * SkyDocs Database Schema
 *
 * Tables:
 * - documents: Core document metadata and content
 * - document_versions: Version history for documents
 * - document_shares: Document sharing permissions
 * - comments: Document comments and threads
 * - suggestions: Edit suggestions for collaboration
 * - collaboration_sessions: Active editing sessions
 * - document_templates: Reusable document templates
 *
 * Features:
 * - Rich content storage (JSON/JSONB)
 * - Version control with history
 * - Real-time collaboration support
 * - Comment threads with positioning
 * - Edit suggestions (track changes)
 * - Granular sharing permissions
 * - Document templates
 * - Soft delete for trash recovery
 * - Full-text search support
 */

import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Documents table - core document storage
  pgm.createTable("documents", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    title: {
      type: "varchar(255)",
      notNull: true,
    },
    content: {
      type: "jsonb",
      notNull: true,
      default: '\'{"format":"prosemirror","data":{}}\'',
      comment:
        "Document content in structured format (ProseMirror/Markdown/HTML)",
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
      onDelete: "SET NULL",
      comment: "Optional SkyDrive folder integration",
    },
    visibility: {
      type: "varchar(20)",
      notNull: true,
      default: "'private'",
      check: "visibility IN ('private', 'shared', 'public')",
    },
    status: {
      type: "varchar(20)",
      notNull: true,
      default: "'draft'",
      check: "status IN ('draft', 'published', 'archived')",
    },
    version: {
      type: "integer",
      notNull: true,
      default: 1,
      comment: "Current version number",
    },
    last_edited_by: {
      type: "uuid",
      notNull: false,
      references: "users(id)",
      onDelete: "SET NULL",
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

  pgm.createIndex("documents", "owner_id");
  pgm.createIndex("documents", "folder_id");
  pgm.createIndex("documents", "visibility");
  pgm.createIndex("documents", "status");
  pgm.createIndex("documents", "deleted_at");
  pgm.createIndex("documents", "updated_at");

  // GIN index for full-text search on content
  pgm.addIndex("documents", ["content"], {
    name: "documents_content_gin_idx",
    method: "gin",
  });

  // Document versions table - version history
  pgm.createTable("document_versions", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    document_id: {
      type: "uuid",
      notNull: true,
      references: "documents(id)",
      onDelete: "CASCADE",
    },
    version: {
      type: "integer",
      notNull: true,
    },
    title: {
      type: "varchar(255)",
      notNull: true,
    },
    content: {
      type: "jsonb",
      notNull: true,
    },
    change_description: {
      type: "text",
      notNull: false,
      comment: "Optional description of changes",
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

  pgm.createIndex("document_versions", "document_id");
  pgm.createIndex("document_versions", ["document_id", "version"], {
    unique: true,
  });
  pgm.createIndex("document_versions", "created_at");

  // Document shares table
  pgm.createTable("document_shares", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    document_id: {
      type: "uuid",
      notNull: true,
      references: "documents(id)",
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
      check: "permission IN ('view', 'comment', 'edit', 'owner')",
    },
    expires_at: {
      type: "timestamptz",
      notNull: false,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("document_shares", "document_id");
  pgm.createIndex("document_shares", "shared_with");
  pgm.createIndex("document_shares", "expires_at");
  pgm.createIndex("document_shares", ["document_id", "shared_with"], {
    unique: true,
    where: "shared_with IS NOT NULL",
  });

  // Comments table - document comments with threading
  pgm.createTable("comments", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    document_id: {
      type: "uuid",
      notNull: true,
      references: "documents(id)",
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
    position: {
      type: "jsonb",
      notNull: false,
      comment: "Position in document {from, to, version}",
    },
    resolved: {
      type: "boolean",
      notNull: true,
      default: false,
    },
    parent_id: {
      type: "uuid",
      notNull: false,
      references: "comments(id)",
      onDelete: "CASCADE",
      comment: "For threaded replies",
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

  pgm.createIndex("comments", "document_id");
  pgm.createIndex("comments", "user_id");
  pgm.createIndex("comments", "parent_id");
  pgm.createIndex("comments", "resolved");
  pgm.createIndex("comments", "deleted_at");

  // Suggestions table - edit suggestions (track changes)
  pgm.createTable("suggestions", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    document_id: {
      type: "uuid",
      notNull: true,
      references: "documents(id)",
      onDelete: "CASCADE",
    },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    type: {
      type: "varchar(20)",
      notNull: true,
      check: "type IN ('insert', 'delete', 'replace', 'format')",
    },
    position: {
      type: "jsonb",
      notNull: true,
      comment: "Position in document {from, to, version}",
    },
    original_content: {
      type: "text",
      notNull: false,
    },
    suggested_content: {
      type: "text",
      notNull: false,
    },
    status: {
      type: "varchar(20)",
      notNull: true,
      default: "'pending'",
      check: "status IN ('pending', 'accepted', 'rejected')",
    },
    resolved_at: {
      type: "timestamptz",
      notNull: false,
    },
    resolved_by: {
      type: "uuid",
      notNull: false,
      references: "users(id)",
      onDelete: "SET NULL",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("suggestions", "document_id");
  pgm.createIndex("suggestions", "user_id");
  pgm.createIndex("suggestions", "status");
  pgm.createIndex("suggestions", "created_at");

  // Collaboration sessions table - active editing sessions
  pgm.createTable("collaboration_sessions", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    document_id: {
      type: "uuid",
      notNull: true,
      references: "documents(id)",
      onDelete: "CASCADE",
    },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    cursor_position: {
      type: "integer",
      notNull: false,
      comment: "Current cursor position in document",
    },
    selection_start: {
      type: "integer",
      notNull: false,
    },
    selection_end: {
      type: "integer",
      notNull: false,
    },
    last_activity_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
    expires_at: {
      type: "timestamptz",
      notNull: true,
      comment: "Auto-expire inactive sessions",
    },
  });

  pgm.createIndex("collaboration_sessions", "document_id");
  pgm.createIndex("collaboration_sessions", ["document_id", "user_id"], {
    unique: true,
  });
  pgm.createIndex("collaboration_sessions", "expires_at");

  // Document templates table
  pgm.createTable("document_templates", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    name: {
      type: "varchar(255)",
      notNull: true,
    },
    description: {
      type: "text",
      notNull: false,
    },
    category: {
      type: "varchar(50)",
      notNull: true,
      check:
        "category IN ('blank', 'business', 'education', 'personal', 'legal', 'creative')",
    },
    content: {
      type: "jsonb",
      notNull: true,
    },
    thumbnail: {
      type: "text",
      notNull: false,
      comment: "URL to template preview image",
    },
    is_public: {
      type: "boolean",
      notNull: true,
      default: false,
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

  pgm.createIndex("document_templates", "category");
  pgm.createIndex("document_templates", "is_public");
  pgm.createIndex("document_templates", "created_by");

  // Apply updated_at trigger to tables
  const tablesWithUpdatedAt = ["documents", "comments"];

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
  const tablesWithUpdatedAt = ["documents", "comments"];
  for (const table of tablesWithUpdatedAt) {
    pgm.dropTrigger(table, `update_${table}_updated_at`, { ifExists: true });
  }

  // Drop tables (in reverse order of dependencies)
  pgm.dropTable("document_templates", { ifExists: true });
  pgm.dropTable("collaboration_sessions", { ifExists: true });
  pgm.dropTable("suggestions", { ifExists: true });
  pgm.dropTable("comments", { ifExists: true });
  pgm.dropTable("document_shares", { ifExists: true });
  pgm.dropTable("document_versions", { ifExists: true });
  pgm.dropTable("documents", { ifExists: true });
}
