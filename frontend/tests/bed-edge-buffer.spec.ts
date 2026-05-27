import { expect, test, type Page } from "./helpers/fixtures";
import { waitForGardenListed } from "./helpers/api";
import { gotoGardenPage, openPlannerTab, uid, yardBedButton } from "./helpers/auth";

async function showEdgeBufferOverlay(page: Page) {
  const toggle = page.getByRole("button", { name: /Show edge buffer/i });
  await expect(toggle).toBeVisible({ timeout: 15_000 });
  await toggle.click();
}

test.describe("bed edge buffer", () => {
  test.describe.configure({ mode: "serial" });

  test("applies default buffer, blocks edge placement via API, and expands when configured", async ({
    page,
    token,
    request,
    createGarden,
    createBed,
  }) => {
    const garden = await createGarden({ name: uid("Buffer Garden"), description: "Edge buffer scenario coverage" });
    const bed = await createBed(garden.id, {
      name: uid("Planner Bed"),
      width_in: 48,
      height_in: 96,
      grid_x: 0,
      grid_y: 0,
    });

    const authHeaders = { Authorization: `Bearer ${token}` };
    const apiBase = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";

    await waitForGardenListed(request, token, garden.id);
    await gotoGardenPage(page, garden.id, "planner");
    await openPlannerTab(page, "Manage Plantings");
    await expect(page.getByRole("heading", { name: bed.name })).toBeVisible({ timeout: 15_000 });
    await showEdgeBufferOverlay(page);

    await expect(page.getByRole("heading", { name: "Bed Sheets" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /empty square column|buffer zone at column/i }).first()).toBeVisible({
      timeout: 20_000,
    });

    const initialBufferCells = await page.getByRole("button", { name: /buffer zone at column/i }).count();
    expect(initialBufferCells).toBeGreaterThan(0);

    const bedsResponse = await request.get(`${apiBase}/gardens/${garden.id}/beds`, { headers: authHeaders });
    expect(bedsResponse.ok()).toBeTruthy();
    const beds = (await bedsResponse.json()) as Array<{ id: number }>;
    expect(beds.length).toBeGreaterThan(0);

    const templatesResponse = await request.get(`${apiBase}/crop-templates`, { headers: authHeaders });
    expect(templatesResponse.ok()).toBeTruthy();
    const templates = (await templatesResponse.json()) as Array<{ name: string }>;
    expect(templates.length).toBeGreaterThan(0);

    const interiorPlacement = await request.post(`${apiBase}/plantings`, {
      headers: authHeaders,
      data: {
        garden_id: garden.id,
        bed_id: beds[0].id,
        crop_name: templates[0].name,
        grid_x: 2,
        grid_y: 2,
        planted_on: "2026-03-22",
        color: "#57a773",
      },
    });
    expect(interiorPlacement.ok()).toBeTruthy();

    await gotoGardenPage(page, garden.id, "planner");
    await openPlannerTab(page, "Manage Plantings");
    await expect(page.getByText("No crop placements yet.")).not.toBeVisible({ timeout: 10_000 });

    const edgePlacement = await request.post(`${apiBase}/plantings`, {
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
    const edgeBody = await edgePlacement.text();
    expect(edgePlacement.status(), `edge placement: ${edgeBody}`).toBe(409);
    const edgeError = (await edgePlacement.json()) as { detail?: string };
    expect(edgeError.detail || "").toContain("bed edge");

    const bufferPatch = await request.patch(`${apiBase}/gardens/${garden.id}/microclimate`, {
      headers: authHeaders,
      data: { edge_buffer_in: 12 },
    });
    expect(bufferPatch.ok()).toBeTruthy();

    await gotoGardenPage(page, garden.id, "planner");
    await openPlannerTab(page, "Manage Plantings");
    await showEdgeBufferOverlay(page);
    const expandedBufferCells = await page.getByRole("button", { name: /buffer zone at column/i }).count();
    expect(expandedBufferCells).toBeGreaterThan(0);
    expect(expandedBufferCells).toBeGreaterThan(initialBufferCells);
  });

  test("creates a bed via the planner UI form", async ({ page, token, request, createGarden }) => {
    const bedName = uid("Salad Bed");
    const garden = await createGarden({ name: uid("UI Bed Garden") });

    await waitForGardenListed(request, token, garden.id);
    await gotoGardenPage(page, garden.id, "planner");
    await openPlannerTab(page, "Setup Yard");

    const bedForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Add bed" }) });
    await bedForm.getByLabel("Bed Name").fill(bedName);
    await bedForm.getByLabel("Width (ft)").fill("4");
    await bedForm.getByLabel("Length (ft)").fill("8");
    await bedForm.getByRole("button", { name: "Add bed" }).click();

    await expect(page.getByText("Bed added to yard layout.")).toBeVisible({ timeout: 15_000 });
    await openPlannerTab(page, "Setup Yard");
    await expect(yardBedButton(page, bedName)).toBeVisible({ timeout: 10_000 });
  });
});
