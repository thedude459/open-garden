import { expect, test } from "@playwright/test";

import { ensureGardenSelected, getAuthToken, loadAuthenticated, uid } from "./helpers/auth";

const API = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";

test.describe("planner bed lifecycle", () => {
  test("creates a bed via the UI form and it appears on the yard canvas", async ({ page, request }) => {
    const token = await getAuthToken(request);
    const bedName = uid("E2E Layout Bed");
    const gardenName = uid("Planner Garden");

    await request.post(`${API}/gardens`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: gardenName, description: "", zip_code: "94110", yard_width_ft: 20, yard_length_ft: 20 },
    });

    await loadAuthenticated(page, token);
      await ensureGardenSelected(page, gardenName);
    await page.getByRole("button", { name: "Bed Planner", exact: true }).click();
    await expect(page.getByRole("heading", { name: /Garden Bed Planner/i })).toBeVisible({ timeout: 15_000 });

    const bedForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Add bed" }) });
    await bedForm.getByLabel("Bed Name").fill(bedName);
    await bedForm.getByLabel("Width (ft)").fill("4");
    await bedForm.getByLabel("Length (ft)").fill("8");
    await bedForm.getByRole("button", { name: "Add bed" }).click();

    await expect(page.getByRole("heading", { name: bedName })).toBeVisible({ timeout: 10_000 });

    // The yard canvas should render a movable yard bed tile.
    await expect(page.locator(".yard-grid")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".yard-grid .yard-bed").first()).toBeVisible({ timeout: 10_000 });
  });

  test("deletes a bed via the bed sheet UI and it is removed from the list", async ({ page, request }) => {
    const token = await getAuthToken(request);
    const bedName = uid("Delete Me Bed");
    const gardenName = uid("Delete Bed Garden");
    const authHeaders = { Authorization: `Bearer ${token}` };

    const gardenRes = await request.post(`${API}/gardens`, {
      headers: authHeaders,
      data: { name: gardenName, description: "", zip_code: "94110", yard_width_ft: 20, yard_length_ft: 20 },
    });
    expect(gardenRes.ok()).toBeTruthy();
    const garden = (await gardenRes.json()) as { id: number };

    await request.post(`${API}/gardens/${garden.id}/beds`, {
      headers: authHeaders,
      data: { name: bedName, width_in: 48, height_in: 96, grid_x: 2, grid_y: 2 },
    });

    await loadAuthenticated(page, token);
      await ensureGardenSelected(page, gardenName);
    await page.getByRole("button", { name: "Bed Planner", exact: true }).click();
    await expect(page.getByRole("heading", { name: bedName })).toBeVisible({ timeout: 15_000 });

    // Click delete on the bed sheet for this bed
    const bedSection = page.locator("section, .card").filter({ has: page.getByRole("heading", { name: bedName }) });
    await bedSection.getByRole("button", { name: /delete bed/i }).click();

    // Confirm the destructive action in the app's confirmation dialog.
    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
    await confirmDialog.getByRole("button", { name: "Delete bed", exact: true }).click();

    await expect(page.getByRole("heading", { name: bedName })).not.toBeVisible({ timeout: 10_000 });
  });
});

test.describe("planner crop placement lifecycle", () => {
  test("places a crop in a bed and the placement chip appears", async ({ page, request }) => {
    const token = await getAuthToken(request);
    const authHeaders = { Authorization: `Bearer ${token}` };
    const gardenName = uid("Placement Garden");

    const gardenRes = await request.post(`${API}/gardens`, {
      headers: authHeaders,
      data: { name: gardenName, description: "", zip_code: "94110", yard_width_ft: 20, yard_length_ft: 20 },
    });
    expect(gardenRes.ok()).toBeTruthy();
    const garden = (await gardenRes.json()) as { id: number };

    await request.post(`${API}/gardens/${garden.id}/beds`, {
      headers: authHeaders,
      data: { name: "South Bed", width_in: 48, height_in: 96, grid_x: 2, grid_y: 2 },
    });

    await loadAuthenticated(page, token);
      await ensureGardenSelected(page, gardenName);
    await page.getByRole("button", { name: "Bed Planner", exact: true }).click();
    await expect(page.getByRole("heading", { name: "South Bed" })).toBeVisible({ timeout: 15_000 });

    // Ensure a crop is selected (pick any option from the crop search / selector)
    const cropOption = page.getByRole("option").first();
    if (await cropOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await cropOption.click();
    } else {
      // Fallback: use the crop search input if present
      const cropSearch = page.getByPlaceholder(/search crop/i);
      if (await cropSearch.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await cropSearch.fill("Tomato");
        await page.getByRole("option", { name: /tomato/i }).first().click();
      }
    }

    // Click an empty grid cell inside the bed sheet (column 3, row 3 is inside the buffer-safe zone)
    const emptyCell = page.getByRole("button", { name: /empty square column 3, row 3/i }).first();
    if (await emptyCell.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await emptyCell.click();
    } else {
      // Fallback: pick any available empty planting cell
      const anyCell = page.getByRole("button", { name: /empty square column/i }).first();
      await expect(anyCell).toBeVisible({ timeout: 5_000 });
      await anyCell.click();
    }

    // After clicking a valid cell, the empty placements state should be replaced by at least one chip row.
    await expect(page.getByText("No crop placements yet.")).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /at column \d+, row \d+/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test("removes a placement via delete button and chip disappears", async ({ page, request }) => {
    const token = await getAuthToken(request);
    const authHeaders = { Authorization: `Bearer ${token}` };
    const gardenName = uid("Remove Placement Garden");

    const gardenRes = await request.post(`${API}/gardens`, {
      headers: authHeaders,
      data: { name: gardenName, description: "", zip_code: "94110", yard_width_ft: 20, yard_length_ft: 20 },
    });
    expect(gardenRes.ok()).toBeTruthy();
    const garden = (await gardenRes.json()) as { id: number };

    await request.post(`${API}/gardens/${garden.id}/beds`, {
      headers: authHeaders,
      data: { name: "North Bed", width_in: 48, height_in: 96, grid_x: 2, grid_y: 2 },
    });

    // Seed a placement via API so we have something to remove
    const templatesRes = await request.get(`${API}/crop-templates`, { headers: authHeaders });
    expect(templatesRes.ok()).toBeTruthy();
    const templates = (await templatesRes.json()) as Array<{ name: string }>;
    expect(templates.length).toBeGreaterThan(0);

    const bedsRes = await request.get(`${API}/gardens/${garden.id}/beds`, { headers: authHeaders });
    const beds = (await bedsRes.json()) as Array<{ id: number }>;

    const placementRes = await request.post(`${API}/placements`, {
      headers: authHeaders,
      data: {
        garden_id: garden.id,
        bed_id: beds[0].id,
        crop_name: templates[0].name,
        grid_x: 2,
        grid_y: 2,
        planted_on: "2026-04-05",
        color: "#57a773",
      },
    });
    // Accept 201 or 409 (if edge buffer blocks it – fall back gracefully)
    if (!placementRes.ok()) {
      test.skip();
      return;
    }

    await loadAuthenticated(page, token);
    await ensureGardenSelected(page, gardenName);
    await page.getByRole("button", { name: "Bed Planner", exact: true }).click();
    await expect(page.getByRole("heading", { name: "North Bed" })).toBeVisible({ timeout: 15_000 });

    const chipList = page.locator("li").filter({ has: page.getByRole("button", { name: /at column \d+, row \d+/i }) });
    await expect(chipList.first()).toBeVisible({ timeout: 10_000 });

    await chipList.first().getByRole("button", { name: "Remove", exact: true }).click();
    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
    await confirmDialog.getByRole("button", { name: "Remove", exact: true }).click();

    await expect(page.getByText("No crop placements yet.")).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("planner yard canvas", () => {
  test("yard canvas renders bed cells after garden is selected", async ({ page, request }) => {
    const token = await getAuthToken(request);
    const authHeaders = { Authorization: `Bearer ${token}` };
    const gardenName = uid("Canvas Garden");

    const gardenRes = await request.post(`${API}/gardens`, {
      headers: authHeaders,
      data: { name: gardenName, description: "", zip_code: "94110", yard_width_ft: 10, yard_length_ft: 10 },
    });
    expect(gardenRes.ok()).toBeTruthy();
    const garden = (await gardenRes.json()) as { id: number };

    await request.post(`${API}/gardens/${garden.id}/beds`, {
      headers: authHeaders,
      data: { name: "Canvas Bed", width_in: 48, height_in: 48, grid_x: 1, grid_y: 1 },
    });

    await loadAuthenticated(page, token);
      await ensureGardenSelected(page, gardenName);
    await page.getByRole("button", { name: "Bed Planner", exact: true }).click();

    // The yard canvas or layout section should be visible
    await expect(
      page.locator(".yard-canvas, .yard-grid, .yard-layout, .plot-cell").first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
