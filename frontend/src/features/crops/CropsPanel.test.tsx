import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CropsPanel } from "./CropsPanel";
import { CropTemplate } from "../types";

afterEach(() => {
  cleanup();
});

function makeCrop(overrides: Partial<CropTemplate> = {}): CropTemplate {
  return {
    id: 1,
    name: "Tomato",
    variety: "Roma",
    source: "manual",
    source_url: "",
    image_url: "",
    external_product_id: "",
    family: "Solanaceae",
    spacing_in: 12,
    days_to_harvest: 70,
    planting_window: "Late spring",
    direct_sow: false,
    frost_hardy: false,
    weeks_to_transplant: 6,
    notes: "Keep evenly watered.",
    ...overrides,
  };
}

describe("CropsPanel", () => {
  it("renders crop image cards when image_url is provided", () => {
    render(
      <CropsPanel
        cropTemplates={[makeCrop({ image_url: "https://example.com/tomato.jpg" })]}
        isRefreshingLibrary={false}
        isCleaningLegacyLibrary={false}
        syncStatus={null}
        onRefreshLibrary={vi.fn()}
        onCleanupLegacyLibrary={vi.fn()}
        editingCropId={null}
        newCropName=""
        onNewCropNameChange={vi.fn()}
        newCropVariety=""
        onNewCropVarietyChange={vi.fn()}
        newCropFamily=""
        onNewCropFamilyChange={vi.fn()}
        newCropSpacing={12}
        onNewCropSpacingChange={vi.fn()}
        newCropDays={70}
        onNewCropDaysChange={vi.fn()}
        newCropPlantingWindow="Spring"
        onNewCropPlantingWindowChange={vi.fn()}
        newCropDirectSow={false}
        onNewCropDirectSowChange={vi.fn()}
        newCropFrostHardy={false}
        onNewCropFrostHardyChange={vi.fn()}
        newCropWeeksToTransplant={6}
        onNewCropWeeksToTransplantChange={vi.fn()}
        newCropNotes=""
        onNewCropNotesChange={vi.fn()}
        newCropImageUrl=""
        onNewCropImageUrlChange={vi.fn()}
        cropErrors={{ name: "", spacing: "", days: "", planting_window: "", weeks_to_transplant: "" }}
        onUpsertCropTemplate={vi.fn()}
        onResetCropForm={vi.fn()}
        onPopulateCropForm={vi.fn()}
        cropBaseName={(crop) => crop.name}
      />,
    );

    expect(screen.getByAltText("Tomato reference")).toBeInTheDocument();
  });

  it("renders the photo URL form field as a controlled input", () => {
    render(
      <CropsPanel
        cropTemplates={[]}
        isRefreshingLibrary={false}
        isCleaningLegacyLibrary={false}
        syncStatus={null}
        onRefreshLibrary={vi.fn()}
        onCleanupLegacyLibrary={vi.fn()}
        editingCropId={null}
        newCropName=""
        onNewCropNameChange={vi.fn()}
        newCropVariety=""
        onNewCropVarietyChange={vi.fn()}
        newCropFamily=""
        onNewCropFamilyChange={vi.fn()}
        newCropSpacing={12}
        onNewCropSpacingChange={vi.fn()}
        newCropDays={70}
        onNewCropDaysChange={vi.fn()}
        newCropPlantingWindow="Spring"
        onNewCropPlantingWindowChange={vi.fn()}
        newCropDirectSow={false}
        onNewCropDirectSowChange={vi.fn()}
        newCropFrostHardy={false}
        onNewCropFrostHardyChange={vi.fn()}
        newCropWeeksToTransplant={6}
        onNewCropWeeksToTransplantChange={vi.fn()}
        newCropNotes=""
        onNewCropNotesChange={vi.fn()}
        newCropImageUrl="https://example.com/pepper.jpg"
        onNewCropImageUrlChange={vi.fn()}
        cropErrors={{ name: "", spacing: "", days: "", planting_window: "", weeks_to_transplant: "" }}
        onUpsertCropTemplate={vi.fn()}
        onResetCropForm={vi.fn()}
        onPopulateCropForm={vi.fn()}
        cropBaseName={(crop) => crop.name}
      />,
    );

    expect(screen.getByLabelText("Photo URL (optional)")).toHaveValue("https://example.com/pepper.jpg");
  });
});
