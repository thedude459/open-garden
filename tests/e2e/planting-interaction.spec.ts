import { test, expect } from "@playwright/test";

test.describe("planting interaction", () => {
  test("unauthenticated users cannot access planner planting flow", async ({ page }) => {
    await page.goto("/gardens");
    await expect(page).toHaveURL(/\/login/);
  });

  test("drag-and-drop and click-to-place auto-save", async ({ page }) => {
    test.skip(true, "Requires seeded auth fixture and garden with beds");
    await page.goto("/gardens/test-garden-id");
    await page.getByRole("region", { name: "Plant library" }).getByPlaceholder("Search plants…").fill("tomato");
    await page.getByRole("button", { name: /tomato/i }).click();
    await page.locator(".visual-canvas").click({ position: { x: 120, y: 120 } });
    await expect(page.getByRole("status")).toContainText(/added/i);
  });

  test("placement save latency p95 under 500ms", async ({ page }) => {
    test.skip(true, "Requires seeded auth fixture; run with scripts/bench-planner-canvas.ts in CI");
  });
});
