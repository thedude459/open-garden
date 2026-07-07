import { test, expect, registerAndLogin } from "./fixtures";

test.describe("garden crud", () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page);
  });

  test("@smoke user can create a garden", async ({ page }) => {
    const name = `E2E Garden ${Date.now()}`;
    await page.goto("/gardens/new");
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Length").fill("20");
    await page.getByLabel("Width").fill("10");
    await page.getByLabel("Unit").selectOption("feet");
    await page.getByRole("button", { name: /create garden/i }).click();
    await expect(page).toHaveURL(/\/gardens\/[0-9a-f-]+/);
    await page.goto("/gardens");
    await expect(page.getByRole("link", { name })).toBeVisible();
    await expect(page.getByText(/20.*×.*10.*feet/)).toBeVisible();
  });

  test("zero dimensions are blocked by HTML validation", async ({ page }) => {
    await page.goto("/gardens/new");
    await page.getByLabel("Name").fill("Bad dims");
    await page.getByLabel("Length").fill("0");
    await page.getByLabel("Width").fill("10");
    await page.getByRole("button", { name: /create garden/i }).click();
    await expect(page).toHaveURL(/\/gardens\/new/);
    const lengthValid = await page.getByLabel("Length").evaluate((el) =>
      (el as HTMLInputElement).checkValidity(),
    );
    expect(lengthValid).toBe(false);
  });

  test("negative dimensions are blocked by HTML validation", async ({ page }) => {
    await page.goto("/gardens/new");
    await page.getByLabel("Name").fill("Bad dims");
    await page.getByLabel("Length").fill("-5");
    await page.getByLabel("Width").fill("10");
    await page.getByRole("button", { name: /create garden/i }).click();
    await expect(page).toHaveURL(/\/gardens\/new/);
    const lengthValid = await page.getByLabel("Length").evaluate((el) =>
      (el as HTMLInputElement).checkValidity(),
    );
    expect(lengthValid).toBe(false);
  });

  test("API rejects non-positive garden dimensions", async ({ page }) => {
    const response = await page.request.post("/api/gardens", {
      data: {
        name: "API bad dims",
        length: -5,
        width: 10,
        unit: "feet",
      },
    });
    expect(response.status()).toBe(422);
  });

  test("@smoke user can open garden planner", async ({ page }) => {
    await page.goto("/gardens/new");
    await page.getByLabel("Name").fill(`Open Me ${Date.now()}`);
    await page.getByLabel("Length").fill("12");
    await page.getByLabel("Width").fill("8");
    await page.getByRole("button", { name: /create garden/i }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("svg.visual-canvas").first()).toBeVisible();
  });
});
