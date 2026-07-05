import { test, expect } from "@playwright/test";

test.describe("visual planner auto-upgrade", () => {
  test("legacy garden route requires authentication", async ({ page }) => {
    await page.goto("/gardens/00000000-0000-4000-8000-000000000001");
    await expect(page).toHaveURL(/\/login/);
  });
});
