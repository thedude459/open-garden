import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SeasonalPlanPanel } from "./SeasonalPlanPanel";
import { SeasonalPlanProvider, SeasonalPlanContextType } from "./SeasonalPlanContext";

function contextValue(overrides: Partial<SeasonalPlanContextType> = {}): SeasonalPlanContextType {
  return {
    selectedGardenName: "Back Garden",
    seasonalPlan: null,
    selectedRecommendationPlantingId: null,
    plantingRecommendation: null,
    setSelectedRecommendationPlantingId: vi.fn(),
    refreshSeasonalPlan: vi.fn(async () => undefined),
    isLoadingSeasonalPlan: false,
    isLoadingPlantingRecommendation: false,
    pushNotice: vi.fn(),
    ...overrides,
  };
}

describe("SeasonalPlanPanel", () => {
  it("shows empty and loading states", () => {
    const loadingValue = contextValue({ isLoadingSeasonalPlan: true });
    render(
      <SeasonalPlanProvider value={loadingValue}>
        <SeasonalPlanPanel />
      </SeasonalPlanProvider>,
    );
    expect(screen.getByText("Building seasonal plan...")).toBeInTheDocument();

    const emptyValue = contextValue({ isLoadingSeasonalPlan: false, seasonalPlan: null });
    render(
      <SeasonalPlanProvider value={emptyValue}>
        <SeasonalPlanPanel />
      </SeasonalPlanProvider>,
    );
    expect(screen.getByText("No seasonal plan data yet.")).toBeInTheDocument();
  });

  it("renders recommendation detail and supports selecting a planting", () => {
    const setSelectedRecommendationPlantingId = vi.fn();
    const seasonalPlan = {
      microclimate_band: "temperate",
      soil_temperature_estimate_f: 62,
      frost_risk_next_10_days: "low",
      growth_stages: [
        {
          planting_id: 11,
          bed_id: 2,
          crop_name: "Lettuce",
          stage: "vegetative",
          progress_pct: 44,
          expected_harvest_on: "2026-05-20",
        },
      ],
      rotation_recommendations: [],
      companion_insights: [],
      recommended_next_plantings: [],
    };
    const plantingRecommendation = {
      planting_id: 11,
      crop_name: "Lettuce",
      stage: "vegetative",
      progress_pct: 44,
      expected_harvest_on: "2026-05-20",
      companion: { good_matches: ["Carrot"], risk_matches: ["Celery"] },
      next_actions: [{ title: "Thin seedlings", detail: "Space to 6 inches." }],
      succession_candidates: [],
    };

    render(
      <SeasonalPlanProvider
        value={contextValue({
          seasonalPlan: seasonalPlan as never,
          selectedRecommendationPlantingId: null,
          setSelectedRecommendationPlantingId,
          plantingRecommendation: plantingRecommendation as never,
        })}
      >
        <SeasonalPlanPanel />
      </SeasonalPlanProvider>,
    );

    expect(
      screen.getByText("Select a planting from Growth Stage Tracking to view targeted recommendations."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Recommendations" }));
    expect(setSelectedRecommendationPlantingId).toHaveBeenCalledWith(11);

    expect(screen.getByText("Companion positives: Carrot")).toBeInTheDocument();
    expect(screen.getByText("Companion risks: Celery")).toBeInTheDocument();
    expect(screen.getByText("Thin seedlings")).toBeInTheDocument();
  });
});
