import { expect, test } from "@playwright/test";

import { ensureGardenSelected, getAuthToken, loadAuthenticated, uid } from "./helpers/auth";

const API = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";

test.describe("bed edge buffer", () => {
  test.describe.configure({ mode: "serial" });

  test("applies default buffer, blocks edge placement via API, and expands when configured", async ({ page, request }) => {
    const token = await getAuthToken(request);
    const authHeaders = { Authorization: `Bearer ${token}` };

    const gardenName = uid("Buffer Garden");
    const gardenResponse = await request.post(`${API}/gardens`, {
      headers: authHeaders,
      data: {
        name: gardenName,
        description: "Edge buffer scenario coverage",
        zip_code: "94110",
        yard_width_ft: 20,
        yard_length_ft: 20,
      },
    });
    expect(gardenResponse.ok()).toBeTruthy();
    const garden = (await gardenResponse.json()) as { id: number };

    const bedResponse = await request.post(`${API}/gardens/${garden.id}/beds`, {
      headers: authHeaders,
      data: {
        name: uid("Planner Bed"),
        width_in: 48,
        height_in: 96,
        grid_x: 0,
        grid_y: 0,
      },
    });
    expect(bedResponse.ok()).toBeTruthy();

    await loadAuthenticated(page, token);
    await ensureGardenSelected(page, gardenName);
    await page.getByRole("button", { name: "Bed Planner", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Bed Sheets" })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".plot-cell").first()).toBeVisible({ timeout: 10_000 });

    const cropOption = page.locator("#planner-crop-list [role='option']").first();
    await expect(cropOption).toBeVisible({ timeout: 10_000 });
    await cropOption.click();

    const initialBufferCells = await page.locator(".plot-cell.buffer").count();
    expect(initialBufferCells).toBeGreaterThan(0);

    // Plant in a non-buffer cell to ensure normal placement still works.
    await page.getByRole("button", { name: "Empty square column 3, row 3" }).first().click();
    await expect(page.locator(".chip-row")).toHaveCount(1, { timeout: 10_000 });

    const bedsResponse = await request.get(`${API}/gardens/${garden.id}/beds`, {
      headers: authHeaders,
    });
    expect(bedsResponse.ok()).toBeTruthy();
    const beds = (await bedsResponse.json()) as Array<{ id: number }>;
    expect(beds.length).toBeGreaterThan(0);

    const templatesResponse = await request.get(`${API}/crop-templates`, {
      headers: authHeaders,
    });
    expect(templatesResponse.ok()).toBeTruthy();
    const templates = (await templatesResponse.json()) as Array<{ name: string }>;
    expect(templates.length).toBeGreaterThan(0);

    // API scenario: edge placement should be rejected by backend validation.
    const edgePlacement = await request.post(`${API}/placements`, {
      headers: authHeaders,
      data: {
        garden_id: garden.id,
        bed_id: beds[0].id,
        crop_name: templates[0].name,
        grid_x: 0,
        grid_y: 0,
        planted_on: "2026-03-22",
        color: "#57a773",
      },
    });
    expect(edgePlacement.status()).toBe(409);
    const edgeError = (await edgePlacement.json()) as { detail?: string };
    expect(edgeError.detail || "").toContain("bed edge");

    await page.getByRole("button", { name: "My Gardens" }).click();
    await page.locator("#garden-edge-buffer").fill("12");
    await page.getByRole("button", { name: "Save climate profile" }).click();

    await expect(page.getByText("Microclimate profile updated.")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Bed Planner", exact: true }).click();
    const expandedBufferCells = await page.locator(".plot-cell.buffer").count();
    expect(expandedBufferCells).toBeGreaterThan(initialBufferCells);
  });

  test("creates a bed via the planner UI form", async ({ page, request }) => {
    const token = await getAuthToken(request);
    const bedName = uid("Salad Bed");

    const gardenName = uid("UI Bed Garden");
    const gardenResponse = await request.post(`${API}/gardens`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: gardenName,
        zip_code: "94110",
        yard_width_ft: 20,
        yard_length_ft: 20,
      },
    });
    expect(gardenResponse.ok()).toBeTruthy();

    await loadAuthenticated(page, token);
    await ensureGardenSelected(page, gardenName);
    await page.getByRole("button", { name: "Bed Planner", exact: true }).click();
    await expect(page.getByRole("heading", { name: /Garden Bed Planner/i })).toBeVisible({ timeout: 10_000 });

    // Scope to the Create Bed form to avoid ambiguity with the yard-size inputs.
    const bedForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Add bed" }) });
    await bedForm.getByLabel("Bed Name").fill(bedName);
    await bedForm.getByLabel("Width (ft)").fill("4");
    await bedForm.getByLabel("Length (ft)").fill("8");
    await bedForm.getByRole("button", { name: "Add bed" }).click();

    await expect(page.getByRole("heading", { name: bedName })).toBeVisible({ timeout: 10_000 });
  });
});
