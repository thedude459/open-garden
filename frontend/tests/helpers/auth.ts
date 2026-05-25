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

  const loginResponse = await apiRequest.post(`${API}/auth/login`, {
    form: {
      username: E2E_USER.username,
      password: E2E_USER.password,
    },
  });
  expect(loginResponse.ok()).toBeTruthy();
  const { access_token } = await loginResponse.json();
  cachedToken = access_token as string;
  return cachedToken;
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

export async function loadAuthenticated(page: Page, token: string) {
  await page.addInitScript((value) => {
    localStorage.setItem("open-garden-token", value);
    localStorage.setItem("open-garden-help-seen", "1");
    localStorage.setItem("open-garden-onboarding-dismissed", "1");
  }, token);
  await page.goto("/home", { waitUntil: "domcontentloaded" });
  await dismissBlockingOverlays(page);
}

/** Opens the overflow nav and picks a secondary page (Timeline, Sensors, etc.). */
export async function navViaMore(page: Page, menuItem: string) {
  await page.getByRole("button", { name: "More tools" }).click();
  await page.getByRole("menuitem", { name: menuItem }).click();
}

/** Returns an existing garden id or creates a minimal garden for URL routing tests. */
export async function getFirstGardenId(apiRequest: APIRequestContext, token: string): Promise<number> {
  const authHeaders = { Authorization: `Bearer ${token}` };
  const listResponse = await apiRequest.get(`${API}/gardens`, { headers: authHeaders });
  expect(listResponse.ok()).toBeTruthy();
  const gardens = (await listResponse.json()) as { id: number }[];
  if (gardens.length > 0) {
    return gardens[0].id;
  }
  const createResponse = await apiRequest.post(`${API}/gardens`, {
    headers: authHeaders,
    data: {
      name: uid("Routing Garden"),
      description: "e2e routing",
      zip_code: "94110",
      yard_width_ft: 20,
      yard_length_ft: 20,
    },
  });
  expect(createResponse.ok()).toBeTruthy();
  const garden = (await createResponse.json()) as { id: number };
  return garden.id;
}

export async function ensureGardenSelected(page: Page, gardenName?: string) {
  const selectButton = gardenName
    ? page.getByRole("button", { name: `Select garden ${gardenName}` }).first()
    : page.getByRole("button", { name: /^Select garden / }).first();

  const visible = await selectButton.isVisible({ timeout: 5_000 }).catch(() => false);
  if (!visible) {
    await page.reload({ waitUntil: "domcontentloaded" });
    await dismissBlockingOverlays(page);
  }

  await expect(selectButton).toBeVisible({ timeout: 20_000 });
  await selectButton.click();

  // Garden-scoped nav links only render after a garden is active.
  await expect(page.getByRole("button", { name: "Calendar", exact: true })).toBeVisible({
    timeout: 15_000,
  });
}
