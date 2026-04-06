import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePlannerActions } from "./usePlannerActions";
import { Bed, CropTemplate, Placement } from "../../types";

function makeBed(): Bed {
  return {
    id: 10,
    garden_id: 1,
    name: "A",
    width_in: 48,
    height_in: 48,
    grid_x: 0,
    grid_y: 0,
  };
}

function makePlacement(): Placement {
  return {
    id: 1,
    garden_id: 1,
    bed_id: 10,
    crop_name: "Tomato",
    grid_x: 14,
    grid_y: 0,
    planted_on: "2026-04-01",
    color: "#fff",
  };
}

function makeCrop(): CropTemplate {
  return {
    id: 1,
    name: "Tomato",
    variety: "",
    source: "manual",
    source_url: "",
    image_url: "",
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
}

describe("usePlannerActions", () => {
  it("nudges placement using 3-inch grid bounds", async () => {
    const fetchAuthedMock = vi.fn(async (path: string, opts?: RequestInit) => {
      if (path === "/placements/1/move") {
        const payload = JSON.parse(String(opts?.body || "{}"));
        return {
          id: 1,
          garden_id: 1,
          bed_id: payload.bed_id,
          crop_name: "Tomato",
          grid_x: payload.grid_x,
          grid_y: payload.grid_y,
          planted_on: "2026-04-01",
          color: "#fff",
        } as Placement;
      }
      throw new Error(`Unhandled path: ${path}`);
    });

    const { result } = renderHook(() => usePlannerActions({
      fetchAuthed: fetchAuthedMock as unknown as <T = unknown>(url: string, options?: RequestInit) => Promise<T>,
      pushNotice: vi.fn(),
      setBeds: vi.fn(),
      setPlacements: vi.fn(),
      beds: [makeBed()],
      placements: [makePlacement()],
      selectedGarden: 1,
      selectedGardenRecord: undefined,
      yardWidthFt: 20,
      yardLengthFt: 20,
      cropMap: new Map<string, CropTemplate>([["tomato", makeCrop()]]),
      selectedCropName: "Tomato",
      selectedDate: "2026-04-01",
      pushPlannerHistory: vi.fn(),
      setConfirmState: vi.fn(),
      loadGardens: vi.fn(async () => undefined),
      loadGardenData: vi.fn(async () => undefined),
      setSelectedGarden: vi.fn(),
      setTasks: vi.fn(),
      setPlantings: vi.fn(),
    }));

    await act(async () => {
      await result.current.nudgePlacementByDelta(1, 1, 0);
    });

    const moveCall = fetchAuthedMock.mock.calls.find(([path]) => path === "/placements/1/move");
    expect(moveCall).toBeTruthy();
    const body = JSON.parse(String(moveCall?.[1]?.body || "{}"));
    expect(body.grid_x).toBe(15);
    expect(body.grid_y).toBe(0);
  });
});
