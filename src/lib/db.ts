/**
 * Database Connection and Configuration for RobPass
 * 
 * This module provides the database connection using Drizzle ORM with SQLite.
 * It ensures proper connection management and provides a singleton instance.
 */

import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { users, vault_items } from '../schema';

// Database connection instance
let db: ReturnType<typeof drizzle> | null = null;
let sqlite: Database.Database | null = null;

/**
 * Get or create database connection
 */
export function getDatabase() {
  if (!db) {
    const dbPath = process.env.DB_FILE_NAME || 'file:local.db';
    
    // Remove 'file:' prefix if present
    const cleanPath = dbPath.startsWith('file:') ? dbPath.slice(5) : dbPath;
    
    sqlite = new Database(cleanPath);
    
    // Enable foreign key constraints
    sqlite.pragma('foreign_keys = ON');
    
    // Enable WAL mode for better performance
    sqlite.pragma('journal_mode = WAL');
    
    db = drizzle(sqlite, {
      schema: { users, vault_items }
    });
  }
  
  return db;
}

/**
 * Close database connection
 */
export function closeDatabase() {
  if (sqlite) {
    sqlite.close();
    sqlite = null;
    db = null;
  }
}

/**
 * Health check for database connection
 */
export function checkDatabaseHealth(): boolean {
  try {
    const db = getDatabase();
    // Simple query to check if database is accessible
    db.select().from(users).limit(1).all();
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Export schema for use in API routes
export { users, vault_items };
