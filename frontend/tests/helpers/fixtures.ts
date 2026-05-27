import { test as base, expect } from "@playwright/test";

import { getAuthToken } from "./auth";
import {
  BedCreatePayload,
  createTestBed,
  createTestGarden,
  deleteTestGarden,
  GardenCreatePayload,
  TestBed,
  TestGarden,
} from "./api";

type GardenFactory = (overrides?: GardenCreatePayload) => Promise<TestGarden>;
type BedFactory = (gardenId: number, overrides?: BedCreatePayload) => Promise<TestBed>;
type GardenCleanupRegistry = {
  register: (gardenId: number) => void;
};

export const test = base.extend<{
  token: string;
  createGarden: GardenFactory;
  createBed: BedFactory;
  gardenCleanup: GardenCleanupRegistry;
}>({
  token: async ({ request }, use) => {
    const token = await getAuthToken(request);
    await use(token);
  },

  createGarden: async ({ request, token, gardenCleanup }, use) => {
    const factory: GardenFactory = async (overrides) => {
      const garden = await createTestGarden(request, token, overrides);
      gardenCleanup.register(garden.id);
      return garden;
    };
    await use(factory);
  },

  createBed: async ({ request, token }, use) => {
    const factory: BedFactory = async (gardenId, overrides) => {
      return createTestBed(request, token, gardenId, overrides);
    };
    await use(factory);
  },

  gardenCleanup: async ({ request, token }, use) => {
    const gardenIds: number[] = [];
    await use({
      register: (gardenId: number) => {
        if (!gardenIds.includes(gardenId)) {
          gardenIds.push(gardenId);
        }
      },
    });
    for (const id of gardenIds) {
      await deleteTestGarden(request, token, id).catch(() => undefined);
    }
  },
});

export { expect };
