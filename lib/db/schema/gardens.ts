import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  smallint,
  decimal,
  date,
  pgEnum,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { canonicalPlants } from "./plants";
import { userProvisionalPlants } from "./user-data";

export const measurementUnitEnum = pgEnum("measurement_unit", ["feet", "meters"]);

export const gardenAreaTypeEnum = pgEnum("garden_area_type", ["bed", "path"]);

export const soilTypeEnum = pgEnum("soil_type", [
  "sand",
  "loamy_sand",
  "sandy_loam",
  "loam",
  "silt_loam",
  "silt",
  "sandy_clay_loam",
  "clay_loam",
  "silty_clay_loam",
  "sandy_clay",
  "silty_clay",
  "clay",
]);

export const bedSunExposureEnum = pgEnum("bed_sun_exposure", [
  "full_sun",
  "partial_shade",
  "full_shade",
]);

export const placementStatusEnum = pgEnum("placement_status", [
  "direct_seeded",
  "transplanted",
]);

export const indoorStartStatusEnum = pgEnum("indoor_start_status", [
  "active",
  "transplanted",
  "cancelled",
]);

export const gardens = pgTable(
  "gardens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 128 }).notNull(),
    description: text("description"),
    length: decimal("length", { precision: 10, scale: 2 }).notNull(),
    width: decimal("width", { precision: 10, scale: 2 }).notNull(),
    unit: measurementUnitEnum("unit").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("gardens_user_id_idx").on(table.userId),
    index("gardens_user_updated_idx").on(table.userId, table.updatedAt),
  ],
);

export const gardenAreas = pgTable(
  "garden_areas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gardenId: uuid("garden_id")
      .notNull()
      .references(() => gardens.id, { onDelete: "cascade" }),
    areaType: gardenAreaTypeEnum("area_type").notNull(),
    name: varchar("name", { length: 128 }),
    originX: decimal("origin_x", { precision: 10, scale: 2 }).notNull(),
    originY: decimal("origin_y", { precision: 10, scale: 2 }).notNull(),
    length: decimal("length", { precision: 10, scale: 2 }).notNull(),
    width: decimal("width", { precision: 10, scale: 2 }).notNull(),
    rotationDegrees: smallint("rotation_degrees").notNull().default(0),
    soilType: soilTypeEnum("soil_type"),
    sunExposure: bedSunExposureEnum("sun_exposure"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("garden_areas_garden_id_idx").on(table.gardenId)],
);

export const bedPlantingHistory = pgTable(
  "bed_planting_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gardenId: uuid("garden_id")
      .notNull()
      .references(() => gardens.id, { onDelete: "cascade" }),
    bedAreaId: uuid("bed_area_id")
      .notNull()
      .references(() => gardenAreas.id, { onDelete: "cascade" }),
    canonicalPlantId: uuid("canonical_plant_id").references(() => canonicalPlants.id),
    provisionalPlantId: uuid("provisional_plant_id").references(() => userProvisionalPlants.id),
    rotationGroup: varchar("rotation_group", { length: 64 }),
    botanicalFamily: varchar("botanical_family", { length: 128 }),
    plantedOn: date("planted_on").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("bed_history_bed_planted_idx").on(table.bedAreaId, table.plantedOn),
    index("bed_history_garden_id_idx").on(table.gardenId),
    check(
      "bed_history_plant_ref_check",
      sql`(canonical_plant_id IS NOT NULL AND provisional_plant_id IS NULL) OR (canonical_plant_id IS NULL AND provisional_plant_id IS NOT NULL)`,
    ),
  ],
);

export const plantPlacements = pgTable(
  "plant_placements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gardenId: uuid("garden_id")
      .notNull()
      .references(() => gardens.id, { onDelete: "cascade" }),
    bedAreaId: uuid("bed_area_id")
      .notNull()
      .references(() => gardenAreas.id, { onDelete: "cascade" }),
    canonicalPlantId: uuid("canonical_plant_id").references(() => canonicalPlants.id),
    provisionalPlantId: uuid("provisional_plant_id").references(() => userProvisionalPlants.id),
    positionX: decimal("position_x", { precision: 10, scale: 2 }).notNull(),
    positionY: decimal("position_y", { precision: 10, scale: 2 }).notNull(),
    status: placementStatusEnum("status").notNull(),
    plantedOn: date("planted_on").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("plant_placements_garden_id_idx").on(table.gardenId),
    index("plant_placements_bed_area_id_idx").on(table.bedAreaId),
    check(
      "plant_placements_plant_ref_check",
      sql`(canonical_plant_id IS NOT NULL AND provisional_plant_id IS NULL) OR (canonical_plant_id IS NULL AND provisional_plant_id IS NOT NULL)`,
    ),
  ],
);

export const indoorStarts = pgTable(
  "indoor_starts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gardenId: uuid("garden_id")
      .notNull()
      .references(() => gardens.id, { onDelete: "cascade" }),
    targetBedAreaId: uuid("target_bed_area_id").references(() => gardenAreas.id, {
      onDelete: "set null",
    }),
    canonicalPlantId: uuid("canonical_plant_id").references(() => canonicalPlants.id),
    provisionalPlantId: uuid("provisional_plant_id").references(() => userProvisionalPlants.id),
    startedOn: date("started_on").notNull(),
    status: indoorStartStatusEnum("status").notNull().default("active"),
    transplantedPlacementId: uuid("transplanted_placement_id").references(() => plantPlacements.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("indoor_starts_garden_status_idx").on(table.gardenId, table.status),
    index("indoor_starts_target_bed_idx").on(table.targetBedAreaId),
    check(
      "indoor_starts_plant_ref_check",
      sql`(canonical_plant_id IS NOT NULL AND provisional_plant_id IS NULL) OR (canonical_plant_id IS NULL AND provisional_plant_id IS NOT NULL)`,
    ),
  ],
);
