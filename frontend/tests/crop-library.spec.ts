import { expect, test } from "./helpers/fixtures";
import { cropCard, uid } from "./helpers/auth";

test.describe("crop library workflow", () => {
  test("creates a manual crop and rehydrates it into the edit form", async ({ page }) => {
    const cropName = uid("Romanesco");

    await page.goto("/crops", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Crops", exact: true }).click();

    await page.locator("#crop-name").fill(cropName);
    await page.locator("#crop-variety").fill("Veronica");
    await page.locator("#crop-family").fill("Brassicaceae");
    await page.locator("#crop-spacing").fill("18");
    await page.locator("#crop-days").fill("75");
    await page.locator("#crop-window").fill("Spring");
    await page.locator("#crop-notes").fill("Keep moisture even.");
    await page.getByRole("button", { name: "Add to crop list" }).click();

    const card = cropCard(page, cropName);
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.getByRole("button", { name: "Edit" }).click();

    await expect(page.locator("#crop-name")).toHaveValue(cropName);
    await expect(page.locator("#crop-variety")).toHaveValue("Veronica");
    await expect(page.getByRole("button", { name: "Save crop" })).toBeVisible();
  });
});
