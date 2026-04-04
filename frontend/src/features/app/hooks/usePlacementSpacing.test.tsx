import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePlacementSpacing } from "./usePlacementSpacing";
import { Bed, Placement, Garden, CropTemplate } from "../../types";

describe("usePlacementSpacing", () => {
  const mockGarden: Garden = {
    id: 1,
    name: "Test Garden",
    owner_id: "user1",
    is_public: false,
    yard_width_ft: 20,
    yard_length_ft: 30,
    edge_buffer_in: 6,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockBeds: Bed[] = [
    {
      id: 1,
      garden_id: 1,
      name: "Bed 1",
      width_in: 120,
      height_in: 96,
      x_ft: 0,
      y_ft: 0,
      rotation_deg: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const mockCropTemplates: Map<string, CropTemplate> = new Map([
    [
      "Tomato",
      {
        id: 1,
        name: "Tomato",
        spacing_in: 24,
        depth_in: 12,
        maturity_days: 70,
        description: "",
        search_names: "",
        planting_guidelines: "",
      },
    ],
    [
      "Lettuce",
      {
        id: 2,
        name: "Lettuce",
        spacing_in: 6,
        depth_in: 6,
        maturity_days: 30,
        description: "",
        search_names: "",
        planting_guidelines: "",
      },
    ],
  ]);

  const mockPlacements: Placement[] = [
    {
      id: 1,
      garden_id: 1,
      bed_id: 1,
      planting_id: null,
      crop_name: "Tomato",
      grid_x: 8,
      grid_y: 8,
      planted_on: "2024-04-01",
      color: "red",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  it("should detect when placement is in buffer zone", () => {
    const { result } = renderHook(() =>
      usePlacementSpacing({
        beds: mockBeds,
        placements: mockPlacements,
        selectedGardenRecord: mockGarden,
        cropMap: mockCropTemplates,
        selectedCropName: "Lettuce",
      })
    );

    // Buffer is 6 inches = 2 cells (6/3)
    // Placement at (0, 0) should be in buffer
    const isInBuffer = result.current.isCellInBuffer(1, 0, 0);
    expect(isInBuffer).toBe(true);

    // Placement at (2, 2) should NOT be in buffer for a 48x96 bed
    const isNotInBuffer = result.current.isCellInBuffer(1, 2, 2);
    expect(isNotInBuffer).toBe(false);
  });

  it("should detect spacing conflicts between crops", () => {
    const { result } = renderHook(() =>
      usePlacementSpacing({
        beds: mockBeds,
        placements: mockPlacements,
        selectedGardenRecord: mockGarden,
        cropMap: mockCropTemplates,
        selectedCropName: "Tomato",
      })
    );

    // Try to place tomato too close to existing tomato
    // Tomato spacing is 24 inches = 8 cells (24/3)
    // Existing tomato at (8, 8), trying to place at (9, 8) = distance of 3 inches
    const conflict = result.current.placementSpacingConflict(1, 9, 8, "Tomato");
    expect(conflict).toBeTruthy();
    expect(conflict).toContain("Too close");
  });

  it("should allow placement when spacing is sufficient", () => {
    const { result } = renderHook(() =>
      usePlacementSpacing({
        beds: mockBeds,
        placements: mockPlacements,
        selectedGardenRecord: mockGarden,
        cropMap: mockCropTemplates,
        selectedCropName: "Lettuce",
      })
    );

    // Place lettuce far enough from existing tomato
    // Existing tomato at (8, 8), spacing 24 inches
    // Place lettuce at (12, 8) = distance of 12 inches (still too close)
    let conflict = result.current.placementSpacingConflict(1, 12, 8, "Lettuce");
    expect(conflict).toBeTruthy();

    // Place lettuce at (20, 8) = distance of 36 inches (enough spacing, outside edge buffer)
    conflict = result.current.placementSpacingConflict(1, 20, 8, "Lettuce");
    expect(conflict).toBeFalsy();
  });

  it("should identify blocked cells for selected crop", () => {
    const { result } = renderHook(() =>
      usePlacementSpacing({
        beds: mockBeds,
        placements: mockPlacements,
        selectedGardenRecord: mockGarden,
        cropMap: mockCropTemplates,
        selectedCropName: "Tomato",
      })
    );

    // Occupied cells are not blocked by this helper because occupancy is handled upstream
    const blocked = result.current.isCellBlockedForSelectedCrop(1, 8, 8, mockPlacements[0]);
    expect(blocked).toBe(false);

    // Empty cell too close to tomato should be blocked
    const blockedBySpacing = result.current.isCellBlockedForSelectedCrop(1, 9, 8, undefined);
    expect(blockedBySpacing).toBe(true);

    // Empty cell far enough should not be blocked
    const notBlocked = result.current.isCellBlockedForSelectedCrop(1, 20, 8, undefined);
    expect(notBlocked).toBe(false);
  });

  it("should ignore placement when checking conflicts", () => {
    const { result } = renderHook(() =>
      usePlacementSpacing({
        beds: mockBeds,
        placements: mockPlacements,
        selectedGardenRecord: mockGarden,
        cropMap: mockCropTemplates,
        selectedCropName: "Tomato",
      })
    );

    // When moving an existing placement, we should ignore its current position
    // Try to place tomato at (8, 8) but ignore placement 1
    const conflict = result.current.placementSpacingConflict(
      1,
      8,
      8,
      "Tomato",
      1 // ignorePlacementId
    );
    expect(conflict).toBeFalsy(); // No conflict when ignoring self
  });
});
