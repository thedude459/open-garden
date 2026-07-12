import { test, expect, testEmail, TEST_PASSWORD } from "./fixtures";

test.describe("auth", () => {
  test("@smoke visitor can register with valid credentials", async ({ page }) => {
    const email = testEmail();
    await page.goto("/register");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Register" }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("@smoke registered user can sign in", async ({ page, request }) => {
    const email = testEmail();
    await request.post("/api/auth/register", { data: { email, password: TEST_PASSWORD } });
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/(plants|gardens)/);
  });

  test("registration rejects short password", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Email").fill(testEmail());
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Register" }).click();
    await expect(page).toHaveURL(/\/register/);
  });

  test("registration rejects duplicate email", async ({ page, request }) => {
    const email = testEmail();
    await request.post("/api/auth/register", { data: { email, password: TEST_PASSWORD } });
    await page.goto("/register");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Register" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
  });

  test("sign-in rejects incorrect credentials", async ({ page, request }) => {
    const email = testEmail();
    await request.post("/api/auth/register", { data: { email, password: TEST_PASSWORD } });
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("WrongPass999!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText(/invalid/i);
  });

  test("@smoke unauthenticated users are redirected from protected routes", async ({ page }) => {
    await page.goto("/plants");
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/gardens");
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/gardens/new");
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/gardens/00000000-0000-4000-8000-000000000001");
    await expect(page).toHaveURL(/\/login/);
  });
});
