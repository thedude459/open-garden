import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  smallint,
  boolean,
  jsonb,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const recordStatusEnum = pgEnum("record_status", [
  "authoritative",
  "stub",
  "merged",
]);

export const plantCategoryEnum = pgEnum("plant_category", [
  "vegetable",
  "herb",
  "fruit",
  "berry",
  "fruit_tree",
  "nut_tree",
  "shrub",
  "cover_crop",
  "companion_flower",
  "guild_plant",
]);

export const sunExposureEnum = pgEnum("sun_exposure", ["full", "partial", "shade"]);

export const providerEnum = pgEnum("provider", ["trefle", "perenual"]);

export const canonicalPlants = pgTable("canonical_plants", {
  id: uuid("id").primaryKey().defaultRandom(),
  recordStatus: recordStatusEnum("record_status").notNull().default("authoritative"),
  botanicalName: varchar("botanical_name", { length: 255 }),
  commonName: varchar("common_name", { length: 255 }).notNull(),
  variety: varchar("variety", { length: 255 }),
  plantCategory: plantCategoryEnum("plant_category").notNull(),
  daysToMaturity: smallint("days_to_maturity"),
  seedStartWindow: jsonb("seed_start_window"),
  transplantRules: jsonb("transplant_rules"),
  directSeedRules: jsonb("direct_seed_rules"),
  spacingCm: jsonb("spacing_cm"),
  sunExposure: sunExposureEnum("sun_exposure"),
  wateringNeeds: jsonb("watering_needs"),
  fertilizerNeeds: varchar("fertilizer_needs", { length: 1024 }),
  fertilizerDataGap: boolean("fertilizer_data_gap").default(false),
  pestDiseaseNotes: jsonb("pest_disease_notes"),
  harvestWindow: jsonb("harvest_window"),
  hardinessMinZone: smallint("hardiness_min_zone"),
  hardinessMaxZone: smallint("hardiness_max_zone"),
  dataCompleteness: jsonb("data_completeness"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const providerPlantSources = pgTable(
  "provider_plant_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    plantId: uuid("plant_id")
      .notNull()
      .references(() => canonicalPlants.id, { onDelete: "cascade" }),
    provider: providerEnum("provider").notNull(),
    externalId: varchar("external_id", { length: 255 }).notNull(),
    rawPayload: jsonb("raw_payload"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("provider_external_unique").on(table.provider, table.externalId),
  ],
);

export type CanonicalPlant = typeof canonicalPlants.$inferSelect;
export type NewCanonicalPlant = typeof canonicalPlants.$inferInsert;
