import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  smallint,
  jsonb,
  pgEnum,
  uniqueIndex,
  decimal,
  date,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { canonicalPlants, plantCategoryEnum } from "./plants";

export const linkStatusEnum = pgEnum("link_status", [
  "provisional",
  "link_offered",
  "linked",
]);

export const userLocations = pgTable("user_locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  cityOrPostal: varchar("city_or_postal", { length: 64 }).notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  usdaZone: smallint("usda_zone"),
  lastFrostDate: date("last_frost_date"),
  firstFrostDate: date("first_frost_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userProvisionalPlants = pgTable("user_provisional_plants", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  commonName: varchar("common_name", { length: 255 }).notNull(),
  plantCategory: plantCategoryEnum("plant_category").notNull(),
  spacingCm: jsonb("spacing_cm").notNull(),
  daysToMaturity: smallint("days_to_maturity").notNull(),
  optionalFields: jsonb("optional_fields"),
  linkedCanonicalId: uuid("linked_canonical_id").references(() => canonicalPlants.id),
  linkStatus: linkStatusEnum("link_status").notNull().default("provisional"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userRecentlyViewed = pgTable(
  "user_recently_viewed",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    plantId: uuid("plant_id")
      .notNull()
      .references(() => canonicalPlants.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("user_plant_view_unique").on(table.userId, table.plantId)],
);

export const userGardenPlantRefs = pgTable(
  "user_garden_plant_refs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    plantId: uuid("plant_id")
      .notNull()
      .references(() => canonicalPlants.id, { onDelete: "cascade" }),
    pinnedAt: timestamp("pinned_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("user_garden_plant_unique").on(table.userId, table.plantId)],
);
