import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useCropTemplateSearchState } from "./useCropTemplateSearchState";

const cropTemplates = [
  {
    id: 1,
    name: "Tomato",
    variety: "Roma",
    source: "manual",
    source_url: "",
    image_url: "",
    external_product_id: "",
    family: "Nightshade",
    spacing_in: 12,
    row_spacing_in: 18,
    in_row_spacing_in: 12,
    days_to_harvest: 70,
    planting_window: "Spring",
    direct_sow: false,
    frost_hardy: false,
    weeks_to_transplant: 6,
    notes: "",
  },
  {
    id: 2,
    name: "Lettuce",
    variety: "Butterhead",
    source: "manual",
    source_url: "",
    image_url: "",
    external_product_id: "",
    family: "Asteraceae",
    spacing_in: 8,
    row_spacing_in: 12,
    in_row_spacing_in: 8,
    days_to_harvest: 45,
    planting_window: "Spring",
    direct_sow: true,
    frost_hardy: true,
    weeks_to_transplant: 0,
    notes: "",
  },
];

function keyEvent(key: string) {
  return {
    key,
    preventDefault: vi.fn(),
  } as unknown as React.KeyboardEvent<HTMLInputElement>;
}

describe("useCropTemplateSearchState", () => {
  it("filters templates and supports keyboard navigation and selection", () => {
    const setSelectedCropName = vi.fn();

    const { result } = renderHook(() =>
      useCropTemplateSearchState({
        cropTemplates,
        selectedCropName: "Tomato",
        setSelectedCropName,
      }),
    );

    expect(result.current.filteredCropTemplates).toHaveLength(2);

    act(() => {
      result.current.setCropSearchQuery("lett");
    });

    expect(result.current.filteredCropTemplates).toHaveLength(1);
    expect(result.current.filteredCropTemplates[0].name).toBe("Lettuce");

    const down = keyEvent("ArrowDown");
    act(() => {
      result.current.handleCropSearchKeyDown(down);
    });
    expect(down.preventDefault).toHaveBeenCalled();

    const enter = keyEvent("Enter");
    act(() => {
      result.current.handleCropSearchKeyDown(enter);
    });
    expect(enter.preventDefault).toHaveBeenCalled();
    expect(setSelectedCropName).toHaveBeenCalledWith("Lettuce");
    expect(result.current.cropSearchQuery).toContain("Lettuce");
  });

  it("restores selected crop label on escape and guards empty lists", () => {
    const { result } = renderHook(() =>
      useCropTemplateSearchState({
        cropTemplates,
        selectedCropName: "Tomato",
        setSelectedCropName: vi.fn(),
      }),
    );

    act(() => {
      result.current.setCropSearchQuery("xyz");
    });
    expect(result.current.filteredCropTemplates).toHaveLength(0);

    const downNoResults = keyEvent("ArrowDown");
    act(() => {
      result.current.handleCropSearchKeyDown(downNoResults);
    });
    expect(downNoResults.preventDefault).not.toHaveBeenCalled();

    act(() => {
      result.current.setCropSearchQuery("roma");
    });
    const escape = keyEvent("Escape");
    act(() => {
      result.current.handleCropSearchKeyDown(escape);
    });

    expect(escape.preventDefault).toHaveBeenCalled();
    expect(result.current.cropSearchQuery).toContain("Tomato");
  });
});
