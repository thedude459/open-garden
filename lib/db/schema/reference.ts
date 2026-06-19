import {
  pgTable,
  uuid,
  varchar,
  text,
  smallint,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { canonicalPlants } from "./plants";

export const relationshipTypeEnum = pgEnum("relationship_type", [
  "companion",
  "incompatible",
]);

export const relationshipSourceEnum = pgEnum("relationship_source", ["curated"]);

export const vigorEnum = pgEnum("vigor", [
  "dwarf",
  "semi_dwarf",
  "standard",
  "vigorous",
]);

export const plantRelationships = pgTable(
  "plant_relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourcePlantId: uuid("source_plant_id")
      .notNull()
      .references(() => canonicalPlants.id, { onDelete: "cascade" }),
    targetPlantId: uuid("target_plant_id")
      .notNull()
      .references(() => canonicalPlants.id, { onDelete: "cascade" }),
    relationshipType: relationshipTypeEnum("relationship_type").notNull(),
    source: relationshipSourceEnum("source").notNull().default("curated"),
    notes: text("notes"),
  },
  (table) => [
    uniqueIndex("relationship_unique").on(
      table.sourcePlantId,
      table.targetPlantId,
      table.relationshipType,
    ),
  ],
);

export const rootstockOptions = pgTable("rootstock_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  plantId: uuid("plant_id")
    .notNull()
    .references(() => canonicalPlants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 128 }).notNull(),
  vigor: vigorEnum("vigor").notNull(),
  matureHeightCm: smallint("mature_height_cm"),
  matureSpreadCm: smallint("mature_spread_cm"),
  spacingCm: smallint("spacing_cm"),
  notes: text("notes"),
});
