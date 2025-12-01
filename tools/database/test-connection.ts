/**
 * Test Database Connection
 * Verifies database connection and schema
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable not set');
    console.log('\nSet it in .env file:');
    console.log('DATABASE_URL=postgresql://opensky:password@localhost:5432/opensky_dev');
    process.exit(1);
  }

  console.log('🔍 Testing database connection...\n');
  console.log(`Database URL: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);

  const pool = new pg.Pool({ connectionString: databaseUrl });

  try {
    // Test connection
    const client = await pool.connect();
    console.log('✅ Connected to database\n');

    // Check PostgreSQL version
    const versionResult = await client.query('SELECT version()');
    console.log('📊 PostgreSQL version:');
    console.log(`   ${versionResult.rows[0].version.split(',')[0]}\n`);

    // Check extensions
    const extensionsResult = await client.query(
      "SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'citext') ORDER BY extname"
    );
    console.log('🔌 Extensions installed:');
    if (extensionsResult.rows.length > 0) {
      extensionsResult.rows.forEach((row) => {
        console.log(`   ✅ ${row.extname}`);
      });
    } else {
      console.log('   ⚠️  No extensions found (run migrations first)');
    }
    console.log('');

    // Check migrations
    const migrationCheck = await client.query(
      "SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pgmigrations')"
    );

    if (migrationCheck.rows[0].exists) {
      const migrationsResult = await client.query(
        'SELECT name, run_on FROM pgmigrations ORDER BY run_on DESC LIMIT 5'
      );
      console.log('📦 Recent migrations:');
      if (migrationsResult.rows.length > 0) {
        migrationsResult.rows.forEach((row) => {
          const date = new Date(row.run_on).toISOString().split('T')[0];
          console.log(`   ✅ ${row.name} (${date})`);
        });
      } else {
        console.log('   ⚠️  No migrations run yet');
      }
    } else {
      console.log('📦 Migrations table: Not created yet (run npm run db:migrate)');
    }
    console.log('');

    // Check tables
    const tablesResult = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('pgmigrations') ORDER BY tablename"
    );
    console.log('📋 Tables:');
    if (tablesResult.rows.length > 0) {
      tablesResult.rows.forEach((row) => {
        console.log(`   ✅ ${row.tablename}`);
      });
    } else {
      console.log('   ⚠️  No tables found (run migrations first)');
    }
    console.log('');

    // Count records in key tables
    const keyTables = ['users', 'organizations', 'emails', 'files'];
    console.log('📊 Record counts:');

    for (const table of keyTables) {
      try {
        const countResult = await client.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`   ${table}: ${countResult.rows[0].count} records`);
      } catch (error) {
        console.log(`   ${table}: table not found`);
      }
    }

    client.release();
    console.log('\n✅ Database connection test passed!');
    console.log('\nNext steps:');
    console.log('  npm run db:migrate     # Run migrations');
    console.log('  npm run db:seed        # Load seed data');
    console.log('  npm run db:reset       # Reset and seed');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Database connection failed:', error.message);
    console.log('\nTroubleshooting:');
    console.log('  1. Is PostgreSQL running? (npm run docker:up)');
    console.log('  2. Check DATABASE_URL in .env file');
    console.log('  3. Verify database credentials');
    console.log('  4. Check network connectivity');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testConnection();
