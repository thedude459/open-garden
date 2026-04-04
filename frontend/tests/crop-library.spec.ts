import { expect, test } from "@playwright/test";

import { getAuthToken, loadAuthenticated, uid } from "./helpers/auth";

test.describe("crop library workflow", () => {
  test("creates a manual crop and rehydrates it into the edit form", async ({ page, request }) => {
    const token = await getAuthToken(request);
    const cropName = uid("Romanesco");

    await loadAuthenticated(page, token);
    await page.getByRole("button", { name: "Crop Library" }).click();

    await page.getByLabel("Crop Name").fill(cropName);
    await page.getByLabel("Variety").fill("Veronica");
    await page.getByLabel("Family").fill("Brassicaceae");
    await page.getByLabel("Spacing (in)").fill("18");
    await page.getByLabel("Days to Harvest").fill("75");
    await page.getByLabel("When to Plant").fill("Spring");
    await page.getByLabel("Care notes (optional)").fill("Keep moisture even.");
    await page.getByRole("button", { name: "Add to crop list" }).click();

    await expect(page.getByText(cropName, { exact: false })).toBeVisible({ timeout: 10_000 });

    const cropCard = page.locator(".crop-card").filter({ hasText: cropName }).first();
    await cropCard.getByRole("button", { name: "Edit" }).click();

    await expect(page.getByLabel("Crop Name")).toHaveValue(cropName);
    await expect(page.getByLabel("Variety")).toHaveValue("Veronica");
    await expect(page.getByRole("button", { name: "Save crop" })).toBeVisible();
  });
});