import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePageDataEffects } from "./usePageDataEffects";
import { AppPage } from "../types";

describe("usePageDataEffects", () => {
  const garden = { id: 1, name: "Backyard" } as { id: number; name: string };

  it("runs page-specific loaders and resets state on garden change", async () => {
    const loadTimelineForGarden = vi.fn(async () => undefined);
    const loadSeasonalPlanForGarden = vi.fn(async () => undefined);
    const loadSensorSummaryForGarden = vi.fn(async () => undefined);
    const loadPlantingRecommendation = vi.fn(async () => undefined);
    const noticeUnlessExpired = vi.fn(() => vi.fn());
    const pushNotice = vi.fn();
    const resetCoach = vi.fn();
    const resetPlannerHistory = vi.fn();

    const { rerender } = renderHook(
      ({ activePage, recommendationId }) =>
        usePageDataEffects({
          token: "tok",
          selectedGarden: 1,
          selectedGardenRecord: garden as never,
          activePage,
          selectedRecommendationPlantingId: recommendationId,
          loadTimelineForGarden,
          loadSeasonalPlanForGarden,
          loadSensorSummaryForGarden,
          loadPlantingRecommendation,
          noticeUnlessExpired,
          pushNotice,
          resetCoach,
          resetPlannerHistory,
        }),
      {
        initialProps: {
          activePage: "timeline" as AppPage,
          recommendationId: null as number | null,
        },
      },
    );

    await waitFor(() => {
      expect(loadTimelineForGarden).toHaveBeenCalledWith(garden);
    });

    rerender({ activePage: "seasonal" as AppPage, recommendationId: 33 });
    await waitFor(() => {
      expect(loadSeasonalPlanForGarden).toHaveBeenCalledWith(garden);
      expect(loadPlantingRecommendation).toHaveBeenCalledWith(33);
    });

    rerender({ activePage: "sensors" as AppPage, recommendationId: null });
    await waitFor(() => {
      expect(loadSensorSummaryForGarden).toHaveBeenCalledWith(garden);
    });

    expect(resetCoach).toHaveBeenCalled();
    expect(resetPlannerHistory).toHaveBeenCalled();
    expect(pushNotice).not.toHaveBeenCalledWith("Unable to load planting recommendations.", "error");
  });
});
