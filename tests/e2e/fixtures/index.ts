import {
  layoutScale,
  svgDimensions,
  toSvgX,
  toSvgY,
} from "@/lib/planner/canvas-projection";
import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export function areaEditorPanel(page: Page): Locator {
  return page.locator("div.card.stack").filter({ has: page.getByRole("heading", { name: "Add area" }) });
}

export async function clickGardenCanvasPoint(
  page: Page,
  gardenLength: number,
  gardenWidth: number,
  point: { x: number; y: number },
): Promise<void> {
  const scale = layoutScale(gardenLength, gardenWidth);
  const svgX = toSvgX(point.x, scale);
  const svgY = toSvgY(point.y, scale);
  const dims = svgDimensions(gardenLength, gardenWidth, scale);
  const svg = page.locator("svg.visual-canvas").first();
  await svg.waitFor({ state: "visible" });

  const position = await svg.evaluate(
    (el, coords) => {
      const rect = el.getBoundingClientRect();
      return {
        x: (coords.svgX / coords.viewWidth) * rect.width,
        y: (coords.svgY / coords.viewHeight) * rect.height,
      };
    },
    { svgX, svgY, viewWidth: dims.width, viewHeight: dims.height },
  );

  await svg.click({ position });
}

export async function armPlantInLibrary(page: Page, plantName: string): Promise<void> {
  const library = page.getByRole("region", { name: "Plant library" });
  await library.waitFor({ state: "visible" });
  const search = library.getByPlaceholder("Search plants…");
  await search.fill("");
  await search.fill(plantName);
  await page.waitForResponse(
    (response) => response.url().includes("/api/plants/search") && response.ok(),
    { timeout: 10000 },
  );
  await library.getByRole("button", { name: new RegExp(plantName, "i") }).first().click();
  await expect(page.locator(".visual-canvas-wrap.armed")).toBeVisible({ timeout: 5000 });
}

export async function clickArmedPlantOnCanvas(
  page: Page,
  gardenLength: number,
  gardenWidth: number,
  point: { x: number; y: number },
): Promise<void> {
  await clickGardenCanvasPoint(page, gardenLength, gardenWidth, point);
}

export async function placeArmedPlantOnCanvas(
  page: Page,
  gardenLength: number,
  gardenWidth: number,
  point: { x: number; y: number },
): Promise<void> {
  const placementResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /\/api\/gardens\/[^/]+\/placements$/.test(response.url()),
  );
  await clickGardenCanvasPoint(page, gardenLength, gardenWidth, point);
  const response = await placementResponse;
  if (!response.ok()) {
    throw new Error(`placement failed: ${response.status()} ${await response.text()}`);
  }
}

export { test, expect } from "@playwright/test";
export * from "./auth";
export * from "./climate";
export * from "./garden";
