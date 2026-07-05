import {
  pgTable,
  uuid,
  varchar,
  text,
  smallint,
  integer,
  boolean,
  decimal,
  jsonb,
  pgEnum,
  index,
  timestamp,
} from "drizzle-orm/pg-core";
import { canonicalPlants } from "./plants";
import { gardens, gardenZoneTypeEnum } from "./gardens";

export { gardenZoneTypeEnum };

export const structureCategoryEnum = pgEnum("structure_category", [
  "bed_frame",
  "container",
  "protection",
  "vertical",
  "access",
  "amenity",
  "other",
]);

export const illustrationCategoryEnum = pgEnum("illustration_category", [
  "vegetable",
  "herb",
  "fruit",
  "tree",
  "flower",
  "default",
]);

export const structureTypes = pgTable("structure_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  category: structureCategoryEnum("category").notNull(),
  defaultLength: decimal("default_length", { precision: 10, scale: 2 }).notNull(),
  defaultWidth: decimal("default_width", { precision: 10, scale: 2 }).notNull(),
  illustrationPath: varchar("illustration_path", { length: 256 }).notNull(),
  environmentTag: varchar("environment_tag", { length: 32 }),
  allowedZoneTypes: gardenZoneTypeEnum("allowed_zone_types").array().notNull(),
});

export const gardenStructures = pgTable(
  "garden_structures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gardenId: uuid("garden_id")
      .notNull()
      .references(() => gardens.id, { onDelete: "cascade" }),
    structureTypeId: uuid("structure_type_id")
      .notNull()
      .references(() => structureTypes.id),
    originX: decimal("origin_x", { precision: 10, scale: 2 }).notNull(),
    originY: decimal("origin_y", { precision: 10, scale: 2 }).notNull(),
    length: decimal("length", { precision: 10, scale: 2 }).notNull(),
    width: decimal("width", { precision: 10, scale: 2 }).notNull(),
    rotationDegrees: smallint("rotation_degrees").notNull().default(0),
    zIndex: integer("z_index").notNull().default(0),
    locked: boolean("locked").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("garden_structures_garden_id_idx").on(table.gardenId)],
);

export const plantIllustrations = pgTable(
  "plant_illustrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    canonicalPlantId: uuid("canonical_plant_id")
      .notNull()
      .references(() => canonicalPlants.id, { onDelete: "cascade" })
      .unique(),
    illustrationPath: varchar("illustration_path", { length: 256 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
);

export const illustrationCategoryDefaults = pgTable("illustration_category_defaults", {
  category: illustrationCategoryEnum("category").primaryKey(),
  illustrationPath: varchar("illustration_path", { length: 256 }).notNull(),
});

export const planTemplates = pgTable("plan_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description").notNull(),
  zoneType: gardenZoneTypeEnum("zone_type").notNull(),
  previewImagePath: varchar("preview_image_path", { length: 256 }).notNull(),
  layoutSnapshot: jsonb("layout_snapshot").notNull(),
  sortOrder: smallint("sort_order").notNull().default(0),
});
