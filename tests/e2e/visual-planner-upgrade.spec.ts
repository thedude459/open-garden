import {
  test,
  expect,
  registerAndLogin,
  createGardenWithBed,
  getPlantIdByName,
  placePlantViaApi,
} from "./fixtures";

test.describe("visual planner auto-upgrade", () => {
  test("legacy garden with placements opens in visual planner without data loss", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await registerAndLogin(page);

    const { garden, bed } = await createGardenWithBed(page, {
      name: `Legacy garden ${Date.now()}`,
    });
    const tomatoId = await getPlantIdByName(page, "Tomato");
    await placePlantViaApi(page, garden.id, {
      bedAreaId: bed.id,
      plantId: tomatoId,
      position_x: 5,
      position_y: 5,
    });

    await page.goto(`/gardens/${garden.id}`);
    await expect(page.locator("svg.visual-canvas")).toBeVisible();
    await expect(page.locator(".garden-area-bed").first()).toBeVisible();
    await expect(page.locator(".plant-sprite").first()).toBeVisible();
    await expect(page.locator(".zone-badge.planner-zone-badge")).toHaveText("Vegetable garden");

    const detail = await page.request.get(`/api/gardens/${garden.id}`);
    const body = await detail.json();
    expect(body.placements?.length ?? 0).toBe(1);
    expect(body.areas?.some((area: { area_type: string }) => area.area_type === "bed")).toBeTruthy();
  });
});
