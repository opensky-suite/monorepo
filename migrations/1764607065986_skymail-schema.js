/**
 * SkyMail Database Schema Migration
 *
 * Gmail-inspired email system with:
 * - Email storage and threading
 * - Labels (tags) and filters
 * - Attachments
 * - Draft management
 * - Spam detection
 * - Full-text search indexing
 */

export const up = (pgm) => {
  // Email messages table
  pgm.createTable("emails", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users",
      onDelete: "CASCADE",
    },

    // Email headers
    message_id: {
      type: "varchar(255)",
      notNull: true,
      unique: true,
      comment: "RFC 5322 Message-ID header",
    },
    in_reply_to: {
      type: "varchar(255)",
      comment: "Message-ID of email being replied to",
    },
    references: {
      type: "text",
      comment: "References header for threading",
    },
    thread_id: {
      type: "uuid",
      comment: "Foreign key to email_threads table",
    },

    // From/To/Cc/Bcc
    from_address: {
      type: "varchar(255)",
      notNull: true,
    },
    from_name: {
      type: "varchar(255)",
    },
    to_addresses: {
      type: "jsonb",
      notNull: true,
      comment: "Array of {address, name} objects",
    },
    cc_addresses: {
      type: "jsonb",
      default: "[]",
      comment: "Array of {address, name} objects",
    },
    bcc_addresses: {
      type: "jsonb",
      default: "[]",
      comment: "Array of {address, name} objects",
    },

    // Content
    subject: {
      type: "varchar(500)",
      notNull: true,
    },
    body_text: {
      type: "text",
      comment: "Plain text version",
    },
    body_html: {
      type: "text",
      comment: "HTML version",
    },

    // State
    is_draft: {
      type: "boolean",
      default: false,
    },
    is_sent: {
      type: "boolean",
      default: false,
    },
    is_read: {
      type: "boolean",
      default: false,
    },
    is_starred: {
      type: "boolean",
      default: false,
    },
    is_important: {
      type: "boolean",
      default: false,
    },
    is_archived: {
      type: "boolean",
      default: false,
    },
    is_trashed: {
      type: "boolean",
      default: false,
    },
    is_spam: {
      type: "boolean",
      default: false,
    },

    // Metadata
    spam_score: {
      type: "decimal(5,2)",
      comment: "Spam probability (0.00-100.00)",
    },
    size_bytes: {
      type: "integer",
      notNull: true,
      default: 0,
    },
    has_attachments: {
      type: "boolean",
      default: false,
    },

    // Timestamps
    received_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
    sent_at: {
      type: "timestamptz",
    },
    read_at: {
      type: "timestamptz",
    },
    trashed_at: {
      type: "timestamptz",
    },
    snoozed_until: {
      type: "timestamptz",
    },

    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
  });

  // Email threads (conversations)
  pgm.createTable("email_threads", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users",
      onDelete: "CASCADE",
    },
    subject: {
      type: "varchar(500)",
      notNull: true,
    },
    snippet: {
      type: "varchar(500)",
      comment: "Preview text from latest email",
    },
    message_count: {
      type: "integer",
      notNull: true,
      default: 0,
    },
    unread_count: {
      type: "integer",
      notNull: true,
      default: 0,
    },
    has_attachments: {
      type: "boolean",
      default: false,
    },
    is_starred: {
      type: "boolean",
      default: false,
    },
    is_important: {
      type: "boolean",
      default: false,
    },
    is_archived: {
      type: "boolean",
      default: false,
    },
    is_trashed: {
      type: "boolean",
      default: false,
    },
    last_message_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
  });

  // Add foreign key from emails to email_threads
  pgm.addConstraint("emails", "fk_emails_thread_id", {
    foreignKeys: {
      columns: "thread_id",
      references: "email_threads(id)",
      onDelete: "SET NULL",
    },
  });

  // Labels (like Gmail labels/tags)
  pgm.createTable("email_labels", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users",
      onDelete: "CASCADE",
    },
    name: {
      type: "varchar(100)",
      notNull: true,
    },
    color: {
      type: "varchar(7)",
      comment: "Hex color code",
    },
    is_system: {
      type: "boolean",
      default: false,
      comment: "System labels like Inbox, Sent, Drafts",
    },
    sort_order: {
      type: "integer",
      default: 0,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
  });

  // Many-to-many: emails <-> labels
  pgm.createTable("email_label_mappings", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    email_id: {
      type: "uuid",
      notNull: true,
      references: "emails",
      onDelete: "CASCADE",
    },
    label_id: {
      type: "uuid",
      notNull: true,
      references: "email_labels",
      onDelete: "CASCADE",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
  });

  // Email attachments
  pgm.createTable("email_attachments", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    email_id: {
      type: "uuid",
      notNull: true,
      references: "emails",
      onDelete: "CASCADE",
    },
    filename: {
      type: "varchar(255)",
      notNull: true,
    },
    content_type: {
      type: "varchar(100)",
      notNull: true,
    },
    size_bytes: {
      type: "integer",
      notNull: true,
    },
    storage_key: {
      type: "varchar(500)",
      notNull: true,
      comment: "S3/MinIO key or local file path",
    },
    content_id: {
      type: "varchar(255)",
      comment: "Content-ID for inline images",
    },
    is_inline: {
      type: "boolean",
      default: false,
    },
    virus_scanned: {
      type: "boolean",
      default: false,
    },
    virus_detected: {
      type: "boolean",
      default: false,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
  });

  // Email filters (rules)
  pgm.createTable("email_filters", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users",
      onDelete: "CASCADE",
    },
    name: {
      type: "varchar(100)",
      notNull: true,
    },
    is_enabled: {
      type: "boolean",
      default: true,
    },

    // Filter conditions (all must match)
    conditions: {
      type: "jsonb",
      notNull: true,
      comment: "Array of {field, operator, value} objects",
    },

    // Actions to take
    actions: {
      type: "jsonb",
      notNull: true,
      comment: "Array of {action, value} objects",
    },

    sort_order: {
      type: "integer",
      default: 0,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
  });

  // Contacts (address book)
  pgm.createTable("email_contacts", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users",
      onDelete: "CASCADE",
    },
    email_address: {
      type: "varchar(255)",
      notNull: true,
    },
    name: {
      type: "varchar(255)",
    },
    avatar_url: {
      type: "varchar(500)",
    },

    // Auto-populated from email interactions
    email_count: {
      type: "integer",
      default: 0,
    },
    last_emailed_at: {
      type: "timestamptz",
    },

    // Manual contact info
    phone: {
      type: "varchar(50)",
    },
    notes: {
      type: "text",
    },

    is_blocked: {
      type: "boolean",
      default: false,
      comment: "Block emails from this address",
    },

    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
  });

  // Email send queue (for scheduled/delayed sending)
  pgm.createTable("email_send_queue", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    email_id: {
      type: "uuid",
      notNull: true,
      references: "emails",
      onDelete: "CASCADE",
    },
    scheduled_at: {
      type: "timestamptz",
      notNull: true,
    },
    attempts: {
      type: "integer",
      default: 0,
    },
    last_error: {
      type: "text",
    },
    status: {
      type: "varchar(50)",
      notNull: true,
      default: "pending",
      comment: "pending, sending, sent, failed, cancelled",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
  });

  // Indexes for performance
  pgm.createIndex("emails", "user_id");
  pgm.createIndex("emails", "thread_id");
  pgm.createIndex("emails", "message_id");
  pgm.createIndex("emails", "from_address");
  pgm.createIndex("emails", ["user_id", "is_read"]);
  pgm.createIndex("emails", ["user_id", "is_starred"]);
  pgm.createIndex("emails", ["user_id", "is_trashed"]);
  pgm.createIndex("emails", ["user_id", "is_spam"]);
  pgm.createIndex("emails", ["user_id", "received_at"]);
  pgm.createIndex("emails", ["user_id", "is_draft"]);

  pgm.createIndex("email_threads", "user_id");
  pgm.createIndex("email_threads", ["user_id", "last_message_at"]);
  pgm.createIndex("email_threads", ["user_id", "is_archived"]);

  pgm.createIndex("email_labels", "user_id");
  pgm.createIndex("email_labels", ["user_id", "name"]);

  pgm.createIndex("email_label_mappings", "email_id");
  pgm.createIndex("email_label_mappings", "label_id");
  pgm.createIndex("email_label_mappings", ["email_id", "label_id"], {
    unique: true,
  });

  pgm.createIndex("email_attachments", "email_id");

  pgm.createIndex("email_filters", "user_id");
  pgm.createIndex("email_filters", ["user_id", "is_enabled"]);

  pgm.createIndex("email_contacts", "user_id");
  pgm.createIndex("email_contacts", ["user_id", "email_address"], {
    unique: true,
  });
  pgm.createIndex("email_contacts", ["user_id", "last_emailed_at"]);

  pgm.createIndex("email_send_queue", "email_id");
  pgm.createIndex("email_send_queue", ["status", "scheduled_at"]);

  // Full-text search indexes
  pgm.sql(`
    CREATE INDEX emails_search_idx ON emails 
    USING gin(to_tsvector('english', coalesce(subject, '') || ' ' || coalesce(body_text, '')));
  `);

  // Trigger to update updated_at timestamp
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);

  const tables = [
    "emails",
    "email_threads",
    "email_labels",
    "email_filters",
    "email_contacts",
    "email_send_queue",
  ];

  tables.forEach((table) => {
    pgm.sql(`
      CREATE TRIGGER update_${table}_updated_at
      BEFORE UPDATE ON ${table}
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `);
  });

  // Create default system labels for each user
  pgm.sql(`
    CREATE OR REPLACE FUNCTION create_default_email_labels()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO email_labels (user_id, name, is_system, sort_order)
      VALUES
        (NEW.id, 'Inbox', true, 0),
        (NEW.id, 'Sent', true, 1),
        (NEW.id, 'Drafts', true, 2),
        (NEW.id, 'Spam', true, 3),
        (NEW.id, 'Trash', true, 4),
        (NEW.id, 'Starred', true, 5),
        (NEW.id, 'Important', true, 6);
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);

  pgm.sql(`
    CREATE TRIGGER create_default_labels_for_new_user
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_email_labels();
  `);
};

export const down = (pgm) => {
  // Drop triggers
  pgm.sql(
    "DROP TRIGGER IF EXISTS create_default_labels_for_new_user ON users;",
  );
  pgm.sql("DROP FUNCTION IF EXISTS create_default_email_labels();");

  const tables = [
    "emails",
    "email_threads",
    "email_labels",
    "email_filters",
    "email_contacts",
    "email_send_queue",
  ];

  tables.forEach((table) => {
    pgm.sql(`DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};`);
  });

  pgm.sql("DROP FUNCTION IF EXISTS update_updated_at_column();");

  // Drop tables in reverse order
  pgm.dropTable("email_send_queue");
  pgm.dropTable("email_contacts");
  pgm.dropTable("email_filters");
  pgm.dropTable("email_attachments");
  pgm.dropTable("email_label_mappings");
  pgm.dropTable("email_labels");
  pgm.dropTable("email_threads");
  pgm.dropTable("emails");
};
