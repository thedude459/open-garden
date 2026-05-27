import { expect, test } from "./helpers/fixtures";
import { getFirstGardenId } from "./helpers/api";
import { gotoGardenPage, gotoHome, waitForGardenNav } from "./helpers/auth";

test.describe("URL routing and deep links", () => {
  test("calendar nav sets pathname to /g/:gardenId/calendar", async ({ page, request, token }) => {
    await getFirstGardenId(request, token);
    await gotoHome(page);
    await waitForGardenNav(page);
    await page.getByRole("button", { name: /^Select garden / }).first().click();

    await page.getByRole("button", { name: "Calendar", exact: true }).click();
    await expect(page).toHaveURL(/\/g\/\d+\/calendar$/);
    await expect(page.getByRole("heading", { name: /Season Calendar/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("deep link to planner renders bed planner without sidebar clicks", async ({ page, request, token }) => {
    const gardenId = await getFirstGardenId(request, token);
    await page.goto(`/g/${gardenId}/planner`, { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: /Bed planner/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).toHaveURL(new RegExp(`/g/${gardenId}/planner$`));
  });

  test("deep link to calendar survives reload", async ({ page, request, token }) => {
    const gardenId = await getFirstGardenId(request, token);
    await page.goto(`/g/${gardenId}/calendar`, { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: /Season Calendar/i })).toBeVisible({
      timeout: 15_000,
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Season Calendar/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).toHaveURL(new RegExp(`/g/${gardenId}/calendar$`));
  });

  test("deep link to observation journal", async ({ page, request, token }) => {
    const gardenId = await getFirstGardenId(request, token);
    await gotoGardenPage(page, gardenId, "journal");
    await expect(page.getByRole("heading", { name: /Observation Journal/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page).toHaveURL(new RegExp(`/g/${gardenId}/journal$`));
  });

  test("journal nav sets pathname to /g/:gardenId/journal", async ({ page, request, token }) => {
    await getFirstGardenId(request, token);
    await gotoHome(page);
    await waitForGardenNav(page);
    await page.getByRole("button", { name: /^Select garden / }).first().click();

    await page.getByRole("button", { name: "More tools" }).click();
    await page.getByRole("menuitem", { name: "Observation Journal" }).click();
    await expect(page).toHaveURL(/\/g\/\d+\/journal$/);
    await expect(page.getByRole("heading", { name: /Observation Journal/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("/home shows My gardens", async ({ page }) => {
    await gotoHome(page);

    await expect(page.getByRole("heading", { name: /My gardens/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("/crops shows Crop Library panel", async ({ page }) => {
    await page.goto("/crops", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: /Crop Library/i })).toBeVisible({
      timeout: 15_000,
    });
  });
});
