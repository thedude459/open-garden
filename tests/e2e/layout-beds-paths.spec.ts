import { test, expect, registerAndLogin, createGardenViaApi, areaEditorPanel } from "./fixtures";

test.describe("layout beds and paths", () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page);
  });

  async function openGardenEditor(page: import("@playwright/test").Page, gardenId: string) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/gardens/${gardenId}`);
    await expect(page.getByRole("heading", { name: "Add area" })).toBeVisible();
    await areaEditorPanel(page).scrollIntoViewIfNeeded();
  }

  test("@smoke user can add a plantable bed", async ({ page }) => {
    const garden = await createGardenViaApi(page);
    await openGardenEditor(page, garden.id);
    const editor = areaEditorPanel(page);
    await editor.getByLabel("Origin X (feet)").fill("2");
    await editor.getByLabel("Origin Y (feet)").fill("2");
    await editor.getByLabel("Length (feet)").fill("6");
    await editor.getByLabel("Width (feet)").fill("4");
    await editor.getByRole("button", { name: "Add bed" }).click();
    await expect(page.locator(".garden-area-bed").first()).toBeVisible();
  });

  test("@smoke user can add a walking path", async ({ page }) => {
    const garden = await createGardenViaApi(page);
    await openGardenEditor(page, garden.id);
    const editor = areaEditorPanel(page);
    await editor.locator("select").first().selectOption("path");
    await editor.getByLabel("Origin X (feet)").fill("0");
    await editor.getByLabel("Origin Y (feet)").fill("0");
    await editor.getByLabel("Length (feet)").fill("20");
    await editor.getByLabel("Width (feet)").fill("1");
    await editor.getByRole("button", { name: "Add path" }).click();
    await expect(page.locator(".garden-area-path").first()).toBeVisible();
  });

  test("out-of-bounds area is rejected", async ({ page }) => {
    const garden = await createGardenViaApi(page);
    await openGardenEditor(page, garden.id);
    const editor = areaEditorPanel(page);
    await editor.getByLabel("Origin X (feet)").fill("18");
    await editor.getByLabel("Origin Y (feet)").fill("2");
    await editor.getByLabel("Length (feet)").fill("6");
    await editor.getByLabel("Width (feet)").fill("4");
    await editor.getByRole("button", { name: "Add bed" }).click();
    await expect(editor.getByRole("alert")).toBeVisible();
  });

  test("@smoke overlapping area is rejected", async ({ page }) => {
    const garden = await createGardenViaApi(page);
    await openGardenEditor(page, garden.id);
    const editor = areaEditorPanel(page);
    await editor.getByLabel("Origin X (feet)").fill("2");
    await editor.getByLabel("Origin Y (feet)").fill("2");
    await editor.getByLabel("Length (feet)").fill("6");
    await editor.getByLabel("Width (feet)").fill("4");
    await editor.getByRole("button", { name: "Add bed" }).click();
    await expect(page.locator(".garden-area-bed").first()).toBeVisible();

    await editor.getByLabel("Origin X (feet)").fill("4");
    await editor.getByLabel("Origin Y (feet)").fill("3");
    await editor.getByRole("button", { name: "Add bed" }).click();
    await expect(editor.getByRole("alert")).toBeVisible();
  });
});
