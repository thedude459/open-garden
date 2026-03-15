import { expect, Page, request, test } from "@playwright/test";

const API = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

/** Inject auth token into localStorage and reload so the app boots authenticated. */
async function loadAuthenticated(page: Page, token: string) {
  await page.goto("/");
  await page.evaluate((t) => {
    localStorage.setItem("open-garden-token", t);
    // suppress first-login help modal so it never blocks test assertions
    localStorage.setItem("open-garden-help-seen", "1");
  }, token);
  await page.reload();
  await expect(page.getByRole("button", { name: "My Gardens" })).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("open-garden smoke", () => {
  test.describe.configure({ mode: "serial" });

  const creds = { username: uid("pwuser"), email: `${uid("pwemail")}@example.com`, password: "PwTest-123!" };
  const gardenName = uid("PW Garden");
  const bedName = uid("PW Bed");
  let token = "";

  test.afterAll(async () => {
    if (!token) return;
    const ctx = await request.newContext({ baseURL: API });
    try {
      await ctx.delete("/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
    } finally {
      await ctx.dispose();
    }
  });

  test("create account via UI", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "open-garden" })
    ).toBeVisible();

    await page.getByRole("tab", { name: "Create account" }).click();
    await page.locator("#login-email").fill(creds.email);
    await page.locator("#login-username").fill(creds.username);
    await page.locator("#login-password").fill(creds.password);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByRole("button", { name: "My Gardens" })).toBeVisible(
      { timeout: 15_000 }
    );

    token = await page.evaluate(
      () => localStorage.getItem("open-garden-token") ?? ""
    );
    expect(token).toBeTruthy();
  });

  test("sign in to existing account via UI", async ({ page }) => {
    await page.goto("/");
    // default tab is Sign in
    await page.locator("#login-username").fill(creds.username);
    await page.locator("#login-password").fill(creds.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("button", { name: "My Gardens" })).toBeVisible(
      { timeout: 15_000 }
    );
  });

  test("create a garden", async ({ page }) => {
    await loadAuthenticated(page, token);

    const createForm = page
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "Create garden" }) });

    await createForm.locator("input[name='name']").fill(gardenName);
    await createForm
      .locator("input[name='description']")
      .fill("Playwright smoke garden");
    await createForm.locator("input[name='zip_code']").fill("94110");
    await createForm.locator("input[name='yard_width_ft']").fill("20");
    await createForm.locator("input[name='yard_length_ft']").fill("20");
    await createForm
      .locator("input[name='address_private']")
      .fill("123 Test Lane");
    await createForm.getByRole("button", { name: "Create garden" }).click();

    await expect(page.getByRole("heading", { name: gardenName })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("navigate to calendar", async ({ page }) => {
    await loadAuthenticated(page, token);

    // Wait for a garden to be auto-selected (Calendar nav button appears)
    await expect(
      page.getByRole("button", { name: "Calendar", exact: true })
    ).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Calendar", exact: true }).click();

    await expect(
      page.getByRole("heading", { name: /Season Calendar/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("navigate to bed planner and add a bed", async ({ page }) => {
    await loadAuthenticated(page, token);

    await expect(
      page.getByRole("button", { name: "Bed Planner", exact: true })
    ).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Bed Planner", exact: true }).click();

    await expect(
      page.getByRole("heading", { name: /Garden Bed Planner/i })
    ).toBeVisible({ timeout: 10_000 });

    const addBedForm = page
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "Add bed" }) });

    await addBedForm.locator("input[name='name']").fill(bedName);
    await addBedForm.locator("input[name='width_ft']").fill("4");
    await addBedForm.locator("input[name='length_ft']").fill("8");
    await addBedForm.getByRole("button", { name: "Add bed" }).click();

    await expect(page.getByRole("heading", { name: bedName })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("navigate to crop library", async ({ page }) => {
    await loadAuthenticated(page, token);
    await page.getByRole("button", { name: "Crop Library" }).click();

    await expect(
      page.getByRole("heading", { name: "Crop Library" })
    ).toBeVisible({ timeout: 10_000 });
  });
});
