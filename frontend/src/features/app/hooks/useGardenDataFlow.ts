import { useCallback, useMemo } from "react";
import { ConfirmState } from "../types";
import { createClearAllCaches } from "../utils/cacheUtils";
import { useCropLibrarySync } from "./useCropLibrarySync";
import { useGardenInsightsData } from "./useGardenInsightsData";
import { useGardenCoreState } from "./useGardenCoreState";
import { useGardenDataLoaders } from "./useGardenDataLoaders";
import { useGardenDataFlowEffects } from "./useGardenDataFlowEffects";

type NoticeKind = "info" | "success" | "error";

type UseGardenDataFlowParams = {
  token: string;
  fetchAuthed: (path: string, opts?: RequestInit) => Promise<unknown>;
  pushNotice: (message: string, kind: NoticeKind) => void;
  setIsEmailVerified: (value: boolean) => void;
  setConfirmState: (state: ConfirmState | null) => void;
};

export function useGardenDataFlow({
  token,
  fetchAuthed,
  pushNotice,
  setIsEmailVerified,
  setConfirmState,
}: UseGardenDataFlowParams) {
  const {
    gardens,
    setGardens,
    publicGardens,
    setPublicGardens,
    selectedGarden,
    setSelectedGarden,
    beds,
    setBeds,
    plantings,
    setPlantings,
    cropTemplates,
    setCropTemplates,
    placements,
    setPlacements,
    weather,
    setWeather,
    isLoadingGardenData,
    setIsLoadingGardenData,
    isLoadingWeather,
    setIsLoadingWeather,
    selectedCropName,
    setSelectedCropName,
    gardensRef,
    selectedGardenRef,
    weatherCacheRef,
  } = useGardenCoreState();

  const insights = useGardenInsightsData({ fetchAuthed });
  const {
    gardenClimate,
    plantingWindows,
    gardenSunPath,
    seasonalPlan,
    setSeasonalPlan,
    sensorSummary,
    gardenTimeline,
    plantingRecommendation,
    selectedRecommendationPlantingId,
    setSelectedRecommendationPlantingId,
    isLoadingClimate,
    isLoadingPlantingWindows,
    isLoadingSunPath,
    isLoadingSeasonalPlan,
    isLoadingSensorSummary,
    isLoadingTimeline,
    isLoadingPlantingRecommendation,
    loadClimateForGarden,
    loadPlantingWindowsForGarden,
    loadSunPathForGarden,
    loadSeasonalPlanForGarden,
    loadSensorSummaryForGarden,
    loadTimelineForGarden,
    loadPlantingRecommendation,
    invalidateGardenInsightCaches,
    invalidateSensorCaches,
    invalidateSeasonalPlanCache,
    resetForNoGarden,
    clearPlantingRecommendationCacheEntry,
  } = insights;

  const clearAllCaches = useMemo(
    () => createClearAllCaches(weatherCacheRef.current),
    [weatherCacheRef],
  );

  const noticeUnlessExpired = useCallback((msg: string) => {
    return (err: unknown) => {
      if (typeof err === "object" && err !== null && "sessionExpired" in err && (err as { sessionExpired?: boolean }).sessionExpired) {
        return;
      }
      pushNotice(msg, "error");
    };
  }, [pushNotice]);

  const {
    loadGardens,
    loadMe,
    selectCrop,
    loadCropTemplates,
    loadWeatherForGarden,
    loadGardenData,
    refreshSeasonalPlan,
  } = useGardenDataLoaders({
    fetchAuthed,
    pushNotice,
    setIsEmailVerified,
    clearAllCaches,
    resetForNoGarden,
    setGardens,
    setPublicGardens,
    setSelectedGarden,
    setWeather,
    setCropTemplates,
    setSelectedCropName,
    weatherCacheRef,
    setIsLoadingWeather,
    selectedGardenRef,
    gardensRef,
    setIsLoadingGardenData,
    setBeds,
    setPlantings,
    setPlacements,
    invalidateSeasonalPlanCache,
    loadSeasonalPlanForGarden,
    selectedRecommendationPlantingId,
    clearPlantingRecommendationCacheEntry,
    loadPlantingRecommendation,
  });

  const cropSync = useCropLibrarySync({
    fetchAuthed,
    pushNotice,
    setConfirmState,
    loadCropTemplates,
    selectedCropName,
  });
  const {
    cropTemplateSyncStatus,
    isRefreshingCropLibrary,
    isCleaningLegacyCropLibrary,
    loadCropTemplateSyncStatus,
    refreshCropTemplateDatabase,
    requestLegacyCropCleanup,
  } = cropSync;

  const selectedGardenRecord = gardens.find((g) => g.id === selectedGarden);

  useGardenDataFlowEffects({
    token,
    loadGardens,
    loadCropTemplates,
    loadMe,
    loadCropTemplateSyncStatus,
    cropTemplateSyncStatus,
    selectedGarden,
    loadGardenData,
    selectedGardenRecord,
    resetForNoGarden,
    loadClimateForGarden,
    loadPlantingWindowsForGarden,
    loadSunPathForGarden,
    noticeUnlessExpired,
  });

  return {
    gardens,
    setGardens,
    publicGardens,
    selectedGarden,
    setSelectedGarden,

    beds,
    setBeds,
    plantings,
    setPlantings,
    placements,
    setPlacements,
    cropTemplates,
    weather,

    gardenClimate,
    plantingWindows,
    gardenSunPath,
    seasonalPlan,
    setSeasonalPlan,
    sensorSummary,
    gardenTimeline,
    plantingRecommendation,
    selectedRecommendationPlantingId,
    setSelectedRecommendationPlantingId,

    cropTemplateSyncStatus,
    isRefreshingCropLibrary,
    isCleaningLegacyCropLibrary,

    isLoadingGardenData,
    isLoadingWeather,
    isLoadingClimate,
    isLoadingPlantingWindows,
    isLoadingSunPath,
    isLoadingSeasonalPlan,
    isLoadingSensorSummary,
    isLoadingTimeline,
    isLoadingPlantingRecommendation,

    selectedCropName,
    setSelectedCropName,
    selectCrop,

    loadGardens,
    loadMe,
    loadCropTemplates,
    loadCropTemplateSyncStatus,
    loadGardenData,
    loadWeatherForGarden,
    loadClimateForGarden,
    loadPlantingWindowsForGarden,
    loadSunPathForGarden,
    loadSeasonalPlanForGarden,
    loadSensorSummaryForGarden,
    loadTimelineForGarden,
    loadPlantingRecommendation,

    refreshCropTemplateDatabase,
    requestLegacyCropCleanup,
    refreshSeasonalPlan,

    invalidateGardenInsightCaches,
    invalidateSensorCaches,
    invalidateSeasonalPlanCache,

    noticeUnlessExpired,
  };
}
