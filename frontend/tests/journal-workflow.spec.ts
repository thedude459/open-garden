import { expect, test } from "./helpers/fixtures";
import { gotoGardenPage, journalEntry, uid } from "./helpers/auth";

test.describe("journal workflow", () => {
  test("creates and deletes an observation entry", async ({ page, token, createGarden }) => {
    const garden = await createGarden({ name: uid("Journal Garden") });
    const entryTitle = uid("First tomato flowers");

    await gotoGardenPage(page, garden.id, "journal");
    await expect(page.getByRole("heading", { name: /Observation Journal/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.locator("#journal-title").fill(entryTitle);
    await page.locator("#journal-notes").fill("Blossoms on the lower truss; bees active mid-morning.");
    await page.getByRole("button", { name: "Save entry" }).click();

    const entry = journalEntry(page, entryTitle);
    await expect(entry).toBeVisible({ timeout: 10_000 });

    await entry.getByRole("button", { name: "Delete" }).click();
    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
    await confirmDialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(entry).not.toBeVisible({ timeout: 10_000 });
  });
});
