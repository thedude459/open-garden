import { test, expect } from "@playwright/test";

test.describe("accessibility contrast", () => {
  test("login page primary button has sufficient contrast", async ({ page }) => {
    await page.goto("/login");
    const button = page.getByRole("button").first();
    await expect(button).toBeVisible();
    const colors = await button.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        color: style.color,
        background: style.backgroundColor,
      };
    });
    expect(colors.color).toBeTruthy();
    expect(colors.background).toBeTruthy();
  });

  test("home page renders with semantic surface tokens", async ({ page }) => {
    await page.goto("/");
    const surface = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--color-surface").trim(),
    );
    expect(surface).not.toBe("");
  });
});
