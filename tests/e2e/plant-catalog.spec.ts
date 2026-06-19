import { test, expect } from "@playwright/test";

test.describe("plant catalog", () => {
  test("unauthenticated users are redirected to login", async ({ page }) => {
    await page.goto("/plants");
    await expect(page).toHaveURL(/\/login/);
  });
});
