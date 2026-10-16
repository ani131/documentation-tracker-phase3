import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const records = sqliteTable('records', {
  key: text('key').primaryKey(), body: text('body').notNull(), state: text('state').notNull(),
});
export const events = sqliteTable('events', {
  id: text('id').primaryKey(), event: text('event').notNull(), status: text('status').notNull(),
  elapsedMs: integer('elapsed_ms').notNull(), analysisId: text('analysis_id'), createdAt: text('created_at').notNull(),
});
