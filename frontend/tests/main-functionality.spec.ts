import { expect, test } from "./helpers/fixtures";
import { gotoGardenPage, pestLogEntry, uid } from "./helpers/auth";

test.describe("main functionality workflows", () => {
  test("registers a sensor and logs a pest observation", async ({ page, token, createGarden, createBed }) => {
    const garden = await createGarden({ name: uid("Main Flow Garden"), description: "Main functionality workflow coverage" });
    const bed = await createBed(garden.id, { name: uid("Main Flow Bed") });
    const sensorName = uid("Moisture Probe");
    const pestTitle = uid("Aphids on kale");

    await gotoGardenPage(page, garden.id, "sensors");
    await expect(page.getByRole("heading", { name: /Sensor Dashboard/i })).toBeVisible({ timeout: 15_000 });

    const registerSection = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Register Sensor" }) })
      .first();
    await registerSection.locator("input[placeholder='Bed A Moisture Probe']").fill(sensorName);
    await registerSection.locator("select").nth(1).selectOption({ label: bed.name });
    await registerSection.getByRole("button", { name: "Register sensor" }).click();

    const registeredSensors = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Registered Sensors" }) })
      .first();
    await expect(registeredSensors.getByText(sensorName, { exact: true })).toBeVisible({ timeout: 10_000 });

    const ingestSection = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Ingest Reading" }) })
      .first();
    await ingestSection.locator("select").first().selectOption({ label: `${sensorName} (soil_moisture)` });
    await ingestSection.locator("input[type='number']").fill("42.5");
    await ingestSection.getByRole("button", { name: "Push reading" }).click();

    await expect(page.getByText(new RegExp(`Latest: 42\\.5`))).toBeVisible({ timeout: 10_000 });

    await gotoGardenPage(page, garden.id, "pests");
    await expect(page.getByRole("heading", { name: /Pest.*Disease Log/i })).toBeVisible({ timeout: 15_000 });

    await page.locator("#pest-title").fill(pestTitle);
    await page.locator("#pest-treatment").fill("Sprayed with diluted neem oil.");
    await page.getByRole("button", { name: "Log observation" }).click();

    const pestItem = pestLogEntry(page, pestTitle);
    await expect(pestItem).toBeVisible({ timeout: 10_000 });

    await pestItem.getByRole("button", { name: "Delete" }).click();
    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
    await confirmDialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(pestItem).not.toBeVisible({ timeout: 10_000 });
  });
});
