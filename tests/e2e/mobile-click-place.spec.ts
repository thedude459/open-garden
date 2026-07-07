import { test, expect } from "@playwright/test";

test.describe("mobile click-to-place", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("mobile planner requires login", async ({ page }) => {
    await page.goto("/gardens");
    await expect(page).toHaveURL(/\/login/);
  });

  test("tap plant then tap bed places with auto-save", async ({ page }) => {
    test.skip(true, "Requires seeded auth fixture and garden with beds");
    await page.goto("/gardens/test-garden-id");
    await page.getByRole("button", { name: "Add plants" }).click();
    await page.getByPlaceholder("Search plants…").fill("basil");
    await page.getByRole("button", { name: /basil/i }).click();
    await page.locator(".visual-canvas").click({ position: { x: 100, y: 100 } });
    await expect(page.getByRole("status")).toContainText(/added/i);
  });
});
