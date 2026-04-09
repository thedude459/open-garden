import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SeasonalNextPlantingsSection } from "./SeasonalNextPlantingsSection";
import type { NextPlanting } from "../types";

function makePlanting(overrides: Partial<NextPlanting> = {}): NextPlanting {
  return {
    crop_name: "Tomato",
    variety: "Roma",
    family: "Solanaceae",
    method: "direct_sow",
    status: "open",
    priority: 1,
    reason: "Ideal conditions",
    window_start: "2025-05-01",
    window_end: "2025-06-15",
    indoor_seed_start: null,
    indoor_seed_end: null,
    ...overrides,
  };
}

describe("SeasonalNextPlantingsSection", () => {
  it("shows empty message when no plantings", () => {
    render(<SeasonalNextPlantingsSection recommendedNextPlantings={[]} />);
    expect(screen.getByText("No immediate next plantings suggested yet.")).toBeInTheDocument();
  });

  it("shows Plant Outdoors Now section for open direct_sow items", () => {
    const planting = makePlanting({ crop_name: "Spinach", status: "open", method: "direct_sow" });
    render(<SeasonalNextPlantingsSection recommendedNextPlantings={[planting]} />);
    expect(screen.getByText(/Plant Outdoors Now/)).toBeInTheDocument();
    expect(screen.getByText("Spinach")).toBeInTheDocument();
    expect(screen.getByText(/Direct sow outdoors:/)).toBeInTheDocument();
  });

  it("shows watch-status items in Plant Outdoors Now section", () => {
    const planting = makePlanting({ crop_name: "Kale", status: "watch", method: "direct_sow" });
    render(<SeasonalNextPlantingsSection recommendedNextPlantings={[planting]} />);
    expect(screen.getByText(/Plant Outdoors Now/)).toBeInTheDocument();
    expect(screen.getByText("Kale")).toBeInTheDocument();
  });

  it("shows transplant-only items (no indoor dates) as direct outdoors", () => {
    const planting = makePlanting({
      crop_name: "Asparagus",
      method: "transplant",
      status: "open",
      indoor_seed_start: null,
      indoor_seed_end: null,
    });
    render(<SeasonalNextPlantingsSection recommendedNextPlantings={[planting]} />);
    expect(screen.getByText(/Plant directly outdoors/)).toBeInTheDocument();
  });

  it("shows Start Seeds Now section for transplant items currently in seed-start window", () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    const planting = makePlanting({
      crop_name: "Pepper",
      method: "transplant",
      status: "open",
      indoor_seed_start: yesterday,
      indoor_seed_end: tomorrow,
      window_start: "2025-06-01",
      window_end: "2025-07-01",
    });
    render(<SeasonalNextPlantingsSection recommendedNextPlantings={[planting]} />);
    expect(screen.getByText(/Start Seeds Now/)).toBeInTheDocument();
    expect(screen.getByText(/Start indoors:/)).toBeInTheDocument();
    expect(screen.getByText(/Transplant outdoors:/)).toBeInTheDocument();
  });

  it("shows Up Next section for items not in immediate categories", () => {
    // A planting that is NOT direct_sow and NOT in seed-start window falls into Up Next
    const farFuture = "2030-09-01";
    const planting = makePlanting({
      crop_name: "Broccoli",
      method: "transplant",
      status: "open",
      indoor_seed_start: farFuture,
      indoor_seed_end: farFuture,
    });
    render(<SeasonalNextPlantingsSection recommendedNextPlantings={[planting]} />);
    expect(screen.getByText("Up Next")).toBeInTheDocument();
  });

  it("renders variety selector when a crop has multiple varieties", () => {
    const base = makePlanting({ crop_name: "Tomato (Roma)", method: "direct_sow", status: "open" });
    const variety2 = makePlanting({ crop_name: "Tomato (Cherry)", method: "direct_sow", status: "open" });
    render(<SeasonalNextPlantingsSection recommendedNextPlantings={[base, variety2]} />);
    // Both are under "Tomato" base name, so a variety selector should appear
    const select = screen.queryByRole("combobox");
    expect(select).toBeInTheDocument();
  });

  it("allows changing variety selection", () => {
    const base = makePlanting({ crop_name: "Tomato (Roma)", variety: "Roma", method: "direct_sow", status: "open" });
    const variety2 = makePlanting({ crop_name: "Tomato (Cherry)", variety: "Cherry", method: "direct_sow", status: "open" });
    render(<SeasonalNextPlantingsSection recommendedNextPlantings={[base, variety2]} />);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "1" } });
    // selection changed without error
    expect(select).toBeInTheDocument();
  });

  it("shows reason and family text", () => {
    const planting = makePlanting({
      crop_name: "Carrot",
      reason: "Peak planting season",
      family: "Apiaceae",
      method: "direct_sow",
      status: "open",
    });
    render(<SeasonalNextPlantingsSection recommendedNextPlantings={[planting]} />);
    expect(screen.getByText(/Peak planting season/)).toBeInTheDocument();
    expect(screen.getByText(/Family Apiaceae/)).toBeInTheDocument();
  });

  it("shows count summary when items exist", () => {
    const planting = makePlanting({ status: "open", method: "direct_sow" });
    render(<SeasonalNextPlantingsSection recommendedNextPlantings={[planting]} />);
    expect(screen.getByText(/Showing top/)).toBeInTheDocument();
  });

  it("shows excess-of-max count when more candidates than maxFeaturedPerCategory", () => {
    const plantings = Array.from({ length: 8 }, (_, i) =>
      makePlanting({ crop_name: `Crop ${i}`, status: "open", method: "direct_sow" }),
    );
    render(<SeasonalNextPlantingsSection recommendedNextPlantings={plantings} maxFeaturedPerCategory={3} />);
    // Should show "3 of 8" in the heading
    expect(screen.getByText(/of 8/)).toBeInTheDocument();
  });
});
