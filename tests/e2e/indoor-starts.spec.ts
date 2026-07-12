import {
  test,
  expect,
  registerAndLogin,
  createGardenWithBed,
  getPlantIdByName,
  createIndoorStartViaApi,
  placePlantViaApi,
} from "./fixtures";

test.describe("indoor starts", () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page);
  });

  test("@smoke indoor start does not occupy bed until transplanted", async ({ page }) => {
    const { garden, bed } = await createGardenWithBed(page);
    const tomatoId = await getPlantIdByName(page, "Tomato");
    await createIndoorStartViaApi(page, garden.id, {
      bedAreaId: bed.id,
      plantId: tomatoId,
    });

    const detail = await page.request.get(`/api/gardens/${garden.id}`);
    const body = await detail.json();
    expect(body.placements?.length ?? 0).toBe(0);
    expect(body.indoor_starts?.some((s: { status: string }) => s.status === "active")).toBeTruthy();

    await page.goto(`/gardens/${garden.id}`);
    await expect(page.getByRole("heading", { name: "Indoor starts" })).toBeVisible();
    await expect(page.getByText("Tomato")).toBeVisible();
  });

  test("@smoke direct seed occupies bed space immediately", async ({ page }) => {
    const { garden, bed } = await createGardenWithBed(page);
    const tomatoId = await getPlantIdByName(page, "Tomato");
    await placePlantViaApi(page, garden.id, {
      bedAreaId: bed.id,
      plantId: tomatoId,
      position_x: 5,
      position_y: 5,
    });

    const detail = await page.request.get(`/api/gardens/${garden.id}`);
    const body = await detail.json();
    expect(body.placements?.length ?? 0).toBe(1);
  });
});
