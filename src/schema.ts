import { pgTable, serial, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  password_salt: text('password_salt').notNull(),
  authentication_hash: text('authentication_hash').notNull(),
  kdf_iterations: integer('kdf_iterations').notNull(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow()
}, (table) => [
  index('username_idx').on(table.username)
]);

export const vault_items = pgTable('vault_items', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  encrypted_data: text('encrypted_data').notNull(),
  iv: text('iv').notNull(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow()
}, (table) => [
  index('user_id_idx').on(table.user_id)
]);
