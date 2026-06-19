import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  bedPlantingHistory,
  canonicalPlants,
  gardenAreas,
  gardens,
  indoorStarts,
  plantPlacements,
  userGardenPlantRefs,
  userProvisionalPlants,
} from "@/lib/db/schema";
import type {
  CreateAreaInput,
  CreateGardenInput,
  CreateIndoorStartInput,
  CreatePlacementInput,
  TransplantIndoorStartInput,
  UpdateAreaInput,
  UpdateGardenInput,
  UpdateIndoorStartInput,
  ValidatePlacementInput,
} from "./schemas";
import {
  InvalidRotationError,
  RotationNotAllowedError,
  assertRotationAllowed,
} from "./schemas";
import type {
  GardenArea,
  GardenDetail,
  GardenPlantRef,
  GardenSummary,
  IndoorStart,
  PlantPlacement,
  ValidationResult,
  ValidationWarning,
} from "./types";
import type { RotationDegrees } from "./enums";
import { resolvePlantSpacing } from "./plant-context";
import {
  assertAreasWithinGarden,
  assertValidAreaGeometry,
  AreaGeometryError,
  findAffectedPlacementsForAreaChange,
  findAffectedPlacementsForGardenChange,
  LayoutShrinkError,
  PlacementValidationError,
  validatePlacement,
} from "./validation";
import { bumpVersion, ConflictError } from "./version";
import { resolveClimateWarnings } from "./climate-warnings";
import { assertPlantingMethodAllowed, PlantingMethodError } from "./planting-methods";
import { getPlantById } from "@/lib/catalog/query";

export class GardenNotFoundError extends Error {
  readonly name = "GardenNotFoundError";
}

export class AreaNotFoundError extends Error {
  readonly name = "AreaNotFoundError";
}

export class PlacementNotFoundError extends Error {
  readonly name = "PlacementNotFoundError";
}

export class IndoorStartNotFoundError extends Error {
  readonly name = "IndoorStartNotFoundError";
}

export class IndoorStartStateError extends Error {
  readonly name = "IndoorStartStateError";

  constructor(message: string) {
    super(message);
  }
}

export { AreaGeometryError, RotationNotAllowedError, InvalidRotationError, PlacementValidationError, LayoutShrinkError, PlantingMethodError };

type DbExecutor = Pick<typeof db, "select" | "insert" | "update" | "delete" | "transaction">;

function toNumber(value: string | number): number {
  return typeof value === "number" ? value : parseFloat(value);
}

function mapArea(row: typeof gardenAreas.$inferSelect): GardenArea {
  return {
    id: row.id,
    area_type: row.areaType,
    name: row.name,
    origin_x: toNumber(row.originX),
    origin_y: toNumber(row.originY),
    length: toNumber(row.length),
    width: toNumber(row.width),
    rotation_degrees: row.rotationDegrees as RotationDegrees,
    soil_type: row.soilType,
    sun_exposure: row.sunExposure,
  };
}

function mapPlantRef(
  canonicalId: string | null,
  provisionalId: string | null,
  canonicalName: string | null,
  provisionalName: string | null,
): GardenPlantRef {
  if (canonicalId) {
    return {
      id: canonicalId,
      common_name: canonicalName ?? "Unknown plant",
      provenance: "authoritative",
    };
  }
  return {
    id: provisionalId!,
    common_name: provisionalName ?? "Unknown plant",
    provenance: "provisional",
  };
}

async function loadGardenDetail(gardenId: string, userId: string): Promise<GardenDetail | null> {
  const [garden] = await db
    .select()
    .from(gardens)
    .where(and(eq(gardens.id, gardenId), eq(gardens.userId, userId)))
    .limit(1);

  if (!garden) {
    return null;
  }

  const areas = await db
    .select()
    .from(gardenAreas)
    .where(eq(gardenAreas.gardenId, gardenId))
    .orderBy(gardenAreas.createdAt);

  const placementRows = await db
    .select({
      placement: plantPlacements,
      canonicalName: canonicalPlants.commonName,
      provisionalName: userProvisionalPlants.commonName,
    })
    .from(plantPlacements)
    .leftJoin(canonicalPlants, eq(plantPlacements.canonicalPlantId, canonicalPlants.id))
    .leftJoin(
      userProvisionalPlants,
      eq(plantPlacements.provisionalPlantId, userProvisionalPlants.id),
    )
    .where(eq(plantPlacements.gardenId, gardenId));

  const indoorRows = await db
    .select({
      start: indoorStarts,
      canonicalName: canonicalPlants.commonName,
      provisionalName: userProvisionalPlants.commonName,
    })
    .from(indoorStarts)
    .leftJoin(canonicalPlants, eq(indoorStarts.canonicalPlantId, canonicalPlants.id))
    .leftJoin(
      userProvisionalPlants,
      eq(indoorStarts.provisionalPlantId, userProvisionalPlants.id),
    )
    .where(eq(indoorStarts.gardenId, gardenId));

  const placements: PlantPlacement[] = [];
  for (const { placement, canonicalName, provisionalName } of placementRows) {
    const plant = mapPlantRef(
      placement.canonicalPlantId,
      placement.provisionalPlantId,
      canonicalName,
      provisionalName,
    );
    const spacing = await resolvePlantSpacing(
      plant.id,
      plant.provenance,
      userId,
      garden.unit,
    );
    placements.push({
      id: placement.id,
      bed_area_id: placement.bedAreaId,
      plant,
      position_x: toNumber(placement.positionX),
      position_y: toNumber(placement.positionY),
      status: placement.status,
      planted_on: placement.plantedOn,
      spacing_radius: spacing?.spacing_radius ?? 0,
    });
  }

  const indoor_starts: IndoorStart[] = indoorRows.map(({ start, canonicalName, provisionalName }) => ({
    id: start.id,
    plant: mapPlantRef(
      start.canonicalPlantId,
      start.provisionalPlantId,
      canonicalName,
      provisionalName,
    ),
    target_bed_area_id: start.targetBedAreaId,
    started_on: start.startedOn,
    status: start.status,
  }));

  return {
    id: garden.id,
    name: garden.name,
    length: toNumber(garden.length),
    width: toNumber(garden.width),
    unit: garden.unit,
    description: garden.description,
    version: garden.version,
    areas: areas.map(mapArea),
    placements,
    indoor_starts,
  };
}

export async function assertGardenOwner(gardenId: string, userId: string) {
  const [garden] = await db
    .select()
    .from(gardens)
    .where(and(eq(gardens.id, gardenId), eq(gardens.userId, userId)))
    .limit(1);

  if (!garden) {
    throw new GardenNotFoundError();
  }

  return garden;
}

export async function getGardenDetail(
  gardenId: string,
  userId: string,
): Promise<GardenDetail | null> {
  return loadGardenDetail(gardenId, userId);
}

export async function withGardenTransaction<T>(
  fn: (tx: DbExecutor) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => fn(tx));
}

export async function listGardens(userId: string): Promise<GardenSummary[]> {
  const gardenRows = await db
    .select()
    .from(gardens)
    .where(eq(gardens.userId, userId))
    .orderBy(desc(gardens.updatedAt));

  const summaries: GardenSummary[] = [];

  for (const garden of gardenRows) {
    const [bedCountRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(gardenAreas)
      .where(and(eq(gardenAreas.gardenId, garden.id), eq(gardenAreas.areaType, "bed")));

    const [placementCountRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(plantPlacements)
      .where(eq(plantPlacements.gardenId, garden.id));

    summaries.push({
      id: garden.id,
      name: garden.name,
      length: toNumber(garden.length),
      width: toNumber(garden.width),
      unit: garden.unit,
      version: garden.version,
      updated_at: garden.updatedAt.toISOString(),
      bed_count: bedCountRow?.count ?? 0,
      placement_count: placementCountRow?.count ?? 0,
    });
  }

  return summaries;
}

export async function createGarden(
  userId: string,
  input: CreateGardenInput,
): Promise<GardenDetail> {
  const [created] = await db
    .insert(gardens)
    .values({
      userId,
      name: input.name,
      description: input.description ?? null,
      length: input.length.toString(),
      width: input.width.toString(),
      unit: input.unit,
    })
    .returning();

  const detail = await loadGardenDetail(created.id, userId);
  if (!detail) {
    throw new GardenNotFoundError();
  }
  return detail;
}

async function evictPlacements(gardenId: string, placementIds: string[]) {
  if (placementIds.length === 0) {
    return;
  }
  await db
    .delete(plantPlacements)
    .where(
      and(eq(plantPlacements.gardenId, gardenId), inArray(plantPlacements.id, placementIds)),
    );
}

export async function updateGarden(
  gardenId: string,
  userId: string,
  input: UpdateGardenInput,
): Promise<GardenDetail> {
  const garden = await ensureGardenVersion(gardenId, userId, input.expected_version);
  const detail = await loadGardenDetail(gardenId, userId);
  if (!detail) {
    throw new GardenNotFoundError();
  }

  const nextLength = input.length ?? detail.length;
  const nextWidth = input.width ?? detail.width;
  const nextBounds = { length: nextLength, width: nextWidth };

  assertAreasWithinGarden(detail.areas, nextBounds);

  const affected = findAffectedPlacementsForGardenChange(detail, nextLength, nextWidth);
  if (affected.length > 0 && !input.evict_affected_placements) {
    throw new LayoutShrinkError(affected);
  }

  if (affected.length > 0) {
    await evictPlacements(gardenId, affected);
  }

  await db
    .update(gardens)
    .set({
      name: input.name ?? garden.name,
      description: input.description !== undefined ? input.description : garden.description,
      length: nextLength.toString(),
      width: nextWidth.toString(),
      version: bumpVersion(garden.version),
      updatedAt: new Date(),
    })
    .where(eq(gardens.id, gardenId));

  const updated = await loadGardenDetail(gardenId, userId);
  if (!updated) {
    throw new GardenNotFoundError();
  }
  return updated;
}

export async function deleteGarden(
  gardenId: string,
  userId: string,
  expectedVersion?: number,
): Promise<void> {
  await ensureGardenVersion(gardenId, userId, expectedVersion);
  await db.delete(gardens).where(eq(gardens.id, gardenId));
}

async function ensureGardenVersion(
  gardenId: string,
  userId: string,
  expectedVersion?: number,
) {
  const garden = await assertGardenOwner(gardenId, userId);
  if (expectedVersion != null && expectedVersion !== garden.version) {
    const current = await loadGardenDetail(gardenId, userId);
    if (!current) {
      throw new GardenNotFoundError();
    }
    throw new ConflictError(current);
  }
  return garden;
}

async function touchGarden(gardenId: string, currentVersion: number) {
  await db
    .update(gardens)
    .set({
      version: bumpVersion(currentVersion),
      updatedAt: new Date(),
    })
    .where(eq(gardens.id, gardenId));
}

function bedMetadataForAreaType(
  areaType: GardenArea["area_type"],
  soilType: CreateAreaInput["soil_type"] | UpdateAreaInput["soil_type"],
  sunExposure: CreateAreaInput["sun_exposure"] | UpdateAreaInput["sun_exposure"],
) {
  if (areaType === "path") {
    return { soilType: null, sunExposure: null };
  }
  return {
    soilType: soilType ?? null,
    sunExposure: sunExposure ?? null,
  };
}

export async function createArea(
  gardenId: string,
  userId: string,
  input: CreateAreaInput,
): Promise<GardenDetail> {
  const garden = await ensureGardenVersion(gardenId, userId, input.expected_version);
  assertRotationAllowed(input.rotation_degrees);

  const detail = await loadGardenDetail(gardenId, userId);
  if (!detail) {
    throw new GardenNotFoundError();
  }

  const candidate = {
    origin_x: input.origin_x,
    origin_y: input.origin_y,
    length: input.length,
    width: input.width,
    rotation_degrees: (input.rotation_degrees ?? 0) as RotationDegrees,
  };

  assertValidAreaGeometry(
    candidate,
    { length: detail.length, width: detail.width },
    detail.areas,
  );

  const metadata = bedMetadataForAreaType(input.area_type, input.soil_type, input.sun_exposure);

  await db.insert(gardenAreas).values({
    gardenId,
    areaType: input.area_type,
    name: input.name ?? null,
    originX: input.origin_x.toString(),
    originY: input.origin_y.toString(),
    length: input.length.toString(),
    width: input.width.toString(),
    rotationDegrees: input.rotation_degrees ?? 0,
    soilType: metadata.soilType,
    sunExposure: metadata.sunExposure,
  });

  await touchGarden(gardenId, garden.version);

  const updated = await loadGardenDetail(gardenId, userId);
  if (!updated) {
    throw new GardenNotFoundError();
  }
  return updated;
}

export async function updateArea(
  gardenId: string,
  userId: string,
  areaId: string,
  input: UpdateAreaInput,
): Promise<GardenDetail> {
  const garden = await ensureGardenVersion(gardenId, userId, input.expected_version);

  const [existing] = await db
    .select()
    .from(gardenAreas)
    .where(and(eq(gardenAreas.id, areaId), eq(gardenAreas.gardenId, gardenId)))
    .limit(1);

  if (!existing) {
    throw new AreaNotFoundError();
  }

  if (input.rotation_degrees != null) {
    assertRotationAllowed(input.rotation_degrees);
  }

  const detail = await loadGardenDetail(gardenId, userId);
  if (!detail) {
    throw new GardenNotFoundError();
  }

  const mergedType = input.area_type ?? existing.areaType;
  const merged = {
    origin_x: input.origin_x ?? toNumber(existing.originX),
    origin_y: input.origin_y ?? toNumber(existing.originY),
    length: input.length ?? toNumber(existing.length),
    width: input.width ?? toNumber(existing.width),
    rotation_degrees: (input.rotation_degrees ?? existing.rotationDegrees) as RotationDegrees,
  };

  assertValidAreaGeometry(
    merged,
    { length: detail.length, width: detail.width },
    detail.areas,
    areaId,
  );

  const affected = findAffectedPlacementsForAreaChange(areaId, merged, detail.placements);
  if (affected.length > 0 && !input.evict_affected_placements) {
    throw new LayoutShrinkError(affected);
  }

  if (affected.length > 0) {
    await evictPlacements(gardenId, affected);
  }

  const metadata = bedMetadataForAreaType(
    mergedType,
    input.soil_type !== undefined ? input.soil_type : existing.soilType,
    input.sun_exposure !== undefined ? input.sun_exposure : existing.sunExposure,
  );

  await db
    .update(gardenAreas)
    .set({
      areaType: mergedType,
      name: input.name !== undefined ? input.name : existing.name,
      originX: merged.origin_x.toString(),
      originY: merged.origin_y.toString(),
      length: merged.length.toString(),
      width: merged.width.toString(),
      rotationDegrees: merged.rotation_degrees,
      soilType: metadata.soilType,
      sunExposure: metadata.sunExposure,
      updatedAt: new Date(),
    })
    .where(eq(gardenAreas.id, areaId));

  await touchGarden(gardenId, garden.version);

  const updated = await loadGardenDetail(gardenId, userId);
  if (!updated) {
    throw new GardenNotFoundError();
  }
  return updated;
}

export async function deleteArea(
  gardenId: string,
  userId: string,
  areaId: string,
  expectedVersion?: number,
): Promise<GardenDetail> {
  const garden = await ensureGardenVersion(gardenId, userId, expectedVersion);

  const [existing] = await db
    .select()
    .from(gardenAreas)
    .where(and(eq(gardenAreas.id, areaId), eq(gardenAreas.gardenId, gardenId)))
    .limit(1);

  if (!existing) {
    throw new AreaNotFoundError();
  }

  await db.delete(plantPlacements).where(eq(plantPlacements.bedAreaId, areaId));
  await db.delete(gardenAreas).where(eq(gardenAreas.id, areaId));
  await touchGarden(gardenId, garden.version);

  const updated = await loadGardenDetail(gardenId, userId);
  if (!updated) {
    throw new GardenNotFoundError();
  }
  return updated;
}

async function upsertGardenPlantRef(userId: string, plantId: string, provenance: string) {
  if (provenance !== "authoritative") {
    return;
  }
  await db
    .insert(userGardenPlantRefs)
    .values({ userId, plantId })
    .onConflictDoNothing();
}

export async function validatePlacementDryRun(
  gardenId: string,
  userId: string,
  input: ValidatePlacementInput,
): Promise<ValidationResult> {
  const detail = await loadGardenDetail(gardenId, userId);
  if (!detail) {
    throw new GardenNotFoundError();
  }
  const result = await validatePlacement(
    detail,
    {
      bed_area_id: input.bed_area_id,
      plant_id: input.plant_id,
      plant_provenance: input.plant_provenance,
      position_x: input.position_x,
      position_y: input.position_y,
    },
    userId,
  );

  const climateWarnings = await resolveClimateWarnings(
    userId,
    input.plant_id,
    input.plant_provenance,
    input.planted_on,
    input.planting_context ?? "direct_seed",
  );

  return {
    ...result,
    warnings: [...result.warnings, ...climateWarnings],
  };
}

export async function createDirectSeed(
  gardenId: string,
  userId: string,
  input: CreatePlacementInput,
): Promise<{ garden: GardenDetail; warnings: ValidationWarning[] }> {
  const garden = await ensureGardenVersion(gardenId, userId, input.expected_version);
  const detail = await loadGardenDetail(gardenId, userId);
  if (!detail) {
    throw new GardenNotFoundError();
  }

  const validation = await validatePlacement(
    detail,
    {
      bed_area_id: input.bed_area_id,
      plant_id: input.plant_id,
      plant_provenance: input.plant_provenance,
      position_x: input.position_x,
      position_y: input.position_y,
    },
    userId,
  );

  if (!validation.valid) {
    throw new PlacementValidationError(validation.violations);
  }

  const plantValues =
    input.plant_provenance === "authoritative"
      ? { canonicalPlantId: input.plant_id, provisionalPlantId: null }
      : { canonicalPlantId: null, provisionalPlantId: input.plant_id };

  await db.insert(plantPlacements).values({
    gardenId,
    bedAreaId: input.bed_area_id,
    ...plantValues,
    positionX: input.position_x.toString(),
    positionY: input.position_y.toString(),
    status: "direct_seeded",
    plantedOn: input.planted_on,
  });

  await db.insert(bedPlantingHistory).values({
    gardenId,
    bedAreaId: input.bed_area_id,
    ...plantValues,
    rotationGroup: null,
    botanicalFamily: null,
    plantedOn: input.planted_on,
  });

  await upsertGardenPlantRef(userId, input.plant_id, input.plant_provenance);
  await touchGarden(gardenId, garden.version);

  const updated = await loadGardenDetail(gardenId, userId);
  if (!updated) {
    throw new GardenNotFoundError();
  }

  const climateWarnings = await resolveClimateWarnings(
    userId,
    input.plant_id,
    input.plant_provenance,
    input.planted_on,
    "direct_seed",
  );

  return { garden: updated, warnings: climateWarnings };
}

export async function deletePlacement(
  gardenId: string,
  userId: string,
  placementId: string,
  expectedVersion?: number,
): Promise<GardenDetail> {
  const garden = await ensureGardenVersion(gardenId, userId, expectedVersion);

  const [existing] = await db
    .select()
    .from(plantPlacements)
    .where(and(eq(plantPlacements.id, placementId), eq(plantPlacements.gardenId, gardenId)))
    .limit(1);

  if (!existing) {
    throw new PlacementNotFoundError();
  }

  await db.delete(plantPlacements).where(eq(plantPlacements.id, placementId));
  await touchGarden(gardenId, garden.version);

  const updated = await loadGardenDetail(gardenId, userId);
  if (!updated) {
    throw new GardenNotFoundError();
  }
  return updated;
}

function plantRefValues(provenance: string, plantId: string) {
  return provenance === "authoritative"
    ? { canonicalPlantId: plantId, provisionalPlantId: null }
    : { canonicalPlantId: null, provisionalPlantId: plantId };
}

function assertTargetBed(detail: GardenDetail, bedAreaId: string) {
  const bed = detail.areas.find((area) => area.id === bedAreaId);
  if (!bed || bed.area_type !== "bed") {
    throw new IndoorStartStateError("Target bed must be a plantable bed in this garden");
  }
  return bed;
}

async function loadIndoorStart(gardenId: string, startId: string) {
  const [start] = await db
    .select()
    .from(indoorStarts)
    .where(and(eq(indoorStarts.id, startId), eq(indoorStarts.gardenId, gardenId)))
    .limit(1);

  if (!start) {
    throw new IndoorStartNotFoundError();
  }

  return start;
}

export async function createIndoorStart(
  gardenId: string,
  userId: string,
  input: CreateIndoorStartInput,
): Promise<{ garden: GardenDetail; warnings: ValidationWarning[] }> {
  const garden = await ensureGardenVersion(gardenId, userId, input.expected_version);
  const detail = await loadGardenDetail(gardenId, userId);
  if (!detail) {
    throw new GardenNotFoundError();
  }

  assertTargetBed(detail, input.target_bed_area_id);

  if (input.plant_provenance === "authoritative") {
    const plant = await getPlantById(input.plant_id, userId);
    assertPlantingMethodAllowed(plant, "indoor_start");
  }

  await db.insert(indoorStarts).values({
    gardenId,
    targetBedAreaId: input.target_bed_area_id,
    ...plantRefValues(input.plant_provenance, input.plant_id),
    startedOn: input.started_on,
    status: "active",
  });

  await upsertGardenPlantRef(userId, input.plant_id, input.plant_provenance);
  await touchGarden(gardenId, garden.version);

  const updated = await loadGardenDetail(gardenId, userId);
  if (!updated) {
    throw new GardenNotFoundError();
  }

  const warnings = await resolveClimateWarnings(
    userId,
    input.plant_id,
    input.plant_provenance,
    input.started_on,
    "indoor_start",
  );

  return { garden: updated, warnings };
}

export async function cancelIndoorStart(
  gardenId: string,
  userId: string,
  startId: string,
  expectedVersion?: number,
): Promise<GardenDetail> {
  const garden = await ensureGardenVersion(gardenId, userId, expectedVersion);
  const start = await loadIndoorStart(gardenId, startId);

  if (start.status !== "active") {
    throw new IndoorStartStateError("Only active indoor starts can be cancelled");
  }

  await db
    .update(indoorStarts)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(indoorStarts.id, startId));

  await touchGarden(gardenId, garden.version);

  const updated = await loadGardenDetail(gardenId, userId);
  if (!updated) {
    throw new GardenNotFoundError();
  }
  return updated;
}

export async function reassignIndoorStart(
  gardenId: string,
  userId: string,
  startId: string,
  input: UpdateIndoorStartInput,
): Promise<GardenDetail> {
  const garden = await ensureGardenVersion(gardenId, userId, input.expected_version);
  const start = await loadIndoorStart(gardenId, startId);

  if (start.status !== "active") {
    throw new IndoorStartStateError("Only active indoor starts can be reassigned");
  }

  const detail = await loadGardenDetail(gardenId, userId);
  if (!detail) {
    throw new GardenNotFoundError();
  }

  if (input.target_bed_area_id) {
    assertTargetBed(detail, input.target_bed_area_id);
  }

  await db
    .update(indoorStarts)
    .set({
      targetBedAreaId: input.target_bed_area_id ?? null,
      updatedAt: new Date(),
    })
    .where(eq(indoorStarts.id, startId));

  await touchGarden(gardenId, garden.version);

  const updated = await loadGardenDetail(gardenId, userId);
  if (!updated) {
    throw new GardenNotFoundError();
  }
  return updated;
}

export async function transplantIndoorStart(
  gardenId: string,
  userId: string,
  startId: string,
  input: TransplantIndoorStartInput,
): Promise<{ garden: GardenDetail; warnings: ValidationWarning[] }> {
  const garden = await ensureGardenVersion(gardenId, userId, input.expected_version);
  const start = await loadIndoorStart(gardenId, startId);

  if (start.status !== "active") {
    throw new IndoorStartStateError("Only active indoor starts can be transplanted");
  }

  if (!start.targetBedAreaId) {
    throw new IndoorStartStateError("Assign a target bed before transplanting");
  }

  const detail = await loadGardenDetail(gardenId, userId);
  if (!detail) {
    throw new GardenNotFoundError();
  }

  const plantId = start.canonicalPlantId ?? start.provisionalPlantId!;
  const provenance = start.canonicalPlantId ? "authoritative" : "provisional";

  const validation = await validatePlacement(
    detail,
    {
      bed_area_id: start.targetBedAreaId,
      plant_id: plantId,
      plant_provenance: provenance,
      position_x: input.position_x,
      position_y: input.position_y,
    },
    userId,
  );

  if (!validation.valid) {
    throw new PlacementValidationError(validation.violations);
  }

  const climateWarnings = await resolveClimateWarnings(
    userId,
    plantId,
    provenance,
    input.planted_on,
    "transplant",
  );

  const plantValues = start.canonicalPlantId
    ? { canonicalPlantId: start.canonicalPlantId, provisionalPlantId: null }
    : { canonicalPlantId: null, provisionalPlantId: start.provisionalPlantId };

  const [placement] = await db
    .insert(plantPlacements)
    .values({
      gardenId,
      bedAreaId: start.targetBedAreaId,
      ...plantValues,
      positionX: input.position_x.toString(),
      positionY: input.position_y.toString(),
      status: "transplanted",
      plantedOn: input.planted_on,
    })
    .returning();

  await db.insert(bedPlantingHistory).values({
    gardenId,
    bedAreaId: start.targetBedAreaId,
    ...plantValues,
    rotationGroup: null,
    botanicalFamily: null,
    plantedOn: input.planted_on,
  });

  await db
    .update(indoorStarts)
    .set({
      status: "transplanted",
      transplantedPlacementId: placement.id,
      updatedAt: new Date(),
    })
    .where(eq(indoorStarts.id, startId));

  await touchGarden(gardenId, garden.version);

  const updated = await loadGardenDetail(gardenId, userId);
  if (!updated) {
    throw new GardenNotFoundError();
  }

  return { garden: updated, warnings: climateWarnings };
}
