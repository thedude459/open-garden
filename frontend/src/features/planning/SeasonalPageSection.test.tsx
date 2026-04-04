import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SeasonalPlanProvider, SeasonalPlanContextType } from "./SeasonalPlanContext";
import { SeasonalPageSection } from "./SeasonalPageSection";

function buildSeasonalContextValue(): SeasonalPlanContextType {
  return {
    selectedGardenName: "Back Garden",
    seasonalPlan: null,
    selectedRecommendationPlantingId: null,
    plantingRecommendation: null,
    setSelectedRecommendationPlantingId: vi.fn(),
    refreshSeasonalPlan: vi.fn().mockResolvedValue(undefined),
    isLoadingSeasonalPlan: false,
    isLoadingPlantingRecommendation: false,
    pushNotice: vi.fn(),
  };
}

describe("SeasonalPageSection", () => {
  it("renders the seasonal panel through provider context", () => {
    render(
      <SeasonalPlanProvider value={buildSeasonalContextValue()}>
        <SeasonalPageSection />
      </SeasonalPlanProvider>,
    );

    expect(screen.getByText("Seasonal Plan - Back Garden")).toBeInTheDocument();
    expect(screen.getByText("No seasonal plan data yet.")).toBeInTheDocument();
  });
});
