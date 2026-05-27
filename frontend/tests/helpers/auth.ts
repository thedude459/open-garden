import { expect, Page, APIRequestContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const E2E_USER = {
  username: "pw_e2e_verified",
  email: "pw_e2e_verified@example.com",
  password: "PwTest-123!",
};

const API = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";
let cachedToken: string | null = null;

export function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export async function getAuthToken(apiRequest: APIRequestContext) {
  if (cachedToken) {
    return cachedToken;
  }

  const helperDir = fileURLToPath(new URL(".", import.meta.url));
  const sessionPath = resolve(helperDir, "..", ".e2e-session.json");
  try {
    const session = JSON.parse(readFileSync(sessionPath, "utf-8")) as { token?: string };
    if (session.token) {
      cachedToken = session.token;
      return cachedToken;
    }
  } catch {
    // Fall back to API login below if session file is not present.
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const loginResponse = await apiRequest.post(`${API}/auth/login`, {
      form: {
        username: E2E_USER.username,
        password: E2E_USER.password,
      },
    });
    if (loginResponse.ok()) {
      const { access_token } = await loginResponse.json();
      cachedToken = access_token as string;
      return cachedToken;
    }
    if (loginResponse.status() === 429) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000 * (attempt + 1)));
      continue;
    }
    expect(loginResponse.ok()).toBeTruthy();
  }

  throw new Error("Unable to obtain auth token after retries.");
}

export async function dismissBlockingOverlays(page: Page) {
  const onboarding = page.getByRole("dialog").filter({ hasText: "Welcome to open-garden" });
  if (await onboarding.isVisible({ timeout: 500 }).catch(() => false)) {
    await page.getByRole("button", { name: "Got it" }).click();
    await expect(onboarding).not.toBeVisible({ timeout: 3_000 });
  }

  const help = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "Close" }) });
  if (await help.isVisible({ timeout: 500 }).catch(() => false)) {
    await page.getByRole("button", { name: "Close" }).click();
    await expect(help).not.toBeVisible({ timeout: 3_000 });
  }
}

export async function gotoHome(page: Page) {
  await page.goto("/home", { waitUntil: "domcontentloaded" });
  await dismissBlockingOverlays(page);
}

/** @deprecated Prefer gotoHome — auth comes from Playwright storageState. */
export async function loadAuthenticated(page: Page, _token?: string) {
  await gotoHome(page);
}

/** Opens the overflow nav and picks a secondary page (Timeline, Sensors, etc.). */
export async function navViaMore(page: Page, menuItem: string) {
  await page.getByRole("button", { name: "More tools" }).click();
  await page.getByRole("menuitem", { name: menuItem }).click();
}

export type GardenToolSlug =
  | "calendar"
  | "seasonal"
  | "planner"
  | "timeline"
  | "coach"
  | "sensors"
  | "pests"
  | "journal";

/** Deep-link to a garden-scoped tool (avoids flaky garden list selection). */
export async function gotoGardenPage(page: Page, gardenId: number, slug: GardenToolSlug) {
  const bedsLoaded =
    slug === "planner"
      ? page.waitForResponse(
          (response) =>
            response.url().includes(`/gardens/${gardenId}/beds`) &&
            response.request().method() === "GET" &&
            response.ok(),
          { timeout: 20_000 },
        )
      : null;

  await page.goto(`/g/${gardenId}/${slug}`, { waitUntil: "domcontentloaded" });
  if (bedsLoaded) {
    await bedsLoaded;
  }
  await dismissBlockingOverlays(page);
}

/** Yard canvas beds use aria-label "{name}, {w} by {h}. Use arrow keys…". */
export function yardBedButton(page: Page, bedName: string) {
  return page.getByRole("button", { name: new RegExp(`^${bedName},`) }).first();
}

export async function openPlannerTab(page: Page, tab: "Setup Yard" | "Manage Plantings") {
  await page.getByRole("tab", { name: tab }).click();
}

export async function openCreateGardenForm(page: Page) {
  await expect(page.getByRole("heading", { name: /My gardens/i })).toBeVisible({ timeout: 15_000 });

  // loadGardens auto-selects the first garden once the list arrives; wait before opening the form.
  await expect
    .poll(async () => {
      const selectCount = await page.getByRole("button", { name: /^Select garden / }).count();
      const emptyWelcome = await page
        .getByText(/Create your first garden|Start with the basics/i)
        .isVisible()
        .catch(() => false);
      return selectCount > 0 || emptyWelcome;
    })
    .toBe(true);

  const createAnother = page.locator("details.home-create-garden-collapsible");
  if (await createAnother.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await createAnother.scrollIntoViewIfNeeded();
    const summary = createAnother.locator(":scope > summary");
    await summary.scrollIntoViewIfNeeded();
    const isOpen = await createAnother.evaluate((el: HTMLDetailsElement) => el.open);
    if (!isOpen) {
      await summary.click();
    }
  }

  await expect(page.locator("#garden-name")).toBeVisible({ timeout: 20_000 });
}

/** Waits until garden-scoped primary nav is available (first garden auto-selected on /home). */
export async function waitForGardenNav(page: Page) {
  await expect(page.getByRole("button", { name: "Calendar", exact: true })).toBeVisible({
    timeout: 20_000,
  });
}

export function cropCard(page: Page, cropName: string) {
  return page.locator(".crops-grid .crop-card").filter({ hasText: cropName }).first();
}

export function journalEntry(page: Page, title: string) {
  return page.getByRole("listitem").filter({ hasText: title }).first();
}

export function pestLogEntry(page: Page, title: string) {
  return page.getByRole("listitem").filter({ hasText: title }).first();
}

export function calendarTaskItem(page: Page, taskTitle: string) {
  return page.getByRole("listitem").filter({ hasText: taskTitle }).first();
}
