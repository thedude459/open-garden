import {
  test,
  expect,
  registerAndLogin,
  createGardenWithBed,
  armPlantInLibrary,
  placeArmedPlantOnCanvas,
} from "./fixtures";

test.describe("mobile click-to-place", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "Mobile project only");
    await registerAndLogin(page);
  });

  test("tap plant then tap bed places with auto-save", async ({ page }) => {
    const { garden } = await createGardenWithBed(page);
    await page.goto(`/gardens/${garden.id}`);
    await page.getByRole("button", { name: "Add plants" }).click();
    await armPlantInLibrary(page, "Basil");
    await placeArmedPlantOnCanvas(page, garden.length, garden.width, { x: 5, y: 5 });
    await expect(page.getByRole("status")).toContainText(/basil/i);
    await expect(page.locator(".plant-sprite").first()).toBeVisible();
  });
});
