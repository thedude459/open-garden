import type { Page } from "@playwright/test";
import type { GardenZoneType } from "@/lib/garden/enums";

export interface GardenSummary {
  id: string;
  name: string;
  length: number;
  width: number;
  unit: string;
  zone_type?: GardenZoneType;
  version?: number;
}

export interface AreaSummary {
  id: string;
  area_type: "bed" | "path";
  origin_x: number;
  origin_y: number;
  length: number;
  width: number;
}

export interface CreateGardenInput {
  name?: string;
  length?: number;
  width?: number;
  unit?: "feet" | "meters";
  zone_type?: GardenZoneType;
}

export interface CreateAreaInput {
  area_type: "bed" | "path";
  name?: string | null;
  origin_x: number;
  origin_y: number;
  length: number;
  width: number;
  soil_type?: string | null;
  sun_exposure?: string | null;
}

export async function createGardenViaApi(
  page: Page,
  partial: CreateGardenInput = {},
): Promise<GardenSummary> {
  const payload = {
    name: partial.name ?? `E2E Garden ${Date.now()}`,
    length: partial.length ?? 20,
    width: partial.width ?? 10,
    unit: partial.unit ?? "feet",
    zone_type: partial.zone_type ?? "vegetable_garden",
  };

  const response = await page.request.post("/api/gardens", { data: payload });
  if (!response.ok()) {
    throw new Error(`create garden failed: ${response.status()} ${await response.text()}`);
  }
  const garden = await response.json();
  return {
    id: garden.id,
    name: garden.name,
    length: Number(garden.length),
    width: Number(garden.width),
    unit: garden.unit,
    zone_type: garden.zone_type,
    version: garden.version,
  };
}

export async function addAreaViaApi(
  page: Page,
  gardenId: string,
  area: CreateAreaInput,
  expectedVersion?: number,
): Promise<AreaSummary> {
  const response = await page.request.post(`/api/gardens/${gardenId}/areas`, {
    data: {
      expected_version: expectedVersion,
      area_type: area.area_type,
      name: area.name ?? null,
      origin_x: area.origin_x,
      origin_y: area.origin_y,
      length: area.length,
      width: area.width,
      rotation_degrees: 0,
      soil_type: area.soil_type ?? null,
      sun_exposure: area.sun_exposure ?? null,
    },
  });

  if (!response.ok()) {
    throw new Error(`create area failed: ${response.status()} ${await response.text()}`);
  }

  const garden = await response.json();
  const created = garden.areas.at(-1);
  return {
    id: created.id,
    area_type: created.area_type,
    origin_x: Number(created.origin_x),
    origin_y: Number(created.origin_y),
    length: Number(created.length),
    width: Number(created.width),
  };
}

export async function getPlantIdByName(page: Page, commonName: string): Promise<string> {
  const response = await page.request.get(
    `/api/plants/search?q=${encodeURIComponent(commonName)}`,
  );
  if (!response.ok()) {
    throw new Error(`plant search failed: ${response.status()}`);
  }
  const body = await response.json();
  const match = (body.results ?? []).find(
    (plant: { common_name: string }) =>
      plant.common_name.toLowerCase() === commonName.toLowerCase(),
  );
  if (!match) {
    throw new Error(`Plant not found in catalog: ${commonName}`);
  }
  return match.id as string;
}

export async function placePlantViaApi(
  page: Page,
  gardenId: string,
  input: {
    bedAreaId: string;
    plantId: string;
    position_x: number;
    position_y: number;
    planted_on?: string;
    expected_version?: number;
  },
): Promise<void> {
  const response = await page.request.post(`/api/gardens/${gardenId}/placements`, {
    data: {
      expected_version: input.expected_version,
      bed_area_id: input.bedAreaId,
      plant_id: input.plantId,
      plant_provenance: "authoritative",
      position_x: input.position_x,
      position_y: input.position_y,
      planted_on: input.planted_on ?? new Date().toISOString().slice(0, 10),
    },
  });
  if (!response.ok()) {
    throw new Error(`place plant failed: ${response.status()} ${await response.text()}`);
  }
}

export async function createIndoorStartViaApi(
  page: Page,
  gardenId: string,
  input: {
    bedAreaId: string;
    plantId: string;
    started_on?: string;
    expected_version?: number;
  },
): Promise<string> {
  const response = await page.request.post(`/api/gardens/${gardenId}/indoor-starts`, {
    data: {
      expected_version: input.expected_version,
      target_bed_area_id: input.bedAreaId,
      plant_id: input.plantId,
      plant_provenance: "authoritative",
      started_on: input.started_on ?? new Date().toISOString().slice(0, 10),
    },
  });
  if (!response.ok()) {
    throw new Error(`indoor start failed: ${response.status()} ${await response.text()}`);
  }
  const body = await response.json();
  const start = body.indoor_starts?.find((item: { status: string }) => item.status === "active");
  return start?.id ?? body.id;
}

export async function getRootstockIdForPlant(page: Page, plantId: string): Promise<string> {
  const response = await page.request.get(`/api/plants/${plantId}/rootstocks`);
  if (!response.ok()) {
    throw new Error(`rootstock lookup failed: ${response.status()}`);
  }
  const body = await response.json();
  const rootstock = body.rootstocks?.[0];
  if (!rootstock?.id) {
    throw new Error(`No rootstock options for plant ${plantId}`);
  }
  return rootstock.id as string;
}

export async function createGardenWithBed(
  page: Page,
  partial: CreateGardenInput = {},
): Promise<{ garden: GardenSummary; bed: AreaSummary }> {
  const garden = await createGardenViaApi(page, partial);
  const bed = await addAreaViaApi(page, garden.id, {
    area_type: "bed",
    name: "Main bed",
    origin_x: 2,
    origin_y: 2,
    length: 8,
    width: 6,
  }, garden.version);
  return { garden, bed };
}
