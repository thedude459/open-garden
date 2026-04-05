import { useEffect } from "react";
import { AppPage } from "../types";
import { Garden } from "../../types";

type NoticeKind = "info" | "success" | "error";

interface UsePageDataEffectsParams {
  token: string;
  selectedGarden: number | null;
  selectedGardenRecord: Garden | undefined;
  activePage: AppPage;
  selectedRecommendationPlantingId: number | null;
  loadTimelineForGarden: (garden: Garden) => Promise<void>;
  loadSeasonalPlanForGarden: (garden: Garden) => Promise<void>;
  loadSensorSummaryForGarden: (garden: Garden) => Promise<void>;
  loadPlantingRecommendation: (plantingId: number) => Promise<void>;
  noticeUnlessExpired: (msg: string) => (err: unknown) => void;
  pushNotice: (msg: string, kind: NoticeKind) => void;
  resetCoach: () => void;
  resetPlannerHistory: () => void;
}

export function usePageDataEffects({
  token,
  selectedGarden,
  selectedGardenRecord,
  activePage,
  selectedRecommendationPlantingId,
  loadTimelineForGarden,
  loadSeasonalPlanForGarden,
  loadSensorSummaryForGarden,
  loadPlantingRecommendation,
  noticeUnlessExpired,
  pushNotice,
  resetCoach,
  resetPlannerHistory,
}: UsePageDataEffectsParams) {
  useEffect(() => {
    if (!token || !selectedGardenRecord || activePage !== "timeline") return;
    loadTimelineForGarden(selectedGardenRecord).catch(noticeUnlessExpired("Unable to load unified timeline."));
  }, [token, selectedGardenRecord, activePage, loadTimelineForGarden, noticeUnlessExpired]);

  useEffect(() => {
    if (!token || !selectedGardenRecord || activePage !== "seasonal") return;
    loadSeasonalPlanForGarden(selectedGardenRecord).catch(noticeUnlessExpired("Unable to load seasonal plan."));
  }, [token, selectedGardenRecord, activePage, loadSeasonalPlanForGarden, noticeUnlessExpired]);

  useEffect(() => {
    if (!token || !selectedGardenRecord || activePage !== "sensors") return;
    loadSensorSummaryForGarden(selectedGardenRecord).catch(noticeUnlessExpired("Unable to load sensor telemetry."));
  }, [token, selectedGardenRecord, activePage, loadSensorSummaryForGarden, noticeUnlessExpired]);

  useEffect(() => {
    if (!token || activePage !== "seasonal" || !selectedRecommendationPlantingId) return;
    loadPlantingRecommendation(selectedRecommendationPlantingId).catch(() =>
      pushNotice("Unable to load planting recommendations.", "error"),
    );
  }, [token, activePage, selectedRecommendationPlantingId, loadPlantingRecommendation, pushNotice]);

  useEffect(() => {
    resetCoach();
    resetPlannerHistory();
  }, [selectedGarden, resetCoach, resetPlannerHistory]);
}
