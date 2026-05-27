import { expect, test } from "./helpers/fixtures";
import { createTestCropTemplate, waitForGardenListed } from "./helpers/api";
import { gotoGardenPage, openPlannerTab, uid, yardBedButton } from "./helpers/auth";

test.describe("planner bed lifecycle", () => {
  test("creates a bed via the UI form and it appears on the yard canvas", async ({
    page,
    token,
    request,
    createGarden,
  }) => {
    const bedName = uid("E2E Layout Bed");
    const garden = await createGarden({ name: uid("Planner Garden") });

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

  test("deletes a bed via the yard setup controls", async ({ page, token, request, createGarden, createBed }) => {
    const garden = await createGarden({ name: uid("Delete Bed Garden") });
    const bed = await createBed(garden.id, { name: uid("Delete Me Bed") });

    await waitForGardenListed(request, token, garden.id);
    await gotoGardenPage(page, garden.id, "planner");
    await openPlannerTab(page, "Setup Yard");
    await expect(yardBedButton(page, bed.name)).toBeVisible({ timeout: 20_000 });

    const deleteButton = page.getByRole("button", { name: new RegExp(`Delete ${bed.name}`, "i") });
    await deleteButton.scrollIntoViewIfNeeded();
    await deleteButton.click();

    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
    await confirmDialog.getByRole("button", { name: "Delete bed", exact: true }).click();

    await expect(yardBedButton(page, bed.name)).not.toBeVisible({ timeout: 10_000 });
  });
});

test.describe("planner crop placement lifecycle", () => {
  test("places a crop in a bed and the placement chip appears", async ({ page, createGarden, createBed }) => {
    const garden = await createGarden({ name: uid("Placement Garden") });
    await createBed(garden.id, { name: "South Bed" });

    await gotoGardenPage(page, garden.id, "planner");
    await openPlannerTab(page, "Manage Plantings");
    await expect(page.getByRole("heading", { name: "South Bed" })).toBeVisible({ timeout: 15_000 });

    const cropOption = page.locator("#planner-crop-list [role='option']").first();
    await expect(cropOption).toBeVisible({ timeout: 10_000 });
    await cropOption.click();

    const emptyCell = page.getByRole("button", { name: /empty square column 3, row 3/i }).first();
    if (await emptyCell.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await emptyCell.click();
    } else {
      const anyCell = page.getByRole("button", { name: /empty square column/i }).first();
      await expect(anyCell).toBeVisible({ timeout: 5_000 });
      await anyCell.click();
    }

    await expect(page.getByText("No crop placements yet.")).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /at column \d+, row \d+/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("removes a placement via delete button and chip disappears", async ({
    page,
    token,
    request,
    createGarden,
    createBed,
  }) => {
    const garden = await createGarden({ name: uid("Remove Placement Garden") });
    const bed = await createBed(garden.id, { name: "North Bed" });

    const authHeaders = { Authorization: `Bearer ${token}` };
    const apiBase = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";

    const crop = await createTestCropTemplate(request, token, { name: uid("Placement Crop") });

    const placementRes = await request.post(`${apiBase}/plantings`, {
      headers: authHeaders,
      data: {
        garden_id: garden.id,
        bed_id: bed.id,
        crop_name: crop.name,
        grid_x: 2,
        grid_y: 2,
        planted_on: "2026-04-05",
        color: "#57a773",
      },
    });
    expect(placementRes.ok(), await placementRes.text()).toBeTruthy();

    await gotoGardenPage(page, garden.id, "planner");
    await openPlannerTab(page, "Manage Plantings");
    await expect(page.getByRole("heading", { name: "North Bed" })).toBeVisible({ timeout: 15_000 });

    const chipList = page.getByRole("listitem").filter({
      has: page.getByRole("button", { name: /at column \d+, row \d+/i }),
    });
    await expect(chipList.first()).toBeVisible({ timeout: 10_000 });

    await chipList.first().getByRole("button", { name: "Remove", exact: true }).click();
    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
    await confirmDialog.getByRole("button", { name: "Remove", exact: true }).click();

    await expect(page.getByText("No crop placements yet.")).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("planner yard canvas", () => {
  test("yard canvas renders bed cells after garden is selected", async ({
    page,
    token,
    request,
    createGarden,
    createBed,
  }) => {
    const garden = await createGarden({
      name: uid("Canvas Garden"),
      yard_width_ft: 10,
      yard_length_ft: 10,
    });
    await createBed(garden.id, { name: "Canvas Bed", width_in: 48, height_in: 48, grid_x: 1, grid_y: 1 });

    await waitForGardenListed(request, token, garden.id);
    await gotoGardenPage(page, garden.id, "planner");
    await openPlannerTab(page, "Setup Yard");

    await expect(yardBedButton(page, "Canvas Bed")).toBeVisible({ timeout: 20_000 });
  });
});
