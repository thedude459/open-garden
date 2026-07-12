import { test, expect, registerAndLogin, setTestLocationViaApi } from "./fixtures";

test.describe("plant catalog", () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page);
  });

  test("@smoke user can search plants by common name", async ({ page }) => {
    await page.goto("/plants");
    await page.getByPlaceholder("Search by common or botanical name").fill("Tomato");
    await page.getByRole("button", { name: "Search" }).click();
    const tomatoCard = page.getByRole("link", { name: "Tomato" }).first();
    await expect(tomatoCard).toBeVisible();
    await expect(tomatoCard).toContainText(/vegetable/i);
  });

  test("@smoke user can browse by plant type", async ({ page }) => {
    await page.goto("/plants");
    await page.getByRole("combobox").selectOption("vegetable");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText("Tomato")).toBeVisible();
  });

  test("@smoke user can view plant detail fields", async ({ page }) => {
    await page.goto("/plants");
    await page.getByPlaceholder("Search by common or botanical name").fill("Tomato");
    await page.getByRole("button", { name: "Search" }).click();
    await page.getByRole("link", { name: "Tomato" }).first().click();
    await expect(page.getByRole("heading", { name: "Tomato" })).toBeVisible();
    await expect(page.getByText("Days to maturity")).toBeVisible();
    await expect(page.getByText("Spacing (cm)")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Companions" })).toBeVisible();
  });

  test("@smoke climate filter works when location is set", async ({ page }) => {
    await setTestLocationViaApi(page, "97201");
    await page.goto("/plants");
    await page.getByRole("checkbox", { name: "Climate filter" }).check();
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText("Tomato")).toBeVisible();
  });
});
