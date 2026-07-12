import type { APIRequestContext, Page } from "@playwright/test";

export const TEST_PASSWORD = "TestPass123!";

export function testEmail(): string {
  return `e2e-${crypto.randomUUID()}@test.local`;
}

export async function registerViaApi(
  request: APIRequestContext,
  email: string,
  password: string = TEST_PASSWORD,
): Promise<{ userId: string; email: string }> {
  const response = await request.post("/api/auth/register", {
    data: { email, password },
  });
  if (!response.ok()) {
    throw new Error(`register failed: ${response.status()} ${await response.text()}`);
  }
  const body = await response.json();
  return { userId: body.user.id as string, email: body.user.email as string };
}

export async function loginAs(
  page: Page,
  email: string,
  password: string = TEST_PASSWORD,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await page.goto("/gardens");
  await expectLoggedIn(page);
}

async function expectLoggedIn(page: Page): Promise<void> {
  await page.waitForURL(/\/(gardens|plants)/);
  if (page.url().includes("/login")) {
    throw new Error("Expected authenticated session but landed on login");
  }
}

export async function registerAndLogin(page: Page): Promise<{ email: string }> {
  const email = testEmail();
  await registerViaApi(page.request, email);
  await loginAs(page, email);
  return { email };
}
