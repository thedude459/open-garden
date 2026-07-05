import { test, expect } from "@playwright/test";

test.describe("visual planner", () => {
  test("unauthenticated users are redirected from garden planner", async ({ page }) => {
    await page.goto("/gardens");
    await expect(page).toHaveURL(/\/login/);
  });

  test("new garden page loads for authenticated users", async ({ page }) => {
    test.skip(true, "Requires seeded auth fixture");
    await page.goto("/gardens/new");
    await expect(page.getByRole("heading", { name: "Create garden" })).toBeVisible();
  });
});
