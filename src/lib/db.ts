/**
 * Database Connection and Configuration for RobPass
 *
 * This module provides the database connection using Drizzle ORM with PostgreSQL.
 * It ensures proper connection management and provides a singleton instance.
 */

import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import { users, vault_items } from '../schema';

// Database connection instances
let db: ReturnType<typeof drizzle> | null = null;
let pgPool: Pool | null = null;

/**
 * Get or create database connection
 */
export function getDatabase() {
  if (!db) {
    const postgresUrl = process.env.DATABASE_URL!;

    if (!postgresUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    // Create PostgreSQL connection pool
    pgPool = new Pool({
      connectionString: postgresUrl,
    });

    db = drizzle(pgPool, {
      schema: { users, vault_items }
    });
  }

  return db;
}

/**
 * Close database connection
 */
export function closeDatabase() {
  if (pgPool) {
    pgPool.end();
    pgPool = null;
  }
  db = null;
}

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const database = getDatabase();
    // Simple query to check if database is accessible
    await database.select().from(users).limit(1);
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Export schema for use in API routes
export { users, vault_items };
