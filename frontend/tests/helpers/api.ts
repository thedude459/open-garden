import { APIRequestContext, expect } from "@playwright/test";

import { uid } from "./auth";

export const API = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";

export type TestGarden = {
  id: number;
  name: string;
};

export type TestBed = {
  id: number;
  name: string;
  garden_id: number;
};

export type GardenCreatePayload = {
  name?: string;
  description?: string;
  zip_code?: string;
  yard_width_ft?: number;
  yard_length_ft?: number;
};

export type BedCreatePayload = {
  name?: string;
  width_in?: number;
  height_in?: number;
  grid_x?: number;
  grid_y?: number;
};

export type CropTemplateCreatePayload = {
  name?: string;
  variety?: string;
  spacing_in?: number;
  days_to_harvest?: number;
};

export type TestCropTemplate = {
  id: number;
  name: string;
};

export function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function createTestGarden(
  request: APIRequestContext,
  token: string,
  overrides: GardenCreatePayload = {},
): Promise<TestGarden> {
  const name = overrides.name ?? uid("E2E Garden");
  const response = await request.post(`${API}/gardens`, {
    headers: authHeaders(token),
    data: {
      name,
      description: overrides.description ?? "",
      zip_code: overrides.zip_code ?? "94110",
      yard_width_ft: overrides.yard_width_ft ?? 20,
      yard_length_ft: overrides.yard_length_ft ?? 20,
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const garden = (await response.json()) as { id: number; name: string };
  return { id: garden.id, name: garden.name ?? name };
}

export async function createTestBed(
  request: APIRequestContext,
  token: string,
  gardenId: number,
  overrides: BedCreatePayload = {},
): Promise<TestBed> {
  const name = overrides.name ?? uid("E2E Bed");
  const response = await request.post(`${API}/gardens/${gardenId}/beds`, {
    headers: authHeaders(token),
    data: {
      name,
      width_in: overrides.width_in ?? 48,
      height_in: overrides.height_in ?? 96,
      grid_x: overrides.grid_x ?? 2,
      grid_y: overrides.grid_y ?? 2,
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const bed = (await response.json()) as { id: number; name: string };
  return { id: bed.id, name: bed.name ?? name, garden_id: gardenId };
}

export async function createTestCropTemplate(
  request: APIRequestContext,
  token: string,
  overrides: CropTemplateCreatePayload = {},
): Promise<TestCropTemplate> {
  const name = overrides.name ?? uid("E2E Crop");
  const response = await request.post(`${API}/crop-templates`, {
    headers: authHeaders(token),
    data: {
      name,
      variety: overrides.variety ?? "",
      family: "Testaceae",
      spacing_in: overrides.spacing_in ?? 12,
      days_to_harvest: overrides.days_to_harvest ?? 60,
      planting_window: "Spring",
      direct_sow: true,
      frost_hardy: false,
      weeks_to_transplant: 4,
      notes: "Playwright test crop",
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const crop = (await response.json()) as { id: number; name: string };
  return { id: crop.id, name: crop.name };
}

export async function deleteTestGarden(
  request: APIRequestContext,
  token: string,
  gardenId: number,
): Promise<void> {
  const response = await request.delete(`${API}/gardens/${gardenId}`, {
    headers: authHeaders(token),
  });
  expect(response.ok() || response.status() === 404).toBeTruthy();
}

/** Waits until the API lists the garden (needed before deep-linking to brand-new gardens). */
export async function waitForGardenListed(
  request: APIRequestContext,
  token: string,
  gardenId: number,
) {
  await expect
    .poll(async () => {
      const listResponse = await request.get(`${API}/gardens`, { headers: authHeaders(token) });
      if (!listResponse.ok()) return false;
      const gardens = (await listResponse.json()) as { id: number }[];
      return gardens.some((g) => g.id === gardenId);
    })
    .toBe(true);
}

export async function getFirstGardenId(request: APIRequestContext, token: string): Promise<number> {
  const listResponse = await request.get(`${API}/gardens`, { headers: authHeaders(token) });
  expect(listResponse.ok()).toBeTruthy();
  const gardens = (await listResponse.json()) as { id: number }[];
  if (gardens.length > 0) {
    return gardens[0].id;
  }
  const garden = await createTestGarden(request, token);
  return garden.id;
}
