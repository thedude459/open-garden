import { useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { PlantingLocation, PlantingMethod } from "./features/types";
import * as AuthFlowModule from "./features/app/hooks/useAuthFlow";
import { useCoachState } from "./features/app/hooks/useCoachState";
import { useConfirmAction } from "./features/app/hooks/useConfirmAction";
import { useCropFormState } from "./features/app/hooks/useCropFormState";
import { useDerivedGardenState } from "./features/app/hooks/useDerivedGardenState";
import { useGardenActions } from "./features/app/hooks/useGardenActions";
import { useGardenDataFlow } from "./features/app/hooks/useGardenDataFlow";
import { useJournalActions } from "./features/app/hooks/useJournalActions";
import { usePageDataEffects } from "./features/app/hooks/usePageDataEffects";
import { usePageRouter } from "./features/app/hooks/usePageRouter";
import { usePestLogActions } from "./features/app/hooks/usePestLogActions";
import { usePlannerActions } from "./features/app/hooks/usePlannerActions";
import { usePlannerHistory } from "./features/app/hooks/usePlannerHistory";
import { useTaskActions } from "./features/app/hooks/useTaskActions";
import type { FetchAuthed } from "./features/app/types";
import type { ToastNotice } from "./components/ToastRegion";
import { isoDate } from "./features/app/utils/appUtils";
import { buildAppPath, parseAppPath } from "./features/app/utils/appPaths";
import { AppPageRouter } from "./features/app/sections/AppPageRouter";

type AuthenticatedAppProps = {
  token: string;
  setToken: (value: string) => void;
  pushNotice: (message: string, kind: "info" | "success" | "error", actionLabel?: string, onAction?: () => void) => void;
  fetchAuthed: FetchAuthed;
  authFlow: ReturnType<typeof AuthFlowModule.useAuthFlow>;
  notices: ToastNotice[];
  dismissNotice: (id: number) => void;
};

export function AuthenticatedApp({
  token,
  setToken,
  pushNotice,
  fetchAuthed,
  authFlow,
  notices,
  dismissNotice,
}: AuthenticatedAppProps) {
  const today = useMemo(() => isoDate(new Date()), []);
  const navigate = useNavigate();
  const location = useLocation();

  const {
    plannerUndoCount,
    plannerRedoCount,
    pushPlannerHistory,
    undoPlannerChange,
    redoPlannerChange,
    resetPlannerHistory,
  } = usePlannerHistory((message, kind) => pushNotice(message, kind));
  const { confirmState, setConfirmState, isConfirmingAction, runConfirmedAction } = useConfirmAction({ pushNotice });

  const gardenData = useGardenDataFlow({
    token,
    fetchAuthed,
    pushNotice,
    setIsEmailVerified: authFlow.setIsEmailVerified,
    setConfirmState,
  });

  const pageRouter = usePageRouter({
    token,
    authFlow,
    pushNotice,
    selectedGarden: gardenData.selectedGarden,
    setSelectedGarden: gardenData.setSelectedGarden,
    gardens: gardenData.gardens,
  });

  const handleGardenSelectionChange = useCallback(
    (id: number | null) => {
      if (id === null) {
        gardenData.setSelectedGarden(null);
        return;
      }
      const parsed = parseAppPath(location.pathname);
      if (parsed?.kind === "garden") {
        navigate(buildAppPath(parsed.page, id));
        return;
      }
      gardenData.setSelectedGarden(id);
      pageRouter.resumeAfterGardenPick(id);
    },
    [gardenData, location.pathname, navigate, pageRouter]
  );

  const {
    activePage,
    navigateTo,
    isNavOpen,
    setIsNavOpen,
    isHelpOpen,
    setIsHelpOpen,
    monthCursor,
    setMonthCursor,
    selectedDate,
    setSelectedDate,
    placementBedId,
    setPlacementBedId,
  } = pageRouter;

  const [plantingMethod, setPlantingMethod] = useState<PlantingMethod>("direct_seed");
  const [plantingLocation, setPlantingLocation] = useState<PlantingLocation>("in_bed");
  const [plantingDate, setPlantingDate] = useState<string>(today);
  const [plantingMovedOn, setPlantingMovedOn] = useState<string | null>(null);

  const selectedGardenRecord = useMemo(
    () => gardenData.gardens.find((g) => g.id === gardenData.selectedGarden),
    [gardenData.gardens, gardenData.selectedGarden]
  );

  const taskActions = useTaskActions({
    fetchAuthed,
    pushNotice,
    token,
    selectedGarden: gardenData.selectedGarden,
    setPlantings: gardenData.setPlantings,
    invalidateSeasonalPlanCache: gardenData.invalidateSeasonalPlanCache,
  });

  const gardenActions = useGardenActions({
    fetchAuthed,
    pushNotice,
    selectedGarden: gardenData.selectedGarden,
    selectedGardenRecord,
    loadGardens: gardenData.loadGardens,
    loadGardenData: gardenData.loadGardenData,
    invalidateGardenInsightCaches: gardenData.invalidateGardenInsightCaches,
    loadClimateForGarden: gardenData.loadClimateForGarden,
    loadPlantingWindowsForGarden: gardenData.loadPlantingWindowsForGarden,
    loadSunPathForGarden: gardenData.loadSunPathForGarden,
    setGardens: gardenData.setGardens,
    invalidateSensorCaches: gardenData.invalidateSensorCaches,
    loadSensorSummaryForGarden: gardenData.loadSensorSummaryForGarden,
    setBeds: gardenData.setBeds,
  });

  const cropFormState = useCropFormState({
    fetchAuthed,
    pushNotice,
    selectedCropName: gardenData.selectedCropName,
    setSelectedCropName: gardenData.setSelectedCropName,
    loadCropTemplates: gardenData.loadCropTemplates,
    selectedGarden: gardenData.selectedGarden,
    loadGardenData: gardenData.loadGardenData,
    cropTemplates: gardenData.cropTemplates,
    refreshTasks: taskActions.refreshTasks,
  });

  const derived = useDerivedGardenState({
    today,
    tasks: taskActions.tasks,
    plantings: gardenData.plantings,
    monthCursor,
    selectedDate,
    cropTemplates: gardenData.cropTemplates,
    plantingWindows: gardenData.plantingWindows,
    weather: gardenData.weather,
    gardenClimate: gardenData.gardenClimate,
    selectedCropName: gardenData.selectedCropName,
    selectedGardenRecord,
  });

  const plannerActions = usePlannerActions({
    fetchAuthed,
    pushNotice,
    setBeds: gardenData.setBeds,
    setPlacements: gardenData.setPlacements,
    beds: gardenData.beds,
    placements: gardenData.placements,
    selectedGarden: gardenData.selectedGarden,
    selectedGardenRecord,
    yardWidthFt: derived.yardWidthFt,
    yardLengthFt: derived.yardLengthFt,
    cropMap: derived.cropMap,
    selectedCropName: gardenData.selectedCropName,
    placementBedId,
    selectedDate,
    plantingDate,
    plantingMovedOn,
    plantingMethod,
    plantingLocation,
    pushPlannerHistory,
    setConfirmState,
    loadGardens: gardenData.loadGardens,
    loadGardenData: gardenData.loadGardenData,
    setSelectedGarden: gardenData.setSelectedGarden,
    setTasks: taskActions.setTasks,
    setPlantings: gardenData.setPlantings,
    refreshTasks: taskActions.refreshTasks,
  });

  const coachState = useCoachState({ fetchAuthed, selectedGardenRecord });

  const pestLogActions = usePestLogActions({
    fetchAuthed,
    pushNotice,
    token,
    selectedGarden: gardenData.selectedGarden,
    activePage,
    setConfirmState,
  });

  const journalActions = useJournalActions({
    fetchAuthed,
    pushNotice,
    token,
    selectedGarden: gardenData.selectedGarden,
    activePage,
    setConfirmState,
  });

  usePageDataEffects({
    token,
    selectedGarden: gardenData.selectedGarden,
    selectedGardenRecord,
    activePage,
    selectedRecommendationPlantingId: gardenData.selectedRecommendationPlantingId,
    loadTimelineForGarden: gardenData.loadTimelineForGarden,
    loadSeasonalPlanForGarden: gardenData.loadSeasonalPlanForGarden,
    loadSensorSummaryForGarden: gardenData.loadSensorSummaryForGarden,
    loadPlantingRecommendation: gardenData.loadPlantingRecommendation,
    loadClimateForGarden: gardenData.loadClimateForGarden,
    loadPlantingWindowsForGarden: gardenData.loadPlantingWindowsForGarden,
    loadSunPathForGarden: gardenData.loadSunPathForGarden,
    loadExtensionResourcesForGarden: gardenData.loadExtensionResourcesForGarden,
    noticeUnlessExpired: gardenData.noticeUnlessExpired,
    pushNotice,
    resetCoach: coachState.resetCoach,
    resetPlannerHistory,
  });

  return (
    <AppPageRouter
      routing={{
        activePage,
        navigateTo,
      }}
      shell={{
        isNavOpen,
        setIsNavOpen,
        isHelpOpen,
        setIsHelpOpen,
        onLogout: () => {
          localStorage.removeItem("open-garden-token");
          setToken("");
        },
      }}
      auth={{
        isEmailVerified: authFlow.isEmailVerified,
        onResendVerificationEmail: () => {
          authFlow
            .resendVerificationEmail()
            .then(() => pushNotice("Verification email sent.", "success"))
            .catch((err: unknown) =>
              pushNotice(
                err instanceof Error ? err.message : "Unable to resend verification email.",
                "error"
              )
            );
        },
      }}
      garden={{
        selectedGarden: gardenData.selectedGarden,
        setSelectedGarden: handleGardenSelectionChange,
        selectedGardenRecord,
        gardens: gardenData.gardens,
        publicGardens: gardenData.publicGardens,
        beds: gardenData.beds,
        placements: gardenData.placements,
        cropTemplates: gardenData.cropTemplates,
      }}
      calendar={{
        today,
        monthCursor,
        setMonthCursor,
        selectedDate,
        setSelectedDate,
        selectedCropName: gardenData.selectedCropName,
      }}
      insights={{
        weather: gardenData.weather,
        gardenClimate: gardenData.gardenClimate,
        gardenSunPath: gardenData.gardenSunPath,
        seasonalPlan: gardenData.seasonalPlan,
        selectedRecommendationPlantingId: gardenData.selectedRecommendationPlantingId,
        setSelectedRecommendationPlantingId: gardenData.setSelectedRecommendationPlantingId,
        plantingRecommendation: gardenData.plantingRecommendation,
        refreshSeasonalPlan: gardenData.refreshSeasonalPlan,
        selectedGardenId: gardenData.selectedGarden,
        applySeasonalSuggestionKinds: gardenData.applySeasonalSuggestionKinds,
        sensorSummary: gardenData.sensorSummary,
        gardenTimeline: gardenData.gardenTimeline,
        loadTimelineForGarden: gardenData.loadTimelineForGarden,
        loadSensorSummaryForGarden: gardenData.loadSensorSummaryForGarden,
        gardenExtensionResources: gardenData.gardenExtensionResources,
        loadExtensionResourcesForGarden: gardenData.loadExtensionResourcesForGarden,
      }}
      cropLibrary={{
        cropTemplateSyncStatus: gardenData.cropTemplateSyncStatus,
        isRefreshingCropLibrary: gardenData.isRefreshingCropLibrary,
        isCleaningLegacyCropLibrary: gardenData.isCleaningLegacyCropLibrary,
        refreshCropTemplateDatabase: gardenData.refreshCropTemplateDatabase,
        requestLegacyCropCleanup: gardenData.requestLegacyCropCleanup,
      }}
      loading={{
        isLoadingGardenData: gardenData.isLoadingGardenData,
        isLoadingWeather: gardenData.isLoadingWeather,
        isLoadingClimate: gardenData.isLoadingClimate,
        isLoadingPlantingWindows: gardenData.isLoadingPlantingWindows,
        isLoadingSunPath: gardenData.isLoadingSunPath,
        isLoadingSeasonalPlan: gardenData.isLoadingSeasonalPlan,
        isLoadingSensorSummary: gardenData.isLoadingSensorSummary,
        isLoadingTimeline: gardenData.isLoadingTimeline,
        isLoadingPlantingRecommendation: gardenData.isLoadingPlantingRecommendation,
        isLoadingExtensionResources: gardenData.isLoadingExtensionResources,
      }}
      plannerUi={{
        placementBedId,
        setPlacementBedId,
        plannerUndoCount,
        plannerRedoCount,
        undoPlannerChange,
        redoPlannerChange,
        plantingSettings: {
          plantingMethod,
          setPlantingMethod,
          plantingLocation,
          setPlantingLocation,
          plantingDate,
          setPlantingDate,
          plantingMovedOn,
          setPlantingMovedOn,
        },
      }}
      actions={{
        taskActions,
        gardenActions,
        cropFormState,
        plannerActions,
        coachState,
        pestLogActions,
        journalActions,
        derived,
      }}
      confirm={{
        confirmState,
        setConfirmState,
        isConfirmingAction,
        runConfirmedAction,
      }}
      notices={{
        notices,
        dismissNotice,
        pushNotice,
      }}
    />
  );
}
