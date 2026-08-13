import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name'),
  role: text('role').notNull().default('user'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const plants = pgTable(
  'plants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    varietyKey: text('variety_key').notNull(),
    commonName: text('common_name').notNull(),
    species: text('species').notNull(),
    cultivar: text('cultivar'),
    plantType: text('plant_type').notNull(),
    zoneMin: integer('zone_min').notNull(),
    zoneMax: integer('zone_max').notNull(),
    sunRequirements: text('sun_requirements'),
    waterNeeds: text('water_needs'),
    daysToMaturity: integer('days_to_maturity'),
    spacingInches: integer('spacing_inches'),
    provider: text('provider'),
    providerExternalId: text('provider_external_id'),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('plants_variety_key_uidx').on(t.varietyKey),
    index('plants_plant_type_idx').on(t.plantType),
    index('plants_zone_idx').on(t.zoneMin, t.zoneMax),
  ],
);

export const favorites = pgTable(
  'favorites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    plantId: uuid('plant_id')
      .notNull()
      .references(() => plants.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    clientMutationId: text('client_mutation_id'),
  },
  (t) => [uniqueIndex('favorites_user_plant_uidx').on(t.userId, t.plantId)],
);

export const catalogSyncRuns = pgTable('catalog_sync_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  triggeredBy: text('triggered_by').notNull(),
  provider: text('provider').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  status: text('status').notNull().default('running'),
  plantsUpserted: integer('plants_upserted').notNull().default(0),
  errorMessage: text('error_message'),
});
