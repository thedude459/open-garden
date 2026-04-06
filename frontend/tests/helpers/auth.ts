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

export async function loadAuthenticated(page: Page, token: string) {
  await page.addInitScript((value) => {
    localStorage.setItem("open-garden-token", value);
    localStorage.setItem("open-garden-help-seen", "1");
  }, token);
  await page.goto("/", { waitUntil: "domcontentloaded" });
}

export async function ensureGardenSelected(page: Page, gardenName?: string) {
  const targetGarden = gardenName
    ? page.locator(".garden-card-select", { hasText: gardenName }).first()
    : page.locator(".garden-card-select").first();

  await expect(targetGarden).toBeVisible({ timeout: 20_000 });
  await targetGarden.click();
}
