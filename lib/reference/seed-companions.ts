import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { canonicalPlants } from "@/lib/db/schema/plants";
import { plantRelationships, rootstockOptions } from "@/lib/db/schema/reference";
import { createStubPlant, getStubPlantByName } from "@/lib/catalog/stub-plants";

interface SeedPlant {
  commonName: string;
  botanicalName: string;
  plantCategory: "vegetable" | "herb" | "fruit_tree";
  daysToMaturity: number;
  spacingCm: { row: number; plant: number };
  sunExposure: "full" | "partial" | "shade";
  hardinessMinZone: number;
  hardinessMaxZone: number;
  companions: string[];
  incompatibles: string[];
  rootstocks?: Array<{
    name: string;
    vigor: "dwarf" | "semi_dwarf" | "standard" | "vigorous";
    matureHeightCm: number;
    matureSpreadCm: number;
    spacingCm: number;
  }>;
}

const SEED_PLANTS: SeedPlant[] = [
  {
    commonName: "Tomato",
    botanicalName: "Solanum lycopersicum",
    plantCategory: "vegetable",
    daysToMaturity: 80,
    spacingCm: { row: 90, plant: 45 },
    sunExposure: "full",
    hardinessMinZone: 5,
    hardinessMaxZone: 11,
    companions: ["Basil", "Marigold"],
    incompatibles: ["Fennel"],
  },
  {
    commonName: "Basil",
    botanicalName: "Ocimum basilicum",
    plantCategory: "herb",
    daysToMaturity: 60,
    spacingCm: { row: 30, plant: 20 },
    sunExposure: "full",
    hardinessMinZone: 5,
    hardinessMaxZone: 10,
    companions: ["Tomato"],
    incompatibles: [],
  },
  {
    commonName: "Fennel",
    botanicalName: "Foeniculum vulgare",
    plantCategory: "herb",
    daysToMaturity: 90,
    spacingCm: { row: 45, plant: 30 },
    sunExposure: "full",
    hardinessMinZone: 4,
    hardinessMaxZone: 9,
    companions: [],
    incompatibles: ["Tomato"],
  },
  {
    commonName: "Apple",
    botanicalName: "Malus domestica",
    plantCategory: "fruit_tree",
    daysToMaturity: 365,
    spacingCm: { row: 400, plant: 400 },
    sunExposure: "full",
    hardinessMinZone: 3,
    hardinessMaxZone: 8,
    companions: [],
    incompatibles: [],
    rootstocks: [
      {
        name: "M.9",
        vigor: "dwarf",
        matureHeightCm: 250,
        matureSpreadCm: 200,
        spacingCm: 300,
      },
    ],
  },
];

async function ensurePlant(seed: SeedPlant) {
  const existing = await db
    .select()
    .from(canonicalPlants)
    .where(eq(canonicalPlants.commonName, seed.commonName))
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  const [plant] = await db
    .insert(canonicalPlants)
    .values({
      commonName: seed.commonName,
      botanicalName: seed.botanicalName,
      plantCategory: seed.plantCategory,
      daysToMaturity: seed.daysToMaturity,
      spacingCm: seed.spacingCm,
      sunExposure: seed.sunExposure,
      hardinessMinZone: seed.hardinessMinZone,
      hardinessMaxZone: seed.hardinessMaxZone,
      fertilizerNeeds: "Compost at planting",
      recordStatus: "authoritative",
    })
    .returning();

  return plant;
}

async function ensureTarget(commonName: string, category: SeedPlant["plantCategory"]) {
  const existing = await getStubPlantByName(commonName);
  if (existing) return existing;
  return createStubPlant({ commonName, plantCategory: category });
}

export async function seedReferenceData() {
  const plantMap = new Map<string, string>();

  for (const seed of SEED_PLANTS) {
    const plant = await ensurePlant(seed);
    plantMap.set(seed.commonName, plant.id);

    if (seed.rootstocks) {
      for (const rootstock of seed.rootstocks) {
        await db
          .insert(rootstockOptions)
          .values({
            plantId: plant.id,
            name: rootstock.name,
            vigor: rootstock.vigor,
            matureHeightCm: rootstock.matureHeightCm,
            matureSpreadCm: rootstock.matureSpreadCm,
            spacingCm: rootstock.spacingCm,
          })
          .onConflictDoNothing();
      }
    }
  }

  for (const seed of SEED_PLANTS) {
    const sourceId = plantMap.get(seed.commonName)!;

    for (const companionName of seed.companions) {
      const target = await ensureTarget(companionName, "herb");
      await db
        .insert(plantRelationships)
        .values({
          sourcePlantId: sourceId,
          targetPlantId: target.id,
          relationshipType: "companion",
        })
        .onConflictDoNothing();
    }

    for (const incompatibleName of seed.incompatibles) {
      const target = await ensureTarget(incompatibleName, "herb");
      await db
        .insert(plantRelationships)
        .values({
          sourcePlantId: sourceId,
          targetPlantId: target.id,
          relationshipType: "incompatible",
        })
        .onConflictDoNothing();
    }
  }

  return SEED_PLANTS.length;
}
