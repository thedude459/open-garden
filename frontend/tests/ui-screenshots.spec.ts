/**
 * UI screenshot capture spec.
 *
 * This test walks the app as a logged-in user and captures full-page
 * screenshots of each major surface so a reviewer (human or AI) can
 * visually audit the UX without running the app interactively.
 *
 * Run it with a dev server already on http://localhost:5173:
 *   npx playwright test tests/ui-screenshots.spec.ts --project=chromium
 *
 * Screenshots are written to:
 *   test-results/ui-screenshots/<desktop|mobile>/<slug>.png
 *
 * Credentials default to the seeded Playwright user
 * (`pw_e2e_verified` / `PwTest-123!`) so the spec works without any
 * per-developer setup. Override with UI_SCREENSHOT_USERNAME /
 * UI_SCREENSHOT_PASSWORD to capture against a different account.
 */
import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const USERNAME = process.env.UI_SCREENSHOT_USERNAME ?? "pw_e2e_verified";
const PASSWORD = process.env.UI_SCREENSHOT_PASSWORD ?? "PwTest-123!";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const OUT_DIR = join(ROOT, "test-results", "ui-screenshots");

type Viewport = {
  name: "desktop" | "mobile";
  width: number;
  height: number;
};

const DESKTOP: Viewport = { name: "desktop", width: 1440, height: 900 };
const MOBILE: Viewport = { name: "mobile", width: 390, height: 844 };

async function shot(page: Page, viewport: Viewport, slug: string) {
  const dir = join(OUT_DIR, viewport.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({
    path: join(dir, `${slug}.png`),
    fullPage: true,
    animations: "disabled",
  });
}

async function login(page: Page) {
  // Mark the first-run help modal as already seen so it doesn't
  // auto-open and intercept clicks while the spec tours the app.
  await page.addInitScript(() => {
    window.localStorage.setItem("open-garden-help-seen", "1");
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator("#login-username").fill(USERNAME);
  await page.locator("#login-password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  // Login success = auth form goes away. (On mobile the "My Gardens" nav
  // button is inside the collapsed drawer and won't be visible yet.)
  await expect(page.locator("#login-username")).toHaveCount(0, { timeout: 20_000 });
  // In case the modal still opened (e.g. localStorage was cleared), close it.
  await dismissHelpIfOpen(page);
}

async function dismissHelpIfOpen(page: Page) {
  const dialog = page.getByRole("dialog");
  if (await dialog.isVisible({ timeout: 500 }).catch(() => false)) {
    const gotIt = page.getByRole("button", { name: "Got it" });
    if (await gotIt.isVisible().catch(() => false)) {
      await gotIt.click();
    } else {
      await page.keyboard.press("Escape");
    }
    await expect(dialog).not.toBeVisible({ timeout: 3_000 });
  }
}

/**
 * Wait for the active page's primary content to have settled.
 * Catches common skeleton loaders and network-idle heuristics.
 */
async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(400);
}

/**
 * Click a primary nav button by its accessible name and wait for
 * the corresponding page to render. Accepts either a string (exact
 * match) or a regex for labels that may differ between app versions.
 */
async function nav(page: Page, buttonName: string | RegExp) {
  const btn =
    typeof buttonName === "string"
      ? page.getByRole("button", { name: buttonName, exact: true })
      : page.getByRole("button", { name: buttonName }).first();
  await expect(btn).toBeVisible({ timeout: 15_000 });
  await btn.click();
  await settle(page);
}

/**
 * Open the "More" overflow menu and click an item by name.
 */
async function navViaMore(page: Page, itemName: string) {
  await page.getByRole("button", { name: "More tools" }).click();
  await page.getByRole("menuitem", { name: itemName }).click();
  await settle(page);
}

/**
 * Try to ensure a garden is selected so the tour reaches downstream pages.
 * If no gardens exist we still capture the empty-state views instead of
 * failing the test.
 */
async function selectFirstGardenIfAny(page: Page): Promise<boolean> {
  const firstGarden = page.getByRole("button", { name: /^Select garden / }).first();
  const visible = await firstGarden.isVisible({ timeout: 3_000 }).catch(() => false);
  if (!visible) return false;
  await firstGarden.click();
  await settle(page);
  return true;
}

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";

/**
 * Make sure the logged-in user has at least one garden. If they don't,
 * create a demo one via the API so the tour has something to show on
 * calendar / planner / seasonal pages.
 */
async function ensureDemoGarden(page: Page) {
  const response = await page.request.post(`${API_URL}/auth/login`, {
    form: { username: USERNAME, password: PASSWORD },
  });
  if (!response.ok()) return;
  const { access_token } = (await response.json()) as { access_token?: string };
  if (!access_token) return;

  const list = await page.request.get(`${API_URL}/gardens`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!list.ok()) return;
  const gardens = (await list.json()) as Array<unknown>;
  if (Array.isArray(gardens) && gardens.length > 0) return;

  await page.request.post(`${API_URL}/gardens`, {
    headers: { Authorization: `Bearer ${access_token}` },
    data: {
      name: "Demo Garden",
      description: "Seeded for UI screenshots",
      zip_code: "94110",
      yard_width_ft: 20,
      yard_length_ft: 20,
    },
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(page);
}

test.describe.configure({ mode: "serial" });

test.describe("UI screenshots — desktop", () => {
  test.use({ viewport: { width: DESKTOP.width, height: DESKTOP.height } });

  test("auth screen (signed out)", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("tab", { name: "Sign in" })).toBeVisible();
    await shot(page, DESKTOP, "01-auth-signin");

    await page.getByRole("tab", { name: "Create account" }).click();
    await shot(page, DESKTOP, "02-auth-register");

    await page.getByRole("tab", { name: "Sign in" }).click();
    await page.getByRole("button", { name: "Forgot password?" }).click();
    await shot(page, DESKTOP, "03-auth-forgot-password");
  });

  test("walk app while logged in", async ({ page }) => {
    await login(page);
    await settle(page);

    await dismissHelpIfOpen(page);
    await ensureDemoGarden(page);
    await dismissHelpIfOpen(page);

    // My Gardens — default landing. Captures empty/welcome or populated state.
    await shot(page, DESKTOP, "10-home-landing");

    // Help modal — open from nav, capture, then close.
    await page.getByRole("button", { name: "Help" }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
    await shot(page, DESKTOP, "11-help-modal");
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 3_000 });

    // Select a garden if any exist so we can tour gated pages.
    const hasGarden = await selectFirstGardenIfAny(page);
    if (hasGarden) {
      await shot(page, DESKTOP, "12-home-garden-selected");
    }

    if (hasGarden) {
      await nav(page, "Calendar");
      await shot(page, DESKTOP, "20-calendar");

      await nav(page, "Seasonal Plan");
      await shot(page, DESKTOP, "21-seasonal-plan");

      await nav(page, "Bed Planner");
      await shot(page, DESKTOP, "22-bed-planner");

      // Secondary pages live behind the "More" menu.
      await navViaMore(page, "Timeline");
      await shot(page, DESKTOP, "30-timeline");

      await navViaMore(page, "AI Coach");
      await shot(page, DESKTOP, "31-ai-coach");

      await navViaMore(page, "Sensors");
      await shot(page, DESKTOP, "32-sensors");

      await navViaMore(page, "Pest Log");
      await shot(page, DESKTOP, "33-pest-log");
    }

    // Label is "Crops" in current source but some deployments still
    // render the older "Crop Library" string; accept either.
    await nav(page, /^(Crops|Crop Library)$/);
    await shot(page, DESKTOP, "40-crops");
  });
});

test.describe("UI screenshots — mobile", () => {
  test.use({ viewport: { width: MOBILE.width, height: MOBILE.height } });

  test("auth + home on a phone viewport", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await shot(page, MOBILE, "01-auth-signin");

    await login(page);
    await settle(page);
    await shot(page, MOBILE, "10-home-landing");

    // Open the hamburger so we can see the mobile nav drawer.
    const menuBtn = page.getByRole("button", { name: /menu/i });
    if (await menuBtn.isVisible().catch(() => false)) {
      await menuBtn.click();
      await shot(page, MOBILE, "11-nav-open");
    }
  });
});
