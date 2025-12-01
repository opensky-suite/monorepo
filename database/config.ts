/**
 * Database Configuration
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables
config({ path: resolve(process.cwd(), ".env") });

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  max?: number; // Max connections in pool
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export const dbConfig: DatabaseConfig = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  database: process.env.DB_NAME || "opensky_dev",
  user: process.env.DB_USER || "opensky",
  password: process.env.DB_PASSWORD || "dev_password_change_in_production",
  ssl: process.env.DB_SSL === "true",
  max: parseInt(process.env.DB_POOL_MAX || "20", 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

export const migrationConfig = {
  databaseUrl: `postgres://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`,
  dir: resolve(process.cwd(), "migrations"),
  migrationsTable: "pgmigrations",
  direction: "up" as const,
  count: Infinity,
  ignorePattern: "\\..*",
  schema: "public",
  decamelize: true,
  createSchema: true,
  createMigrationsSchema: true,
  checkOrder: true,
};
