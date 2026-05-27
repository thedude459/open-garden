import { expect, test } from "@playwright/test";

import { E2E_USER } from "./helpers/auth";

test("sign in via UI with verified seeded user", async ({ page }) => {
  const signInForm = () =>
    page.locator("form").filter({ has: page.locator("#login-username") });

  for (let attempt = 0; attempt < 8; attempt += 1) {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#login-username")).toBeVisible({ timeout: 15_000 });
    await page.locator("#login-username").fill(E2E_USER.username);
    await page.locator("#login-password").fill(E2E_USER.password);

    const loginResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/auth/login") && response.request().method() === "POST",
    );
    await signInForm().getByRole("button", { name: "Sign in" }).click();
    const response = await loginResponse;

    if (response.status() === 429) {
      await page.waitForTimeout(Math.min(30_000, 2_000 * 2 ** attempt));
      continue;
    }

    expect(response.ok(), `login failed with HTTP ${response.status()}`).toBeTruthy();
    await expect(page).toHaveURL(/\/home/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /My gardens/i })).toBeVisible({
      timeout: 15_000,
    });
    return;
  }

  throw new Error("Sign-in UI test failed after retries (likely API rate limiting).");
});
