import {
  pgTable,
  uuid,
  timestamp,
  text,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";

export const syncStatusEnum = pgEnum("sync_status", ["running", "success", "failed"]);

export const syncProviderEnum = pgEnum("sync_provider", [
  "trefle",
  "perenual",
  "reference_seed",
]);

export const catalogSyncRuns = pgTable("catalog_sync_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  status: syncStatusEnum("status").notNull().default("running"),
  provider: syncProviderEnum("provider").notNull(),
  recordsUpserted: integer("records_upserted").default(0),
  errorMessage: text("error_message"),
});
