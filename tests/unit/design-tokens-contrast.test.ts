import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function parseHex(color: string): [number, number, number] | null {
  const match = color.trim().match(/^#([0-9a-f]{6})$/i);
  if (!match) {
    return null;
  }
  const hex = match[1];
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(foreground: string, background: string): number {
  const fg = parseHex(foreground);
  const bg = parseHex(background);
  if (!fg || !bg) {
    throw new Error(`Expected hex colors, got ${foreground} and ${background}`);
  }
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function extractToken(css: string, name: string): string {
  const pattern = new RegExp(`${name}:\\s*([^;]+);`);
  const match = css.match(pattern);
  if (!match) {
    throw new Error(`Token ${name} not found`);
  }
  return match[1].trim();
}

describe("design token contrast", () => {
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

  it("primary button text meets WCAG AA", () => {
    const primary = extractToken(css, "--color-primary");
    const onPrimary = extractToken(css, "--color-on-primary");
    expect(contrastRatio(onPrimary, primary)).toBeGreaterThanOrEqual(4.5);
  });

  it("secondary button text meets WCAG AA", () => {
    const secondary = extractToken(css, "--color-secondary");
    const onSecondary = extractToken(css, "--color-on-secondary");
    expect(contrastRatio(onSecondary, secondary)).toBeGreaterThanOrEqual(4.5);
  });

  it("body text meets WCAG AA on surface", () => {
    const surface = extractToken(css, "--color-surface");
    const onSurface = extractToken(css, "--color-on-surface");
    expect(contrastRatio(onSurface, surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("muted text meets WCAG AA on surface", () => {
    const surface = extractToken(css, "--color-surface");
    const muted = extractToken(css, "--color-muted");
    expect(contrastRatio(muted, surface)).toBeGreaterThanOrEqual(4.5);
  });
});
