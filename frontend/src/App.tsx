import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppNavbar } from "./components/AppNavbar";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { HelpModal } from "./components/HelpModal";
import { ToastRegion } from "./components/ToastRegion";
import { AppPage, ConfirmState } from "./features/app/types";
import { useAuthFlow } from "./features/app/hooks/useAuthFlow";
import { useAuthedFetch } from "./features/app/hooks/useAuthedFetch";
import { useCoachState } from "./features/app/hooks/useCoachState";
import { useCropFormState } from "./features/app/hooks/useCropFormState";
import { useDerivedGardenState } from "./features/app/hooks/useDerivedGardenState";
import { useGardenActions } from "./features/app/hooks/useGardenActions";
import { useGardenDataFlow } from "./features/app/hooks/useGardenDataFlow";
import { useNotices } from "./features/app/hooks/useNotices";
import { usePageRouter, GARDEN_REQUIRED_PAGES } from "./features/app/hooks/usePageRouter";
import { usePestLogActions } from "./features/app/hooks/usePestLogActions";
import { usePlannerActions } from "./features/app/hooks/usePlannerActions";
import { usePlannerHistory } from "./features/app/hooks/usePlannerHistory";
import { useTaskActions } from "./features/app/hooks/useTaskActions";
import { isoDate } from "./features/app/utils";
import { EmailVerificationNotice } from "./features/app/sections/EmailVerificationNotice";
import { GardenRequiredNotice } from "./features/app/sections/GardenRequiredNotice";
import { AuthScreen } from "./features/auth/AuthScreen";
import { HomePageSection } from "./features/home/HomePageSection";
import { CalendarProvider } from "./features/calendar/CalendarContext";
import { CalendarWeatherSection } from "./features/calendar/CalendarWeatherSection";
import { CoachPageSection } from "./features/coach/CoachPageSection";
import { CropsPageSection } from "./features/crops/CropsPageSection";
import { PestsPageSection } from "./features/pests/PestsPageSection";
import { SeasonalPlanProvider } from "./features/planning/SeasonalPlanContext";
import { SeasonalPageSection } from "./features/planning/SeasonalPageSection";
import { PlannerProvider } from "./features/planner/PlannerContext";
import { PlannerPageSection } from "./features/planner/PlannerPageSection";
import { SensorsPageSection } from "./features/sensors/SensorsPageSection";
import { TimelinePageSection } from "./features/timeline/TimelinePageSection";

function App() {
  const today = useMemo(() => isoDate(new Date()), []);

  const [token, setToken] = useState<string>(localStorage.getItem("open-garden-token") || "");
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const { notices, dismissNotice, pushNotice } = useNotices();
  const { authHeaders, fetchAuthed } = useAuthedFetch(token, setToken);
  const authFlow = useAuthFlow({ setToken, authHeaders, pushNotice });
  const {
    plannerUndoCount, plannerRedoCount,
    pushPlannerHistory, undoPlannerChange, redoPlannerChange, resetPlannerHistory,
  } = usePlannerHistory((message, kind) => pushNotice(message, kind));

  const yardGridRef = useRef<HTMLDivElement>(null);

  const {
    gardens, setGardens, publicGardens,
    selectedGarden, setSelectedGarden,
    beds, setBeds, plantings, setPlantings, placements, setPlacements,
    cropTemplates, weather, gardenClimate, plantingWindows, gardenSunPath,
    seasonalPlan, sensorSummary, gardenTimeline,
    plantingRecommendation, selectedRecommendationPlantingId, setSelectedRecommendationPlantingId,
    cropTemplateSyncStatus, isRefreshingCropLibrary, isCleaningLegacyCropLibrary,
    isLoadingGardenData, isLoadingWeather, isLoadingClimate, isLoadingPlantingWindows,
    isLoadingSunPath, isLoadingSeasonalPlan, isLoadingSensorSummary,
    isLoadingTimeline, isLoadingPlantingRecommendation,
    selectedCropName, setSelectedCropName,
    loadGardens, loadCropTemplates, loadGardenData,
    loadClimateForGarden, loadPlantingWindowsForGarden, loadSunPathForGarden,
    loadSeasonalPlanForGarden, loadSensorSummaryForGarden, loadTimelineForGarden,
    loadPlantingRecommendation,
    refreshCropTemplateDatabase, requestLegacyCropCleanup, refreshSeasonalPlan,
    invalidateGardenInsightCaches, invalidateSensorCaches, invalidateSeasonalPlanCache,
    noticeUnlessExpired,
  } = useGardenDataFlow({ token, fetchAuthed, pushNotice, setIsEmailVerified: authFlow.setIsEmailVerified, setConfirmState });

  const pageRouter = usePageRouter({
    token,
    authFlow,
    pushNotice,
    selectedGarden,
  });

  const { activePage, setActivePage, navigateTo, isNavOpen, setIsNavOpen, isHelpOpen, setIsHelpOpen, monthCursor, setMonthCursor, selectedDate, setSelectedDate, placementBedId, setPlacementBedId } = pageRouter;

  const selectedGardenRecord = useMemo(
    () => gardens.find((g) => g.id === selectedGarden),
    [gardens, selectedGarden],
  );

  const taskActions = useTaskActions({
    fetchAuthed, pushNotice, token, selectedGarden,
    beds, cropTemplates, setPlantings,
    invalidateSeasonalPlanCache, loadGardenData, setSelectedCropName,
  });

  const gardenActions = useGardenActions({
    fetchAuthed, pushNotice, selectedGarden, selectedGardenRecord,
    loadGardens, loadGardenData, invalidateGardenInsightCaches,
    loadClimateForGarden, loadPlantingWindowsForGarden, loadSunPathForGarden,
    setGardens, invalidateSensorCaches, loadSensorSummaryForGarden, setBeds,
  });

  const cropFormState = useCropFormState({
    fetchAuthed, pushNotice, selectedCropName, setSelectedCropName,
    loadCropTemplates, selectedGarden, loadGardenData, cropTemplates,
    refreshTasks: taskActions.refreshTasks,
  });

  const derived = useDerivedGardenState({
    today, tasks: taskActions.tasks, plantings, monthCursor, selectedDate,
    cropTemplates, plantingWindows, weather, gardenClimate,
    selectedCropName, selectedGardenRecord,
  });

  const plannerActions = usePlannerActions({
    fetchAuthed, pushNotice, setBeds, setPlacements,
    beds, placements, selectedGarden, selectedGardenRecord,
    yardWidthFt: derived.yardWidthFt, yardLengthFt: derived.yardLengthFt,
    cropMap: derived.cropMap, selectedCropName, selectedDate, pushPlannerHistory,
    setConfirmState, loadGardens, loadGardenData,
    setSelectedGarden, setTasks: taskActions.setTasks, setPlantings,
  });

  const coachState = useCoachState({ fetchAuthed, selectedGardenRecord });

  const pestLogActions = usePestLogActions({
    fetchAuthed, pushNotice, token, selectedGarden,
    activePage, setConfirmState,
  });

  const runConfirmedAction = useCallback(async () => {
    if (!confirmState) return;
    try {
      setIsConfirmingAction(true);
      await confirmState.onConfirm();
    } catch (err: any) {
      pushNotice(err?.message || "Unable to complete action.", "error");
    } finally {
      setIsConfirmingAction(false);
      setConfirmState(null);
    }
  }, [confirmState, pushNotice]);

  function toFeet(inches: number) {
    return `${(inches / 12).toFixed(1)} ft`;
  }

  // Page data loading effects
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
    loadPlantingRecommendation(selectedRecommendationPlantingId).catch(() => pushNotice("Unable to load planting recommendations.", "error"));
  }, [token, activePage, selectedRecommendationPlantingId, loadPlantingRecommendation, pushNotice]);

  // Reset coach state and planner history when garden changes
  useEffect(() => {
    coachState.resetCoach();
    resetPlannerHistory();
  }, [selectedGarden, coachState, resetPlannerHistory]);

  if (!token) {
    return (
      <AuthScreen
        email={authFlow.email} setEmail={authFlow.setEmail}
        username={authFlow.username} setUsername={authFlow.setUsername}
        password={authFlow.password} setPassword={authFlow.setPassword}
        loginMode={authFlow.loginMode} setLoginMode={authFlow.setLoginMode}
        authPane={authFlow.authPane} setAuthPane={authFlow.setAuthPane}
        setResetToken={authFlow.setResetToken}
        resetPassword={authFlow.resetPassword} setResetPassword={authFlow.setResetPassword}
        handleAuth={authFlow.handleAuth}
        handleForgotPassword={authFlow.handleForgotPassword}
        handleForgotUsername={authFlow.handleForgotUsername}
        submitPasswordReset={authFlow.submitPasswordReset}
        notices={notices}
        dismissNotice={dismissNotice}
      />
    );
  }

  return (
    <main className="shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <AppNavbar
        activePage={activePage}
        selectedGarden={selectedGarden}
        selectedGardenRecord={selectedGardenRecord}
        isNavOpen={isNavOpen}
        setIsNavOpen={setIsNavOpen}
        onNavigate={navigateTo}
        onLogout={() => { localStorage.removeItem("open-garden-token"); setToken(""); }}
        onHelpOpen={() => { setIsNavOpen(false); setIsHelpOpen(true); }}
      />

      <div className="page-body" id="main-content" tabIndex={-1}>
        {authFlow.isEmailVerified === false && (
          <EmailVerificationNotice
            onResend={() => {
              authFlow.resendVerificationEmail()
                .then(() => pushNotice("Verification email sent.", "success"))
                .catch((err: any) => pushNotice(err?.message || "Unable to resend verification email.", "error"));
            }}
          />
        )}

        {!selectedGarden && GARDEN_REQUIRED_PAGES.includes(activePage) && (
          <GardenRequiredNotice onGoHome={() => setActivePage("home")} />
        )}

        {activePage === "timeline" && selectedGarden && (
          <TimelinePageSection
            selectedGardenRecord={selectedGardenRecord}
            selectedGardenName={derived.selectedGardenName}
            timeline={gardenTimeline}
            isLoading={isLoadingTimeline}
            loadTimelineForGarden={loadTimelineForGarden}
          />
        )}

        {activePage === "home" && (
          <HomePageSection
            selectedGarden={selectedGarden}
            selectedGardenRecord={selectedGardenRecord}
            gardens={gardens}
            publicGardens={publicGardens}
            beds={beds}
            placements={placements}
            cropTemplatesCount={cropTemplates.length}
            gardenClimate={gardenClimate}
            isLoadingWeather={isLoadingWeather}
            isLoadingClimate={isLoadingClimate}
            derived={derived}
            taskActions={taskActions}
            gardenActions={gardenActions}
            plannerActions={plannerActions}
            setSelectedGarden={setSelectedGarden}
            onNavigate={navigateTo}
          />
        )}

        {activePage === "calendar" && selectedGarden && (
          <CalendarProvider
            value={{
              monthCursor,
              setMonthCursor,
              selectedDate,
              setSelectedDate,
              today,
              beds,
              weather,
              gardenClimate,
              taskActions,
              cropFormState,
              derived,
              selectedCropName,
              isLoadingPlantingWindows,
              isLoadingClimate,
              isLoadingWeather,
              pushNotice,
            }}
          >
            <CalendarWeatherSection />
          </CalendarProvider>
        )}

        {activePage === "planner" && selectedGarden && (
          <PlannerProvider
            value={{
              beds,
              placements,
              cropTemplates,
              selectedCropName,
              selectedGardenRecord,
              gardenSunPath,
              yardGridRef,
              derived,
              cropFormState,
              gardenActions,
              plannerActions,
              placementBedId,
              setPlacementBedId,
              plannerUndoCount,
              plannerRedoCount,
              undoPlannerChange,
              redoPlannerChange,
              isLoadingGardenData,
              isLoadingSunPath,
              isLoadingPlantingWindows,
              pushNotice,
              setConfirmState,
              toFeet,
              onGoToCrops: () => setActivePage("crops"),
            }}
          >
            <PlannerPageSection />
          </PlannerProvider>
        )}

        {activePage === "seasonal" && selectedGarden && (
          <SeasonalPlanProvider
            value={{
              selectedGardenName: derived.selectedGardenName,
              seasonalPlan,
              selectedRecommendationPlantingId,
              plantingRecommendation,
              setSelectedRecommendationPlantingId,
              refreshSeasonalPlan,
              isLoadingSeasonalPlan,
              isLoadingPlantingRecommendation,
              pushNotice,
            }}
          >
            <SeasonalPageSection />
          </SeasonalPlanProvider>
        )}

        {activePage === "sensors" && selectedGarden && (
          <SensorsPageSection
            selectedGardenName={derived.selectedGardenName}
            selectedGardenRecord={selectedGardenRecord}
            beds={beds}
            summary={sensorSummary}
            isLoading={isLoadingSensorSummary}
            loadSensorSummaryForGarden={loadSensorSummaryForGarden}
            gardenActions={gardenActions}
            pushNotice={pushNotice}
          />
        )}

        {activePage === "coach" && selectedGarden && (
          <CoachPageSection
            selectedGardenName={derived.selectedGardenName}
            coachState={coachState}
            pushNotice={pushNotice}
          />
        )}

        {activePage === "crops" && (
          <CropsPageSection
            cropTemplates={cropTemplates}
            isRefreshingCropLibrary={isRefreshingCropLibrary}
            isCleaningLegacyCropLibrary={isCleaningLegacyCropLibrary}
            cropTemplateSyncStatus={cropTemplateSyncStatus}
            refreshCropTemplateDatabase={refreshCropTemplateDatabase}
            requestLegacyCropCleanup={requestLegacyCropCleanup}
            cropFormState={cropFormState}
          />
        )}

        {activePage === "pests" && selectedGarden && (
          <PestsPageSection
            pestLogActions={pestLogActions}
            selectedDate={selectedDate}
          />
        )}
      </div>

      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title || "Confirm action"}
        message={confirmState?.message || "Are you sure?"}
        confirmLabel={isConfirmingAction ? "Working..." : confirmState?.confirmLabel || "Confirm"}
        onConfirm={() => { if (!isConfirmingAction) runConfirmedAction(); }}
        onCancel={() => { if (!isConfirmingAction) setConfirmState(null); }}
      />

      <HelpModal
        isOpen={isHelpOpen}
        onClose={(remember) => {
          setIsHelpOpen(false);
          if (remember) localStorage.setItem("open-garden-help-seen", "1");
        }}
      />

      <ToastRegion
        notices={notices}
        onDismiss={dismissNotice}
        onAction={(id) => {
          const n = notices.find((notice) => notice.id === id);
          if (n?.onAction) n.onAction();
          dismissNotice(id);
        }}
      />
    </main>
  );
}

export default App;
