import { expect, test } from "@playwright/test";

import { ensureGardenSelected, getAuthToken, loadAuthenticated, uid } from "./helpers/auth";

const API = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";

test.describe("main functionality workflows", () => {
  test("registers a sensor and logs a pest observation", async ({ page, request }) => {
    const token = await getAuthToken(request);
    const authHeaders = { Authorization: `Bearer ${token}` };
    const gardenName = uid("Main Flow Garden");
    const bedName = uid("Main Flow Bed");
    const sensorName = uid("Moisture Probe");
    const pestTitle = uid("Aphids on kale");

    const gardenRes = await request.post(`${API}/gardens`, {
      headers: authHeaders,
      data: {
        name: gardenName,
        description: "Main functionality workflow coverage",
        zip_code: "94110",
        yard_width_ft: 20,
        yard_length_ft: 20,
      },
    });
    expect(gardenRes.ok()).toBeTruthy();
    const garden = (await gardenRes.json()) as { id: number };

    const bedRes = await request.post(`${API}/gardens/${garden.id}/beds`, {
      headers: authHeaders,
      data: {
        name: bedName,
        width_in: 48,
        height_in: 96,
        grid_x: 2,
        grid_y: 2,
      },
    });
    expect(bedRes.ok()).toBeTruthy();

    await loadAuthenticated(page, token);
    await ensureGardenSelected(page, gardenName);

    // Sensors workflow: register sensor and ingest a reading.
    await page.getByRole("button", { name: "Sensors", exact: true }).click();
    await expect(page.getByRole("heading", { name: /Sensor Dashboard/i })).toBeVisible({ timeout: 15_000 });

    const registerSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Register Sensor" }) }).first();
    await registerSection.locator("input[placeholder='Bed A Moisture Probe']").fill(sensorName);
    await registerSection.locator("select").nth(1).selectOption({ label: bedName });
    await registerSection.getByRole("button", { name: "Register sensor" }).click();

    const registeredSensors = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Registered Sensors" }) })
      .first();
    await expect(registeredSensors.getByText(sensorName, { exact: true })).toBeVisible({ timeout: 10_000 });

    const ingestSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Ingest Reading" }) }).first();
    await ingestSection.locator("select").first().selectOption({ label: `${sensorName} (soil_moisture)` });
    await ingestSection.locator("input[type='number']").fill("42.5");
    await ingestSection.getByRole("button", { name: "Push reading" }).click();

    await expect(page.getByText(new RegExp(`Latest: 42\\.5`))).toBeVisible({ timeout: 10_000 });

    // Pests workflow: add and remove an observation.
    await page.getByRole("button", { name: "Pest Log", exact: true }).click();
    await expect(page.getByRole("heading", { name: /Pest.*Disease Log/i })).toBeVisible({ timeout: 15_000 });

    await page.locator("#pest-title").fill(pestTitle);
    await page.locator("#pest-treatment").fill("Sprayed with diluted neem oil.");
    await page.getByRole("button", { name: "Log observation" }).click();

    const pestItem = page.locator(".pest-log-item").filter({ hasText: pestTitle }).first();
    await expect(pestItem).toBeVisible({ timeout: 10_000 });

    await pestItem.getByRole("button", { name: "Delete" }).click();
    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
    await confirmDialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(pestItem).not.toBeVisible({ timeout: 10_000 });
  });
});
