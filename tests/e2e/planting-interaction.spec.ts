import {
  test,
  expect,
  registerAndLogin,
  createGardenWithBed,
  getPlantIdByName,
  armPlantInLibrary,
  placeArmedPlantOnCanvas,
  clickGardenCanvasPoint,
} from "./fixtures";
import { layoutScale, svgDimensions, toSvgX, toSvgY } from "@/lib/planner/canvas-projection";

test.describe("planting interaction", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await registerAndLogin(page);
  });

  test("click-to-place auto-saves with success toast", async ({ page }) => {
    const { garden } = await createGardenWithBed(page);
    await page.goto(`/gardens/${garden.id}`);
    await armPlantInLibrary(page, "Tomato");
    await placeArmedPlantOnCanvas(page, garden.length, garden.width, { x: 5, y: 5 });
    await expect(page.getByRole("status")).toContainText(/tomato/i);
    await expect(page.locator(".plant-sprite").first()).toBeVisible();
  });

  test("drag-and-drop from library auto-saves", async ({ page }) => {
    const { garden } = await createGardenWithBed(page);
    await page.goto(`/gardens/${garden.id}`);
    const library = page.getByRole("region", { name: "Plant library" });
    const search = library.getByPlaceholder("Search plants…");
    await search.fill("");
    await search.fill("Basil");
    await page.waitForResponse(
      (response) => response.url().includes("/api/plants/search") && response.ok(),
    );
    const plantButton = library.getByRole("button", { name: /basil/i }).first();
    const canvas = page.locator("svg.visual-canvas").first();
    const point = { x: 5, y: 5 };
    const scale = layoutScale(garden.length, garden.width);
    const position = await canvas.evaluate(
      (el, coords) => {
        const rect = el.getBoundingClientRect();
        return {
          x: (coords.svgX / coords.viewWidth) * rect.width,
          y: (coords.svgY / coords.viewHeight) * rect.height,
        };
      },
      {
        svgX: toSvgX(point.x, scale),
        svgY: toSvgY(point.y, scale),
        viewWidth: svgDimensions(garden.length, garden.width, scale).width,
        viewHeight: svgDimensions(garden.length, garden.width, scale).height,
      },
    );

    const placementResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        /\/api\/gardens\/[^/]+\/placements$/.test(response.url()) &&
        response.ok(),
    );

    await plantButton.dragTo(canvas, { targetPosition: position });
    const response = await placementResponse;
    expect(response.ok()).toBeTruthy();
    await expect(page.getByRole("status")).toContainText(/basil/i);
  });

  test("placement save latency p95 under 500ms", async ({ page }) => {
    const { garden } = await createGardenWithBed(page);
    await page.goto(`/gardens/${garden.id}`);

    const samples: number[] = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await armPlantInLibrary(page, "Tomato");
      const started = Date.now();
      const response = page.waitForResponse(
        (res) =>
          res.request().method() === "POST" &&
          /\/api\/gardens\/[^/]+\/placements$/.test(res.url()) &&
          res.ok(),
      );
      await clickGardenCanvasPoint(page, garden.length, garden.width, {
        x: 3 + attempt * 1.2,
        y: 4,
      });
      await response;
      samples.push(Date.now() - started);
    }

    samples.sort((a, b) => a - b);
    const p95 = samples[Math.min(samples.length - 1, Math.ceil(samples.length * 0.95) - 1)];
    const budgetMs = process.env.CI ? 500 : 1500;
    expect(p95).toBeLessThan(budgetMs);
  });
});
