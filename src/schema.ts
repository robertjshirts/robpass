import { pgTable, serial, varchar, text, integer, timestamp, index, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  password_salt: text('password_salt').notNull(),
  authentication_hash: text('authentication_hash').notNull(),
  kdf_iterations: integer('kdf_iterations').notNull(),
  totp_enabled: boolean('totp_enabled').default(false),
  totp_secret_encrypted: text('totp_secret_encrypted'),
  totp_secret_iv: text('totp_secret_iv'),
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

export const backup_codes = pgTable('backup_codes', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  code_hash: text('code_hash').notNull(),
  used: boolean('used').default(false),
  created_at: timestamp('created_at').defaultNow()
}, (table) => [
  index('backup_codes_user_id_idx').on(table.user_id)
]);
