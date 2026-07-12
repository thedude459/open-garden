import { test, expect, registerAndLogin, createGardenWithBed } from "./fixtures";

function parseRgb(color: string): [number, number, number] | null {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(foreground: string, background: string): number {
  const fg = parseRgb(foreground);
  const bg = parseRgb(background);
  if (!fg || !bg) {
    throw new Error(`Expected rgb colors, got ${foreground} and ${background}`);
  }
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

test.describe("accessibility contrast", () => {
  test("login page primary button has sufficient contrast", async ({ page }) => {
    await page.goto("/login");
    const button = page.getByRole("button", { name: /sign in/i });
    await expect(button).toBeVisible();
    const colors = await button.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        color: style.color,
        background: style.backgroundColor,
      };
    });
    expect(contrastRatio(colors.color, colors.background)).toBeGreaterThanOrEqual(4.5);
  });

  test("planner save button has sufficient contrast", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await registerAndLogin(page);
    const { garden } = await createGardenWithBed(page);
    await page.goto(`/gardens/${garden.id}`);

    const button = page.getByRole("button", { name: "Save plan" });
    await expect(button).toBeVisible();
    const colors = await button.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        color: style.color,
        background: style.backgroundColor,
      };
    });
    expect(contrastRatio(colors.color, colors.background)).toBeGreaterThanOrEqual(4.5);
  });

  test("home page renders with semantic surface tokens", async ({ page }) => {
    await page.goto("/");
    const surface = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--color-surface").trim(),
    );
    expect(surface).not.toBe("");
  });
});
