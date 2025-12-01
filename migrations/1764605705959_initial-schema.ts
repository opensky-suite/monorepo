/**
 * Initial Database Schema for OpenSky Suite
 *
 * Core entities:
 * - Users & Authentication
 * - Organizations & Teams
 * - Permissions & RBAC
 * - API Keys
 * - Sessions
 */

import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Enable extensions
  pgm.createExtension("uuid-ossp", { ifNotExists: true });
  pgm.createExtension("citext", { ifNotExists: true });

  // Users table
  pgm.createTable("users", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    email: {
      type: "citext",
      notNull: true,
      unique: true,
    },
    email_verified: {
      type: "boolean",
      notNull: true,
      default: false,
    },
    password_hash: {
      type: "text",
      notNull: false, // Nullable for OAuth-only users
    },
    first_name: {
      type: "varchar(100)",
      notNull: true,
    },
    last_name: {
      type: "varchar(100)",
      notNull: true,
    },
    display_name: {
      type: "varchar(200)",
      notNull: true,
    },
    avatar_url: {
      type: "text",
      notNull: false,
    },
    two_factor_enabled: {
      type: "boolean",
      notNull: true,
      default: false,
    },
    two_factor_secret: {
      type: "text",
      notNull: false,
    },
    last_login_at: {
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

  pgm.createIndex("users", "email");
  pgm.createIndex("users", "created_at");

  // User profiles table
  pgm.createTable("user_profiles", {
    user_id: {
      type: "uuid",
      primaryKey: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    bio: {
      type: "text",
      notNull: false,
    },
    phone_number: {
      type: "varchar(20)",
      notNull: false,
    },
    timezone: {
      type: "varchar(50)",
      notNull: true,
      default: "'UTC'",
    },
    locale: {
      type: "varchar(10)",
      notNull: true,
      default: "'en-US'",
    },
    notification_email: {
      type: "boolean",
      notNull: true,
      default: true,
    },
    notification_push: {
      type: "boolean",
      notNull: true,
      default: true,
    },
    notification_slack: {
      type: "boolean",
      notNull: true,
      default: false,
    },
    notification_in_app: {
      type: "boolean",
      notNull: true,
      default: true,
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

  // Email verifications table
  pgm.createTable("email_verifications", {
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
    email: {
      type: "citext",
      notNull: true,
    },
    token: {
      type: "varchar(100)",
      notNull: true,
      unique: true,
    },
    expires_at: {
      type: "timestamptz",
      notNull: true,
    },
    verified_at: {
      type: "timestamptz",
      notNull: false,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("email_verifications", "token");
  pgm.createIndex("email_verifications", "user_id");
  pgm.createIndex("email_verifications", "expires_at");

  // Password resets table
  pgm.createTable("password_resets", {
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
    token: {
      type: "varchar(100)",
      notNull: true,
      unique: true,
    },
    expires_at: {
      type: "timestamptz",
      notNull: true,
    },
    used_at: {
      type: "timestamptz",
      notNull: false,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("password_resets", "token");
  pgm.createIndex("password_resets", "user_id");

  // Sessions table
  pgm.createTable("sessions", {
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
    token: {
      type: "text",
      notNull: true,
      unique: true,
    },
    ip_address: {
      type: "inet",
      notNull: false,
    },
    user_agent: {
      type: "text",
      notNull: false,
    },
    expires_at: {
      type: "timestamptz",
      notNull: true,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("sessions", "user_id");
  pgm.createIndex("sessions", "token");
  pgm.createIndex("sessions", "expires_at");

  // API keys table
  pgm.createTable("api_keys", {
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
    // org_id omitted for now - will be added in separate migration after organizations table exists
    name: {
      type: "varchar(100)",
      notNull: true,
    },
    key_hash: {
      type: "text",
      notNull: true,
    },
    prefix: {
      type: "varchar(20)",
      notNull: true,
    },
    scopes: {
      type: "text[]",
      notNull: true,
      default: "{}",
    },
    last_used_at: {
      type: "timestamptz",
      notNull: false,
    },
    expires_at: {
      type: "timestamptz",
      notNull: false,
    },
    revoked_at: {
      type: "timestamptz",
      notNull: false,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("api_keys", "user_id");
  pgm.createIndex("api_keys", "prefix");
  // org_id index omitted - will be added in separate migration

  // OAuth providers table
  pgm.createTable("oauth_providers", {
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
    provider: {
      type: "varchar(50)",
      notNull: true,
    },
    provider_id: {
      type: "varchar(255)",
      notNull: true,
    },
    provider_email: {
      type: "citext",
      notNull: true,
    },
    access_token: {
      type: "text",
      notNull: true,
    },
    refresh_token: {
      type: "text",
      notNull: false,
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
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("oauth_providers", "user_id");
  pgm.createIndex("oauth_providers", ["provider", "provider_id"], {
    unique: true,
  });

  // Organizations table
  pgm.createTable("organizations", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    name: {
      type: "varchar(200)",
      notNull: true,
    },
    slug: {
      type: "varchar(100)",
      notNull: true,
      unique: true,
    },
    domain: {
      type: "varchar(255)",
      notNull: false,
    },
    owner_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "RESTRICT",
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

  pgm.createIndex("organizations", "slug");
  pgm.createIndex("organizations", "owner_id");

  // Teams table
  pgm.createTable("teams", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    org_id: {
      type: "uuid",
      notNull: true,
      references: "organizations(id)",
      onDelete: "CASCADE",
    },
    name: {
      type: "varchar(200)",
      notNull: true,
    },
    description: {
      type: "text",
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

  pgm.createIndex("teams", "org_id");

  // Team members table
  pgm.createTable("team_members", {
    team_id: {
      type: "uuid",
      notNull: true,
      references: "teams(id)",
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
    },
    joined_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.addConstraint("team_members", "team_members_pkey", {
    primaryKey: ["team_id", "user_id"],
  });

  pgm.createIndex("team_members", "user_id");
  pgm.createIndex("team_members", "team_id");

  // Roles table
  pgm.createTable("roles", {
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
    permissions: {
      type: "text[]",
      notNull: true,
      default: "{}",
    },
    org_id: {
      type: "uuid",
      notNull: false,
      references: "organizations(id)",
      onDelete: "CASCADE",
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

  pgm.createIndex("roles", "org_id");
  pgm.createIndex("roles", ["org_id", "name"]);

  // User roles table
  pgm.createTable("user_roles", {
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    role_id: {
      type: "uuid",
      notNull: true,
      references: "roles(id)",
      onDelete: "CASCADE",
    },
    org_id: {
      type: "uuid",
      notNull: false,
      references: "organizations(id)",
      onDelete: "CASCADE",
    },
    assigned_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.addConstraint("user_roles", "user_roles_pkey", {
    primaryKey: ["user_id", "role_id"],
  });

  pgm.createIndex("user_roles", "user_id");
  pgm.createIndex("user_roles", "role_id");
  pgm.createIndex("user_roles", "org_id");

  // Permissions table
  pgm.createTable("permissions", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    resource: {
      type: "varchar(50)",
      notNull: true,
    },
    resource_id: {
      type: "uuid",
      notNull: true,
    },
    subject_type: {
      type: "varchar(20)",
      notNull: true,
    },
    subject_id: {
      type: "uuid",
      notNull: true,
    },
    action: {
      type: "varchar(20)",
      notNull: true,
    },
    granted: {
      type: "boolean",
      notNull: true,
      default: true,
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

  pgm.createIndex("permissions", ["resource", "resource_id"]);
  pgm.createIndex("permissions", ["subject_type", "subject_id"]);
  pgm.createIndex(
    "permissions",
    ["resource", "resource_id", "subject_type", "subject_id", "action"],
    { unique: true },
  );

  // Create trigger function for updated_at
  pgm.createFunction(
    "update_updated_at_column",
    [],
    {
      returns: "trigger",
      language: "plpgsql",
      replace: true,
    },
    `
    BEGIN
      NEW.updated_at = current_timestamp;
      RETURN NEW;
    END;
    `,
  );

  // Apply updated_at trigger to tables
  const tablesWithUpdatedAt = [
    "users",
    "user_profiles",
    "oauth_providers",
    "organizations",
    "teams",
    "roles",
    "permissions",
  ];

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
  const tablesWithUpdatedAt = [
    "users",
    "user_profiles",
    "oauth_providers",
    "organizations",
    "teams",
    "roles",
    "permissions",
  ];

  for (const table of tablesWithUpdatedAt) {
    pgm.dropTrigger(table, `update_${table}_updated_at`, { ifExists: true });
  }

  // Drop function
  pgm.dropFunction("update_updated_at_column", [], { ifExists: true });

  // Drop tables (in reverse order of dependencies)
  pgm.dropTable("permissions", { ifExists: true });
  pgm.dropTable("user_roles", { ifExists: true });
  pgm.dropTable("roles", { ifExists: true });
  pgm.dropTable("team_members", { ifExists: true });
  pgm.dropTable("teams", { ifExists: true });
  pgm.dropTable("organizations", { ifExists: true });
  pgm.dropTable("oauth_providers", { ifExists: true });
  pgm.dropTable("api_keys", { ifExists: true });
  pgm.dropTable("sessions", { ifExists: true });
  pgm.dropTable("password_resets", { ifExists: true });
  pgm.dropTable("email_verifications", { ifExists: true });
  pgm.dropTable("user_profiles", { ifExists: true });
  pgm.dropTable("users", { ifExists: true });

  // Drop extensions
  pgm.dropExtension("citext", { ifExists: true });
  pgm.dropExtension("uuid-ossp", { ifExists: true });
}
