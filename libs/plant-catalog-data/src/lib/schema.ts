import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  integer,
  smallint,
  timestamp,
  date,
  jsonb,
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
    waterIntervalDays: integer('water_interval_days'),
    fertilizeIntervalDays: integer('fertilize_interval_days'),
    indoorFrostAnchor: text('indoor_frost_anchor'),
    indoorWeeksEarliest: integer('indoor_weeks_earliest'),
    indoorWeeksLatest: integer('indoor_weeks_latest'),
    sowFrostAnchor: text('sow_frost_anchor'),
    sowWeeksEarliest: integer('sow_weeks_earliest'),
    sowWeeksLatest: integer('sow_weeks_latest'),
    transplantFrostAnchor: text('transplant_frost_anchor'),
    transplantWeeksEarliest: integer('transplant_weeks_earliest'),
    transplantWeeksLatest: integer('transplant_weeks_latest'),
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

export const gardens = pgTable(
  'gardens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    nameNormalized: text('name_normalized').notNull(),
    notes: text('notes'),
    hardinessZone: integer('hardiness_zone'),
    lastFrostMonth: integer('last_frost_month'),
    lastFrostDay: integer('last_frost_day'),
    firstFrostMonth: integer('first_frost_month'),
    firstFrostDay: integer('first_frost_day'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('gardens_owner_name_uidx').on(t.ownerId, t.nameNormalized),
    index('gardens_owner_id_idx').on(t.ownerId),
  ],
);

export const gardenMemberships = pgTable(
  'garden_memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    gardenId: uuid('garden_id')
      .notNull()
      .references(() => gardens.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('garden_memberships_garden_user_uidx').on(t.gardenId, t.userId),
    uniqueIndex('garden_memberships_one_owner_uidx')
      .on(t.gardenId)
      .where(sql`${t.role} = 'owner'`),
    index('garden_memberships_user_id_idx').on(t.userId),
  ],
);

export const gardenCalendarEntries = pgTable(
  'garden_calendar_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    gardenId: uuid('garden_id')
      .notNull()
      .references(() => gardens.id, { onDelete: 'cascade' }),
    plantId: uuid('plant_id')
      .notNull()
      .references(() => plants.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('garden_calendar_entries_garden_plant_uidx').on(t.gardenId, t.plantId),
    index('garden_calendar_entries_garden_id_idx').on(t.gardenId),
  ],
);

export const gardenBeds = pgTable(
  'garden_beds',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    gardenId: uuid('garden_id')
      .notNull()
      .references(() => gardens.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    nameNormalized: text('name_normalized').notNull(),
    originXInches: integer('origin_x_inches'),
    originYInches: integer('origin_y_inches'),
    lengthInches: integer('length_inches'),
    widthInches: integer('width_inches'),
    orientation: smallint('orientation').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('garden_beds_garden_name_uidx').on(t.gardenId, t.nameNormalized),
    index('garden_beds_garden_id_idx').on(t.gardenId),
  ],
);

export const gardenPlantings = pgTable(
  'garden_plantings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    gardenId: uuid('garden_id')
      .notNull()
      .references(() => gardens.id, { onDelete: 'cascade' }),
    plantId: uuid('plant_id')
      .notNull()
      .references(() => plants.id, { onDelete: 'restrict' }),
    bedId: uuid('bed_id').references(() => gardenBeds.id, { onDelete: 'set null' }),
    plantedOn: date('planted_on', { mode: 'string' }),
    harvestedOn: date('harvested_on', { mode: 'string' }),
    layoutXInches: integer('layout_x_inches'),
    layoutYInches: integer('layout_y_inches'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    clientMutationId: text('client_mutation_id'),
  },
  (t) => [
    index('garden_plantings_garden_created_idx').on(t.gardenId, t.createdAt),
    index('garden_plantings_bed_id_idx').on(t.bedId),
    index('garden_plantings_plant_id_idx').on(t.plantId),
  ],
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

export const catalogPipelineRuns = pgTable(
  'catalog_pipeline_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    triggeredBy: text('triggered_by').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    status: text('status').notNull().default('running'),
    plantsUpserted: integer('plants_upserted').notNull().default(0),
    plantsDeprecated: integer('plants_deprecated').notNull().default(0),
    plantsReactivated: integer('plants_reactivated').notNull().default(0),
    recordsRejected: integer('records_rejected').notNull().default(0),
    errorMessage: text('error_message'),
  },
  (t) => [
    uniqueIndex('catalog_pipeline_runs_one_running_uidx')
      .on(t.status)
      .where(sql`${t.status} = 'running'`),
    index('catalog_pipeline_runs_started_at_idx').on(t.startedAt),
  ],
);

export const catalogPipelineRunSources = pgTable(
  'catalog_pipeline_run_sources',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    runId: uuid('run_id')
      .notNull()
      .references(() => catalogPipelineRuns.id, { onDelete: 'cascade' }),
    sourceId: text('source_id').notNull(),
    status: text('status').notNull(),
    recordsAccepted: integer('records_accepted').notNull().default(0),
    recordsRejected: integer('records_rejected').notNull().default(0),
    errorMessage: text('error_message'),
  },
  (t) => [uniqueIndex('catalog_pipeline_run_sources_run_source_uidx').on(t.runId, t.sourceId)],
);

export const catalogPipelineMergeDecisions = pgTable(
  'catalog_pipeline_merge_decisions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    runId: uuid('run_id')
      .notNull()
      .references(() => catalogPipelineRuns.id, { onDelete: 'cascade' }),
    varietyKey: text('variety_key').notNull(),
    contributingSources: text('contributing_sources').array().notNull(),
    fieldWinners: jsonb('field_winners').$type<Record<string, string>>().notNull(),
  },
  (t) => [
    uniqueIndex('catalog_pipeline_merge_decisions_run_key_uidx').on(t.runId, t.varietyKey),
  ],
);

export const catalogPlantSources = pgTable(
  'catalog_plant_sources',
  {
    plantId: uuid('plant_id')
      .notNull()
      .references(() => plants.id, { onDelete: 'cascade' }),
    sourceId: text('source_id').notNull(),
    externalId: text('external_id').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('catalog_plant_sources_plant_source_uidx').on(t.plantId, t.sourceId),
    index('catalog_plant_sources_source_id_idx').on(t.sourceId),
  ],
);

export const catalogPipelineSettings = pgTable('catalog_pipeline_settings', {
  id: integer('id').primaryKey(),
  cadence: text('cadence').notNull().default('daily'),
  runAtHourUtc: integer('run_at_hour_utc').notNull().default(6),
  sourceOrder: text('source_order').array().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedByUserId: uuid('updated_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
});

export const gardenCareEvents = pgTable(
  'garden_care_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    plantingId: uuid('planting_id')
      .notNull()
      .references(() => gardenPlantings.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    occurrenceOn: date('occurrence_on', { mode: 'string' }).notNull(),
    action: text('action').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('garden_care_events_occurrence_uidx').on(
      t.plantingId,
      t.kind,
      t.occurrenceOn,
    ),
    index('garden_care_events_planting_id_idx').on(t.plantingId),
  ],
);
