import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  canonicalPlants,
  illustrationCategoryDefaults,
  planTemplates,
  plantIllustrations,
  structureTypes,
} from "@/lib/db/schema";
import type { GardenZoneType } from "@/lib/garden/enums";

const ALL_ZONES: GardenZoneType[] = ["vegetable_garden", "orchard", "container_patio"];

const CATEGORY_DEFAULTS = [
  { category: "vegetable" as const, path: "planner/categories/vegetable.svg" },
  { category: "herb" as const, path: "planner/categories/herb.svg" },
  { category: "fruit" as const, path: "planner/categories/fruit.svg" },
  { category: "tree" as const, path: "planner/categories/tree.svg" },
  { category: "flower" as const, path: "planner/categories/flower.svg" },
  { category: "default" as const, path: "planner/categories/default.svg" },
];

const LAUNCH_STRUCTURES: Array<{
  slug: string;
  name: string;
  category: "bed_frame" | "container" | "protection" | "vertical" | "access" | "amenity" | "other";
  defaultLength: string;
  defaultWidth: string;
  illustrationPath: string;
  environmentTag?: string;
  allowedZoneTypes: GardenZoneType[];
}> = [
  {
    slug: "raised_bed",
    name: "Raised bed",
    category: "bed_frame",
    defaultLength: "8",
    defaultWidth: "4",
    illustrationPath: "planner/structures/raised_bed.svg",
    allowedZoneTypes: ["vegetable_garden", "container_patio"],
  },
  {
    slug: "greenhouse",
    name: "Greenhouse",
    category: "protection",
    defaultLength: "8",
    defaultWidth: "12",
    illustrationPath: "planner/structures/greenhouse.svg",
    environmentTag: "greenhouse",
    allowedZoneTypes: ALL_ZONES,
  },
  {
    slug: "terracotta_pot",
    name: "Terracotta pot",
    category: "container",
    defaultLength: "2",
    defaultWidth: "2",
    illustrationPath: "planner/structures/terracotta_pot.svg",
    allowedZoneTypes: ["container_patio"],
  },
  {
    slug: "planter_box",
    name: "Planter box",
    category: "container",
    defaultLength: "3",
    defaultWidth: "2",
    illustrationPath: "planner/structures/raised_bed.svg",
    allowedZoneTypes: ["container_patio"],
  },
  {
    slug: "hanging_basket",
    name: "Hanging basket",
    category: "container",
    defaultLength: "1.5",
    defaultWidth: "1.5",
    illustrationPath: "planner/structures/terracotta_pot.svg",
    allowedZoneTypes: ["container_patio"],
  },
  {
    slug: "wine_barrel",
    name: "Wine barrel planter",
    category: "container",
    defaultLength: "2.5",
    defaultWidth: "2.5",
    illustrationPath: "planner/structures/terracotta_pot.svg",
    allowedZoneTypes: ["container_patio"],
  },
  {
    slug: "trellis",
    name: "Trellis",
    category: "vertical",
    defaultLength: "1",
    defaultWidth: "8",
    illustrationPath: "planner/structures/trellis.svg",
    allowedZoneTypes: ["vegetable_garden", "container_patio"],
  },
  {
    slug: "path",
    name: "Garden path",
    category: "access",
    defaultLength: "12",
    defaultWidth: "2",
    illustrationPath: "planner/structures/path.svg",
    allowedZoneTypes: ALL_ZONES,
  },
  {
    slug: "cold_frame",
    name: "Cold frame",
    category: "protection",
    defaultLength: "4",
    defaultWidth: "3",
    illustrationPath: "planner/structures/greenhouse.svg",
    environmentTag: "cold_frame",
    allowedZoneTypes: ALL_ZONES,
  },
  {
    slug: "compost_bin",
    name: "Compost bin",
    category: "amenity",
    defaultLength: "3",
    defaultWidth: "3",
    illustrationPath: "planner/structures/raised_bed.svg",
    allowedZoneTypes: ["vegetable_garden"],
  },
];

const TEMPLATE_SNAPSHOTS = [
  {
    slug: "beginner-vegetable",
    name: "Beginner Vegetable Garden",
    description: "Four raised beds with reliable starter crops",
    zoneType: "vegetable_garden" as const,
    previewImagePath: "planner/templates/beginner-vegetable.webp",
    sortOrder: 1,
    layoutSnapshot: {
      areas: [
        { area_type: "bed", name: "Bed 1", origin_x: 2, origin_y: 2, length: 8, width: 4 },
        { area_type: "bed", name: "Bed 2", origin_x: 12, origin_y: 2, length: 8, width: 4 },
      ],
      structures: [],
      placements: [],
    },
  },
  {
    slug: "salad-garden",
    name: "Salad Garden",
    description: "Compact beds for leafy greens and herbs",
    zoneType: "vegetable_garden" as const,
    previewImagePath: "planner/templates/salad-garden.webp",
    sortOrder: 2,
    layoutSnapshot: {
      areas: [{ area_type: "bed", name: "Salad bed", origin_x: 2, origin_y: 2, length: 10, width: 4 }],
      structures: [],
      placements: [],
    },
  },
  {
    slug: "small-orchard",
    name: "Small Orchard",
    description: "Starter fruit tree row with spacing guides",
    zoneType: "orchard" as const,
    previewImagePath: "planner/templates/small-orchard.webp",
    sortOrder: 3,
    layoutSnapshot: { areas: [], structures: [], placements: [] },
  },
  {
    slug: "fruit-tree-row",
    name: "Fruit Tree Row",
    description: "Linear orchard layout for backyard trees",
    zoneType: "orchard" as const,
    previewImagePath: "planner/templates/fruit-tree-row.webp",
    sortOrder: 4,
    layoutSnapshot: { areas: [], structures: [], placements: [] },
  },
  {
    slug: "balcony-containers",
    name: "Balcony Containers",
    description: "Pots and planters for patio growing",
    zoneType: "container_patio" as const,
    previewImagePath: "planner/templates/balcony-containers.webp",
    sortOrder: 5,
    layoutSnapshot: { areas: [], structures: [{ structure_type_slug: "terracotta_pot", origin_x: 2, origin_y: 2, length: 2, width: 2 }], placements: [] },
  },
  {
    slug: "patio-herbs",
    name: "Patio Herbs",
    description: "Small-space herb containers",
    zoneType: "container_patio" as const,
    previewImagePath: "planner/templates/patio-herbs.webp",
    sortOrder: 6,
    layoutSnapshot: { areas: [], structures: [{ structure_type_slug: "planter_box", origin_x: 2, origin_y: 2, length: 3, width: 2 }], placements: [] },
  },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function seedPlannerAssets(): Promise<{
  categories: number;
  structures: number;
  templates: number;
  plantIllustrations: number;
}> {
  for (const row of CATEGORY_DEFAULTS) {
    await db
      .insert(illustrationCategoryDefaults)
      .values({ category: row.category, illustrationPath: row.path })
      .onConflictDoUpdate({
        target: illustrationCategoryDefaults.category,
        set: { illustrationPath: row.path },
      });
  }

  for (const row of LAUNCH_STRUCTURES) {
    await db
      .insert(structureTypes)
      .values({
        slug: row.slug,
        name: row.name,
        category: row.category,
        defaultLength: row.defaultLength,
        defaultWidth: row.defaultWidth,
        illustrationPath: row.illustrationPath,
        environmentTag: row.environmentTag ?? null,
        allowedZoneTypes: row.allowedZoneTypes,
      })
      .onConflictDoUpdate({
        target: structureTypes.slug,
        set: {
          name: row.name,
          category: row.category,
          defaultLength: row.defaultLength,
          defaultWidth: row.defaultWidth,
          illustrationPath: row.illustrationPath,
          environmentTag: row.environmentTag ?? null,
          allowedZoneTypes: row.allowedZoneTypes,
        },
      });
  }

  for (const row of TEMPLATE_SNAPSHOTS) {
    await db
      .insert(planTemplates)
      .values({
        slug: row.slug,
        name: row.name,
        description: row.description,
        zoneType: row.zoneType,
        previewImagePath: row.previewImagePath,
        layoutSnapshot: row.layoutSnapshot,
        sortOrder: row.sortOrder,
      })
      .onConflictDoUpdate({
        target: planTemplates.slug,
        set: {
          name: row.name,
          description: row.description,
          zoneType: row.zoneType,
          previewImagePath: row.previewImagePath,
          layoutSnapshot: row.layoutSnapshot,
          sortOrder: row.sortOrder,
        },
      });
  }

  const plants = await db
    .select({ id: canonicalPlants.id, commonName: canonicalPlants.commonName })
    .from(canonicalPlants)
    .limit(200);

  let plantIllustrationCount = 0;
  for (const plant of plants) {
    const path = `planner/plants/${slugify(plant.commonName)}.svg`;
    await db
      .insert(plantIllustrations)
      .values({
        canonicalPlantId: plant.id,
        illustrationPath: path,
      })
      .onConflictDoUpdate({
        target: plantIllustrations.canonicalPlantId,
        set: { illustrationPath: path },
      });
    plantIllustrationCount += 1;
  }

  return {
    categories: CATEGORY_DEFAULTS.length,
    structures: LAUNCH_STRUCTURES.length,
    templates: TEMPLATE_SNAPSHOTS.length,
    plantIllustrations: plantIllustrationCount,
  };
}
