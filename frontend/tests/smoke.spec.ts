import { expect, test, type Page } from "@playwright/test";

import { getAuthToken, loadAuthenticated, uid, E2E_USER, ensureGardenSelected as selectGarden } from "./helpers/auth";

const API = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";

async function ensureGardenSelected(page: Page) {
  await selectGarden(page);
}

async function ensureGardenExistsAndSelected(page: Page, request: any, token: string) {
  // Wait for the app to finish loading the garden list before deciding whether
  // to bootstrap — the gardens load asynchronously after page.goto().
  const firstGarden = page.getByRole("button", { name: /^Select garden / }).first();
  const loaded = await firstGarden
    .waitFor({ state: "visible", timeout: 12_000 })
    .then(() => true)
    .catch(() => false);

  if (!loaded) {
    const bootstrap = await request.post(`${API}/gardens`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: uid("Nav Garden"),
        description: "bootstrap garden",
        zip_code: "94110",
        yard_width_ft: 20,
        yard_length_ft: 20,
      },
    });
    if (!bootstrap.ok()) {
      throw new Error(`Garden bootstrap failed: ${bootstrap.status()} ${await bootstrap.text()}`);
    }
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /^Select garden / }).first()).toBeVisible({ timeout: 15_000 });
  }

  await ensureGardenSelected(page);
}

test.describe("open-garden smoke", () => {
  test("sign in via UI with verified seeded user", async ({ page }) => {
    await page.goto("/");
    await page.locator("#login-username").fill(E2E_USER.username);
    await page.locator("#login-password").fill(E2E_USER.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("button", { name: "My Gardens" })).toBeVisible(
      { timeout: 15_000 }
    );
  });

  test("create a garden", async ({ page, request }) => {
    const token = await getAuthToken(request);
    const gardenName = uid("PW Garden");
    await loadAuthenticated(page, token);

    const createForm = page
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "Create garden" }) });

    await createForm.locator("input[name='name']").fill(gardenName);
    await createForm
      .locator("summary")
      .click();
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

    await expect(page.getByText("Garden created.")).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("button", { name: `Select garden ${gardenName}` })
    ).toBeVisible({ timeout: 20_000 });
  });

  test("navigate to calendar", async ({ page, request }) => {
    const token = await getAuthToken(request);
    await loadAuthenticated(page, token);
    await ensureGardenExistsAndSelected(page, request, token);
    await expect(page.getByRole("button", { name: "Calendar", exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Calendar", exact: true }).click();

    await expect(
      page.getByRole("heading", { name: /Season Calendar/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("navigate to bed planner", async ({ page, request }) => {
    const token = await getAuthToken(request);
    await loadAuthenticated(page, token);
    await ensureGardenExistsAndSelected(page, request, token);

    await expect(
      page.getByRole("button", { name: "Bed Planner", exact: true })
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Bed Planner", exact: true }).click();

    await expect(
      page.getByRole("heading", { name: /Garden Bed Planner/i })
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Bed Sheets" })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("navigate to crop library", async ({ page, request }) => {
    const token = await getAuthToken(request);
    await loadAuthenticated(page, token);
    await page.getByRole("button", { name: "Crop Library" }).click();

    await expect(
      page.getByRole("heading", { name: "Crop Library" })
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("panel navigation after garden selection", () => {
  test("timeline shows unified timeline heading", async ({ page, request }) => {
    const token = await getAuthToken(request);
    await loadAuthenticated(page, token);
    await ensureGardenExistsAndSelected(page, request, token);
    await page.getByRole("button", { name: "Timeline", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: /Unified Timeline/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("seasonal plan shows seasonal plan heading", async ({ page, request }) => {
    const token = await getAuthToken(request);
    await loadAuthenticated(page, token);
    await ensureGardenExistsAndSelected(page, request, token);
    await page.getByRole("button", { name: "Seasonal Plan", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: /Seasonal Plan/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("ai coach shows ai coach heading", async ({ page, request }) => {
    const token = await getAuthToken(request);
    await loadAuthenticated(page, token);
    await ensureGardenExistsAndSelected(page, request, token);
    await page.getByRole("button", { name: "AI Coach", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: /AI Garden Coach/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("sensors shows sensor dashboard heading", async ({ page, request }) => {
    const token = await getAuthToken(request);
    await loadAuthenticated(page, token);
    await ensureGardenExistsAndSelected(page, request, token);
    await page.getByRole("button", { name: "Sensors", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: /Sensor Dashboard/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("pest log shows pest and disease log heading", async ({ page, request }) => {
    const token = await getAuthToken(request);
    await loadAuthenticated(page, token);
    await ensureGardenExistsAndSelected(page, request, token);
    await page.getByRole("button", { name: "Pest Log", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: /Pest.*Disease Log/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("calendar shows weather outlook panel", async ({ page, request }) => {
    const token = await getAuthToken(request);
    await loadAuthenticated(page, token);
    await ensureGardenExistsAndSelected(page, request, token);
    await page.getByRole("button", { name: "Calendar", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: /Weather Outlook/i })
    ).toBeVisible({ timeout: 10_000 });
  });
});
