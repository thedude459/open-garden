import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePlannerCropVisuals } from "./usePlannerCropVisuals";
import { CropTemplate } from "../../types";

const tomato: CropTemplate = {
  id: 1,
  name: "Tomato",
  variety: "Roma",
  source: "manual",
  source_url: "",
  image_url: "https://example.com/tomato.jpg",
  external_product_id: "",
  family: "Nightshade",
  spacing_in: 12,
  row_spacing_in: 60,
  in_row_spacing_in: 24,
  days_to_harvest: 70,
  planting_window: "spring",
  direct_sow: false,
  frost_hardy: false,
  weeks_to_transplant: 6,
  notes: "",
};

describe("usePlannerCropVisuals", () => {
  it("returns image and spacing data when crop template has one", () => {
    const { result } = renderHook(() => usePlannerCropVisuals([tomato]));
    const visual = result.current.cropVisual("Tomato");

    expect(visual.imageUrl).toBe("https://example.com/tomato.jpg");
    expect(visual.rowSpacingIn).toBe(60);
    expect(visual.inRowSpacingIn).toBe(24);
  });

  it("falls back to default photo when no image exists", () => {
    const { result } = renderHook(() => usePlannerCropVisuals([{ ...tomato, image_url: "" }]));
    const visual = result.current.cropVisual("Unknown Crop");

    expect(visual.imageUrl.startsWith("data:image/svg+xml") || visual.imageUrl.includes("default-plant-photo.svg")).toBe(true);
    expect(visual.rowSpacingIn).toBe(18);
    expect(visual.inRowSpacingIn).toBe(12);
  });
});
