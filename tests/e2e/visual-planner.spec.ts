import {
  test,
  expect,
  registerAndLogin,
  createGardenWithBed,
  armPlantInLibrary,
  placeArmedPlantOnCanvas,
} from "./fixtures";

test.describe("visual planner", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await registerAndLogin(page);
  });

  test("illustrated plant library shows artwork for search results", async ({ page }) => {
    const { garden } = await createGardenWithBed(page);
    await page.goto(`/gardens/${garden.id}`);
    const search = page.getByPlaceholder("Search plants…").first();
    await search.fill("Tomato");
    await page.waitForTimeout(400);
    const plantButton = page.getByRole("button", { name: /tomato/i }).first();
    await expect(plantButton).toBeVisible();
    await expect(plantButton.locator("img")).toBeVisible();
  });

  test("desktop click-to-place adds plant sprite on canvas", async ({ page }) => {
    const { garden } = await createGardenWithBed(page);
    await page.goto(`/gardens/${garden.id}`);
    await armPlantInLibrary(page, "Tomato");
    await placeArmedPlantOnCanvas(page, garden.length, garden.width, { x: 5, y: 5 });
    await expect(page.locator(".plant-sprite").first()).toBeVisible();
  });

  test("toolbar zoom in and out updates scale label", async ({ page }) => {
    const { garden } = await createGardenWithBed(page);
    await page.goto(`/gardens/${garden.id}`);
    await expect(page.getByText("100%")).toBeVisible();
    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect(page.getByText("110%")).toBeVisible();
    await page.getByRole("button", { name: "Zoom out" }).click();
    await expect(page.getByText("100%")).toBeVisible();
  });
});
