import {
  test,
  expect,
  registerAndLogin,
  createGardenViaApi,
  createGardenWithBed,
  getPlantIdByName,
  getRootstockIdForPlant,
  placePlantViaApi,
} from "./fixtures";

test.describe("growing area types", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await registerAndLogin(page);
  });

  for (const zone of [
    { type: "vegetable_garden" as const, label: /vegetable garden/i },
    { type: "orchard" as const, label: /orchard/i },
    { type: "container_patio" as const, label: /container|patio/i },
  ]) {
    test(`user can create ${zone.type} plan`, async ({ page }) => {
      const garden = await createGardenViaApi(page, {
        name: `Zone ${zone.type} ${Date.now()}`,
        zone_type: zone.type,
      });
      await page.goto(`/gardens/${garden.id}`);
      await expect(page.locator(".zone-badge").filter({ hasText: zone.label })).toBeVisible();
    });
  }

  test("orchard apple tree spacing hard-blocks invalid placement", async ({ page }) => {
    const garden = await createGardenViaApi(page, {
      name: `Orchard spacing ${Date.now()}`,
      length: 40,
      width: 40,
      zone_type: "orchard",
    });
    const bed = await page.request.post(`/api/gardens/${garden.id}/areas`, {
      data: {
        area_type: "bed",
        origin_x: 2,
        origin_y: 2,
        length: 36,
        width: 36,
        rotation_degrees: 0,
      },
    });
    expect(bed.ok()).toBeTruthy();
    const bedBody = await bed.json();
    const bedId = bedBody.areas.find((a: { area_type: string }) => a.area_type === "bed")?.id;
    const appleId = await getPlantIdByName(page, "Apple");
    const rootstockId = await getRootstockIdForPlant(page, appleId);

    const first = await page.request.post(`/api/gardens/${garden.id}/placements`, {
      data: {
        bed_area_id: bedId,
        plant_id: appleId,
        plant_provenance: "authoritative",
        position_x: 10,
        position_y: 10,
        planted_on: new Date().toISOString().slice(0, 10),
        rootstock_id: rootstockId,
      },
    });
    expect(first.ok()).toBeTruthy();

    const second = await page.request.post(`/api/gardens/${garden.id}/placements`, {
      data: {
        bed_area_id: bedId,
        plant_id: appleId,
        plant_provenance: "authoritative",
        position_x: 11,
        position_y: 10,
        planted_on: new Date().toISOString().slice(0, 10),
        rootstock_id: rootstockId,
      },
    });
    expect(second.status()).toBe(422);
  });
});
