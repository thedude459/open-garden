import {
  test,
  expect,
  registerAndLogin,
  createGardenWithBed,
  getPlantIdByName,
  placePlantViaApi,
  armPlantInLibrary,
  placeArmedPlantOnCanvas,
  clickArmedPlantOnCanvas,
  clickGardenCanvasPoint,
} from "./fixtures";

test.describe("planting validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await registerAndLogin(page);
  });

  test("@smoke valid tomato placement persists after reload", async ({ page }) => {
    const { garden } = await createGardenWithBed(page);
    await page.goto(`/gardens/${garden.id}`);
    await armPlantInLibrary(page, "Tomato");
    await placeArmedPlantOnCanvas(page, garden.length, garden.width, { x: 5, y: 5 });
    await expect(page.getByRole("status")).toContainText(/tomato/i);
    await page.reload();
    await expect(page.locator(".plant-sprite").first()).toBeVisible({ timeout: 10000 });
  });

  test("spacing violation blocks placement", async ({ page }) => {
    const { garden, bed } = await createGardenWithBed(page);
    const tomatoId = await getPlantIdByName(page, "Tomato");
    await placePlantViaApi(page, garden.id, {
      bedAreaId: bed.id,
      plantId: tomatoId,
      position_x: 5,
      position_y: 5,
    });

    const before = await page.request.get(`/api/gardens/${garden.id}`);
    const beforeCount = (await before.json()).placements?.length ?? 0;

    await page.goto(`/gardens/${garden.id}`);
    await armPlantInLibrary(page, "Tomato");
    await clickArmedPlantOnCanvas(page, garden.length, garden.width, { x: 5.2, y: 5.2 });

    await expect(page.locator(".validation-feedback")).toContainText(/too close/i);
    const after = await page.request.get(`/api/gardens/${garden.id}`);
    expect((await after.json()).placements?.length ?? 0).toBe(beforeCount);
  });

  test("@smoke incompatible fennel adjacent to tomato is blocked", async ({ page }) => {
    const { garden, bed } = await createGardenWithBed(page);
    const tomatoId = await getPlantIdByName(page, "Tomato");
    const fennelId = await getPlantIdByName(page, "Fennel");
    await placePlantViaApi(page, garden.id, {
      bedAreaId: bed.id,
      plantId: tomatoId,
      position_x: 5,
      position_y: 5,
    });

    const validation = await page.request.post(`/api/gardens/${garden.id}/validate-placement`, {
      data: {
        bed_area_id: bed.id,
        plant_id: fennelId,
        plant_provenance: "authoritative",
        position_x: 5.5,
        position_y: 5,
        planted_on: new Date().toISOString().slice(0, 10),
      },
    });
    expect(validation.ok()).toBeTruthy();
    const violationCodes = ((await validation.json()).violations ?? []).map(
      (v: { code: string }) => v.code,
    );
    expect(violationCodes).toContain("INCOMPATIBLE");

    const before = await page.request.get(`/api/gardens/${garden.id}`);
    const beforeCount = (await before.json()).placements?.length ?? 0;

    await page.goto(`/gardens/${garden.id}`);
    await armPlantInLibrary(page, "Fennel");
    await clickArmedPlantOnCanvas(page, garden.length, garden.width, { x: 5.5, y: 5 });

    await expect(page.locator(".validation-feedback")).toContainText(/incompatible/i);
    const after = await page.request.get(`/api/gardens/${garden.id}`);
    expect((await after.json()).placements?.length ?? 0).toBe(beforeCount);
  });
});
