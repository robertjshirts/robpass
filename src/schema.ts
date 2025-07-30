import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  password_salt: text('password_salt').notNull(),
  authentication_hash: text('authentication_hash').notNull(),
  kdf_iterations: integer('kdf_iterations').notNull(),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
}, (table) => [
  index('username_idx').on(table.username)
]);

export const vault_items = sqliteTable('vault_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  encrypted_data: text('encrypted_data').notNull(),
  iv: text('iv').notNull(),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
}, (table) => [
  index('user_id_idx').on(table.user_id)
]);
