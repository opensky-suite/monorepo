-- Development Seed Data for OpenSky Suite
-- This file is loaded in development environments for testing
-- DO NOT use in production!

-- Clear existing data (in reverse dependency order)
TRUNCATE TABLE 
  email_attachments,
  email_labels,
  email_threads,
  emails,
  files,
  api_keys,
  organization_members,
  organizations,
  users
CASCADE;

-- Insert test users
INSERT INTO users (id, email, email_verified, password_hash, first_name, last_name, display_name, created_at, updated_at)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'admin@opensky.local',
    true,
    '$2b$10$abcdefghijklmnopqrstuv',  -- password: "password123"
    'Admin',
    'User',
    'Admin User',
    NOW(),
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'alice@opensky.local',
    true,
    '$2b$10$abcdefghijklmnopqrstuv',
    'Alice',
    'Anderson',
    'Alice Anderson',
    NOW(),
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'bob@opensky.local',
    true,
    '$2b$10$abcdefghijklmnopqrstuv',
    'Bob',
    'Brown',
    'Bob Brown',
    NOW(),
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    'charlie@opensky.local',
    false,  -- Unverified email
    '$2b$10$abcdefghijklmnopqrstuv',
    'Charlie',
    'Chen',
    'Charlie Chen',
    NOW(),
    NOW()
  );

-- Insert test organization
INSERT INTO organizations (id, name, slug, domain, created_at, updated_at)
VALUES
  (
    '00000000-0000-0000-0000-000000000010',
    'OpenSky Demo Corp',
    'opensky-demo',
    'opensky.local',
    NOW(),
    NOW()
  );

-- Insert organization members
INSERT INTO organization_members (organization_id, user_id, role, joined_at)
VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'owner', NOW()),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000002', 'admin', NOW()),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000003', 'member', NOW());

-- Insert test API keys
INSERT INTO api_keys (id, user_id, name, key_hash, scopes, created_at, last_used_at, expires_at)
VALUES
  (
    '00000000-0000-0000-0000-000000000020',
    '00000000-0000-0000-0000-000000000001',
    'Development API Key',
    '$2b$10$test_api_key_hash_here',
    ARRAY['read', 'write'],
    NOW(),
    NULL,
    NOW() + INTERVAL '1 year'
  );

-- Insert test emails
INSERT INTO emails (id, user_id, message_id, subject, from_address, to_addresses, cc_addresses, body_text, body_html, received_at, created_at)
VALUES
  (
    '00000000-0000-0000-0000-000000000030',
    '00000000-0000-0000-0000-000000000002',
    '<msg001@opensky.local>',
    'Welcome to OpenSky Suite!',
    'noreply@opensky.local',
    ARRAY['alice@opensky.local'],
    ARRAY[]::text[],
    'Welcome to OpenSky Suite! This is your first email.',
    '<p>Welcome to OpenSky Suite! This is your first email.</p>',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  ),
  (
    '00000000-0000-0000-0000-000000000031',
    '00000000-0000-0000-0000-000000000002',
    '<msg002@opensky.local>',
    'Re: Welcome to OpenSky Suite!',
    'alice@opensky.local',
    ARRAY['admin@opensky.local'],
    ARRAY[]::text[],
    'Thanks for the welcome!',
    '<p>Thanks for the welcome!</p>',
    NOW() - INTERVAL '12 hours',
    NOW() - INTERVAL '12 hours'
  );

-- Insert test email thread
INSERT INTO email_threads (id, user_id, subject, last_email_id, email_count, created_at, updated_at)
VALUES
  (
    '00000000-0000-0000-0000-000000000040',
    '00000000-0000-0000-0000-000000000002',
    'Welcome to OpenSky Suite!',
    '00000000-0000-0000-0000-000000000031',
    2,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '12 hours'
  );

-- Insert test files (SkyDrive)
INSERT INTO files (id, user_id, name, path, mime_type, size_bytes, storage_key, created_at, updated_at)
VALUES
  (
    '00000000-0000-0000-0000-000000000050',
    '00000000-0000-0000-0000-000000000002',
    'README.md',
    '/README.md',
    'text/markdown',
    1024,
    'files/00000000-0000-0000-0000-000000000002/README.md',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    '00000000-0000-0000-0000-000000000051',
    '00000000-0000-0000-0000-000000000002',
    'screenshot.png',
    '/screenshots/screenshot.png',
    'image/png',
    524288,  -- 512KB
    'files/00000000-0000-0000-0000-000000000002/screenshot.png',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  );

-- Verify data loaded
SELECT 'Users loaded: ' || COUNT(*)::text FROM users;
SELECT 'Organizations loaded: ' || COUNT(*)::text FROM organizations;
SELECT 'Emails loaded: ' || COUNT(*)::text FROM emails;
SELECT 'Files loaded: ' || COUNT(*)::text FROM files;
