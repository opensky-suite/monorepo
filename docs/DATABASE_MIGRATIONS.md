# Database Migrations

## Overview

OpenSky Suite uses **node-pg-migrate** for production-ready database migrations with full version control, rollback capability, and automated testing.

---

## Quick Start

```bash
# Test connection
npm run db:test

# Run all migrations
npm run db:migrate

# Load seed data (development)
npm run db:seed

# Reset database (down to zero, up, seed)
npm run db:reset
```

---

## Migration Tool: node-pg-migrate

**Why node-pg-migrate:**
- ✅ TypeScript support
- ✅ Programmatic API
- ✅ Rollback capability
- ✅ Migration locking (prevents concurrent runs)
- ✅ Schema validation
- ✅ Active maintenance
- ✅ Zero dependencies on ORM

**Configuration:** `.node-pg-migrate.config.json`

---

## Available Commands

### Check Status
```bash
npm run db:migrate:status
```

Shows:
- Pending migrations
- Applied migrations
- Migration order

### Apply Migrations
```bash
# Run all pending migrations
npm run db:migrate

# Run specific number of migrations
npm run db:migrate -- 1

# Dry run (show SQL without executing)
npm run db:migrate -- --dry-run
```

### Rollback Migrations
```bash
# Rollback last migration
npm run db:migrate:down

# Rollback specific number
npm run db:migrate:down -- 2

# Rollback to zero (dangerous!)
npm run db:migrate:down -- 0
```

### Redo Last Migration
```bash
# Down then up (useful for testing)
npm run db:migrate:redo
```

### Create New Migration
```bash
# TypeScript migration
npm run db:migrate:create my-new-migration

# Creates: migrations/1234567890_my-new-migration.ts
```

### Seed Development Data
```bash
# Load test data
npm run db:seed

# Custom seed file
psql $DATABASE_URL -f database/seeds/custom.sql
```

### Reset Database
```bash
# Nuclear option: down to zero, up, seed
npm run db:reset

# WARNING: Destroys all data!
```

### Test Connection
```bash
# Verify database connectivity and schema
npm run db:test
```

Output:
```
✅ Connected to database
📊 PostgreSQL version: PostgreSQL 17.0
🔌 Extensions installed:
   ✅ citext
   ✅ uuid-ossp
📦 Recent migrations:
   ✅ 1764607065986_skymail-schema
   ✅ 1764606751438_skydrive-schema
   ✅ 1764605705959_initial-schema
📋 Tables:
   ✅ users
   ✅ organizations
   ✅ emails
   ...
```

---

## Writing Migrations

### Migration Template

```typescript
import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Forward migration (applying changes)
  
  pgm.createTable('my_table', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Add indexes
  pgm.createIndex('my_table', 'name');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Rollback migration (undoing changes)
  
  pgm.dropTable('my_table');
}
```

### Best Practices

1. **Always provide `down` migrations**
   - Every `up` must have corresponding `down`
   - Enables rollback in production
   
2. **One logical change per migration**
   - Add table: one migration
   - Alter table: separate migration
   - Easier to rollback

3. **Use transactions** (default)
   - Migrations are atomic
   - All-or-nothing execution
   
4. **Test rollback locally**
   ```bash
   npm run db:migrate:redo
   ```

5. **Never modify existing migrations**
   - Once applied in prod, it's immutable
   - Create new migration to fix issues
   
6. **Add comments**
   - Explain WHY the change
   - Document data transformations

### Common Operations

#### Create Table
```typescript
pgm.createTable('users', {
  id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
  email: { type: 'citext', notNull: true, unique: true },
  created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
});
```

#### Add Column
```typescript
pgm.addColumn('users', {
  last_login: { type: 'timestamp', notNull: false },
});
```

#### Create Index
```typescript
pgm.createIndex('users', 'email');
pgm.createIndex('users', ['organization_id', 'created_at']);
```

#### Add Foreign Key
```typescript
pgm.addConstraint('posts', 'fk_posts_user_id', {
  foreignKeys: {
    columns: 'user_id',
    references: 'users(id)',
    onDelete: 'CASCADE',
  },
});
```

#### Add Check Constraint
```typescript
pgm.addConstraint('users', 'check_email_format', {
  check: "email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}$'",
});
```

#### Raw SQL
```typescript
pgm.sql(`
  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ language 'plpgsql';
`);
```

---

## Seed Data

### Development Seeds

**File:** `database/seeds/dev-data.sql`

**Purpose:** Test data for local development

**Contents:**
- 4 test users
- 1 test organization
- Sample emails and threads
- Sample files

**Load:**
```bash
npm run db:seed
```

**When to Use:**
- Local development
- Screenshot testing
- E2E tests
- Manual testing

**DO NOT use in production!**

### Production Seeds

For production data (lookup tables, initial admin):

1. Create separate seed file: `database/seeds/prod-data.sql`
2. Include in migration (one-time)
3. Or run manually in production

---

## Workflow

### Development Workflow

```bash
# 1. Start services
npm run docker:up

# 2. Run migrations
npm run db:migrate

# 3. Load seed data
npm run db:seed

# 4. Develop features

# 5. Create migration for schema changes
npm run db:migrate:create add-user-preferences

# 6. Edit migration file
# migrations/1234567890_add-user-preferences.ts

# 7. Test migration
npm run db:migrate:redo

# 8. Commit migration
git add migrations/
git commit -m "feat(db): add user preferences table"
```

### CI/CD Workflow

**GitHub Actions automatically:**
1. Starts PostgreSQL container
2. Runs migrations (`npm run db:migrate`)
3. Runs tests against migrated schema
4. Fails if migration errors

### Production Deployment

```bash
# 1. Backup database
pg_dump $DATABASE_URL > backup.sql

# 2. Run migrations (automatic rollback on error)
npm run db:migrate

# 3. Verify
npm run db:test

# 4. If issues, rollback
npm run db:migrate:down
```

---

## Testing Migrations

### Local Testing

```bash
# 1. Run migration up
npm run db:migrate

# 2. Verify schema
npm run db:test

# 3. Rollback
npm run db:migrate:down

# 4. Verify rollback worked
npm run db:test

# 5. Re-apply
npm run db:migrate
```

### Automated Testing

Migrations are tested in CI/CD:
- Fresh database created
- All migrations applied
- Tests run against schema
- Rollback tested

---

## Troubleshooting

### Migration Fails

```bash
# Check status
npm run db:migrate:status

# View error
npm run db:migrate -- --verbose

# Rollback last
npm run db:migrate:down

# Fix and re-run
npm run db:migrate
```

### Database Connection Issues

```bash
# Test connection
npm run db:test

# Check services
npm run docker:ps

# Check logs
npm run docker:logs postgres

# Restart services
npm run docker:down
npm run docker:up
```

### Migration Lock

If migration hangs:

```sql
-- Check locks
SELECT * FROM pg_locks WHERE locktype = 'advisory';

-- Release lock (if needed)
SELECT pg_advisory_unlock_all();
```

### Schema Out of Sync

```bash
# Reset to known state
npm run db:reset

# Or manually
npm run db:migrate:down -- 0  # Down to zero
npm run db:migrate             # Up to latest
npm run db:seed                # Load data
```

---

## Best Practices

### 1. Schema Design
- Use UUIDs for primary keys
- Add `created_at` and `updated_at` to all tables
- Use `citext` for case-insensitive text (emails)
- Add indexes for foreign keys
- Add check constraints for validation

### 2. Migration Naming
```
✅ 1234567890_create-users-table.ts
✅ 1234567890_add-email-index.ts
✅ 1234567890_alter-users-add-preferences.ts
❌ 1234567890_update.ts
❌ 1234567890_fix.ts
```

### 3. Data Migrations
- Separate from schema migrations
- Use raw SQL for data transforms
- Test with production data volume
- Add progress logging

### 4. Performance
- Create indexes CONCURRENTLY in production
- Large data migrations: batch operations
- Add indexes after bulk inserts
- Monitor query performance

### 5. Zero-Downtime Migrations
- Additive changes first (add columns as nullable)
- Deploy code that handles both schemas
- Then make columns NOT NULL
- Then remove old columns

---

## Migration History

### Current Migrations

1. **1764605705959_initial-schema.ts**
   - Users, organizations, authentication
   - RBAC and permissions
   - API keys, sessions
   
2. **1764606751438_skydrive-schema.ts**
   - Files and folders
   - Sharing and permissions
   
3. **1764607065986_skymail-schema.js**
   - Emails, threads, labels
   - Attachments
   - Search indexes

---

## Resources

- [node-pg-migrate docs](https://salsita.github.io/node-pg-migrate/)
- [PostgreSQL docs](https://www.postgresql.org/docs/)
- [Migration best practices](https://www.brianm.me/posts/postgres-migrations/)

---

## Summary

**Commands:**
```bash
npm run db:test           # Test connection
npm run db:migrate        # Run migrations
npm run db:migrate:down   # Rollback
npm run db:migrate:redo   # Down and up
npm run db:migrate:status # Check status
npm run db:seed           # Load dev data
npm run db:reset          # Nuclear reset
```

**Workflow:**
1. Create migration (`npm run db:migrate:create`)
2. Write up/down functions
3. Test locally (`npm run db:migrate:redo`)
4. Commit migration
5. CI tests automatically
6. Deploy applies in production

**Result:** Production-ready database migrations with full version control! 🗄️✅
