import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
    row_spacing_in: 60,
    in_row_spacing_in: 24,
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

// ---------------------------------------------------------------------------
// Shared helper – renders CropsPanel with a full set of sensible defaults,
// accepting only the props under test as overrides.
// ---------------------------------------------------------------------------

type CropsPanelPartialProps = Parameters<typeof import("./CropsPanel").CropsPanel>[0];

function renderPanel(overrides: Partial<CropsPanelPartialProps> = {}) {
  const defaults: CropsPanelPartialProps = {
    cropTemplates: [],
    isRefreshingLibrary: false,
    isCleaningLegacyLibrary: false,
    syncStatus: null,
    onRefreshLibrary: vi.fn(),
    onCleanupLegacyLibrary: vi.fn(),
    editingCropId: null,
    newCropName: "",
    onNewCropNameChange: vi.fn(),
    newCropVariety: "",
    onNewCropVarietyChange: vi.fn(),
    newCropFamily: "",
    onNewCropFamilyChange: vi.fn(),
    newCropSpacing: 12,
    onNewCropSpacingChange: vi.fn(),
    newCropDays: 70,
    onNewCropDaysChange: vi.fn(),
    newCropPlantingWindow: "Spring",
    onNewCropPlantingWindowChange: vi.fn(),
    newCropDirectSow: false,
    onNewCropDirectSowChange: vi.fn(),
    newCropFrostHardy: false,
    onNewCropFrostHardyChange: vi.fn(),
    newCropWeeksToTransplant: 6,
    onNewCropWeeksToTransplantChange: vi.fn(),
    newCropNotes: "",
    onNewCropNotesChange: vi.fn(),
    newCropImageUrl: "",
    onNewCropImageUrlChange: vi.fn(),
    cropErrors: { name: "", spacing: "", days: "", planting_window: "", weeks_to_transplant: "" },
    onUpsertCropTemplate: vi.fn(),
    onResetCropForm: vi.fn(),
    onPopulateCropForm: vi.fn(),
    cropBaseName: (crop) => crop.name,
  };
  return render(<CropsPanel {...defaults} {...overrides} />);
}

describe("CropsPanel – empty state", () => {
  it("shows placeholder when there are no crop templates", () => {
    renderPanel({ cropTemplates: [] });
    expect(screen.getByText("No crops yet. Add your first crop using the form.")).toBeInTheDocument();
  });

  it("shows correct count in subhead", () => {
    renderPanel({ cropTemplates: [makeCrop()] });
    expect(screen.getByText(/1 crop template available/)).toBeInTheDocument();
  });

  it("uses plural for multiple templates", () => {
    renderPanel({ cropTemplates: [makeCrop({ id: 1 }), makeCrop({ id: 2, name: "Pepper" })] });
    expect(screen.getByText(/2 crop templates available/)).toBeInTheDocument();
  });
});

describe("CropsPanel – form heading and submit button", () => {
  it("shows 'Add Crop' heading and 'Add to crop list' button when not editing", () => {
    renderPanel({ editingCropId: null });
    expect(screen.getByRole("heading", { name: "Add Crop" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to crop list" })).toBeInTheDocument();
  });

  it("shows 'Edit Crop' heading and 'Save crop' button when editingCropId is set", () => {
    renderPanel({ editingCropId: 5 });
    expect(screen.getByRole("heading", { name: "Edit Crop" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save crop" })).toBeInTheDocument();
  });

  it("shows 'Cancel edit' button only when editing", () => {
    renderPanel({ editingCropId: 5 });
    expect(screen.getByRole("button", { name: "Cancel edit" })).toBeInTheDocument();
  });

  it("does not show 'Cancel edit' button when not editing", () => {
    renderPanel({ editingCropId: null });
    expect(screen.queryByRole("button", { name: "Cancel edit" })).not.toBeInTheDocument();
  });
});

describe("CropsPanel – field validation errors", () => {
  it("renders name field error message", () => {
    renderPanel({ cropErrors: { name: "Name is required.", spacing: "", days: "", planting_window: "", weeks_to_transplant: "" } });
    expect(screen.getByText("Name is required.")).toBeInTheDocument();
  });

  it("renders spacing field error message", () => {
    renderPanel({ cropErrors: { name: "", spacing: "Spacing must be a positive number.", days: "", planting_window: "", weeks_to_transplant: "" } });
    expect(screen.getByText("Spacing must be a positive number.")).toBeInTheDocument();
  });

  it("renders days field error message", () => {
    renderPanel({ cropErrors: { name: "", spacing: "", days: "Days to harvest is required.", planting_window: "", weeks_to_transplant: "" } });
    expect(screen.getByText("Days to harvest is required.")).toBeInTheDocument();
  });

  it("renders planting window error message", () => {
    renderPanel({ cropErrors: { name: "", spacing: "", days: "", planting_window: "Planting window is required.", weeks_to_transplant: "" } });
    expect(screen.getByText("Planting window is required.")).toBeInTheDocument();
  });

  it("renders weeks_to_transplant error when shown (direct_sow=false)", () => {
    renderPanel({
      newCropDirectSow: false,
      cropErrors: { name: "", spacing: "", days: "", planting_window: "", weeks_to_transplant: "Must be 1–16 weeks." },
    });
    expect(screen.getByText("Must be 1–16 weeks.")).toBeInTheDocument();
  });
});

describe("CropsPanel – direct sow conditional field", () => {
  it("hides weeks-to-transplant field when direct_sow is true", () => {
    renderPanel({ newCropDirectSow: true });
    expect(screen.queryByLabelText("Weeks to start indoors before transplant")).not.toBeInTheDocument();
  });

  it("shows weeks-to-transplant field when direct_sow is false", () => {
    renderPanel({ newCropDirectSow: false });
    expect(screen.getByLabelText("Weeks to start indoors before transplant")).toBeInTheDocument();
  });
});

describe("CropsPanel – crop card tags", () => {
  it("shows 'Frost hardy' tag in the crop card for frost-hardy crops", () => {
    const { container } = renderPanel({ cropTemplates: [makeCrop({ frost_hardy: true })] });
    const cropsGrid = container.querySelector(".crops-grid")!;
    expect(within(cropsGrid as HTMLElement).getByText("Frost hardy")).toBeInTheDocument();
  });

  it("shows 'Warm season' tag for non-frost-hardy crops", () => {
    renderPanel({ cropTemplates: [makeCrop({ frost_hardy: false })] });
    expect(screen.getByText("Warm season")).toBeInTheDocument();
  });

  it("shows 'Direct sow' tag in the crop card for direct-sow crops", () => {
    const { container } = renderPanel({ cropTemplates: [makeCrop({ direct_sow: true })] });
    const cropsGrid = container.querySelector(".crops-grid")!;
    expect(within(cropsGrid as HTMLElement).getByText("Direct sow")).toBeInTheDocument();
  });

  it("shows 'Start indoors Xwk' tag for transplant crops", () => {
    renderPanel({ cropTemplates: [makeCrop({ direct_sow: false, weeks_to_transplant: 8 })] });
    expect(screen.getByText("Start indoors 8wk")).toBeInTheDocument();
  });

  it("shows 'Johnny's' tag for imported crops", () => {
    renderPanel({ cropTemplates: [makeCrop({ source: "johnnys-selected-seeds" })] });
    expect(screen.getByText("Johnny's")).toBeInTheDocument();
  });

  it("shows 'Manual' tag for manual crops", () => {
    renderPanel({ cropTemplates: [makeCrop({ source: "manual" })] });
    expect(screen.getByText("Manual")).toBeInTheDocument();
  });
});

describe("CropsPanel – edit button callback", () => {
  it("calls onPopulateCropForm with the crop when Edit is clicked", () => {
    const onPopulateCropForm = vi.fn();
    const crop = makeCrop({ id: 7, name: "Broccoli" });
    renderPanel({ cropTemplates: [crop], onPopulateCropForm });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onPopulateCropForm).toHaveBeenCalledWith(crop);
  });
});

describe("CropsPanel – sync status display", () => {
  it("shows running message when sync is active", () => {
    renderPanel({
      syncStatus: {
        status: "running",
        is_running: true,
        message: "Syncing crop data...",
        last_started_at: null,
        last_finished_at: null,
        added: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        cleaned_legacy_count: 0,
        error: null,
      },
    });
    expect(screen.getByText(/This runs in the background/)).toBeInTheDocument();
  });

  it("shows sync error when present", () => {
    renderPanel({
      syncStatus: {
        status: "failed",
        is_running: false,
        message: "Sync failed",
        last_started_at: null,
        last_finished_at: null,
        added: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        cleaned_legacy_count: 0,
        error: "Connection timeout",
      },
    });
    expect(screen.getByText(/Connection timeout/)).toBeInTheDocument();
  });

  it("disables update button while refreshing", () => {
    renderPanel({ isRefreshingLibrary: true });
    expect(screen.getByRole("button", { name: "Syncing crop database..." })).toBeDisabled();
  });

  it("disables remove legacy button while cleaning", () => {
    renderPanel({ isCleaningLegacyLibrary: true });
    expect(screen.getByRole("button", { name: "Removing legacy starter crops..." })).toBeDisabled();
  });
});

