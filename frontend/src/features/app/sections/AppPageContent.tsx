import { lazy, Suspense } from "react";
import type { AppPageRouterProps } from "./AppPageRouter";
import { GARDEN_REQUIRED_PAGES } from "../hooks/usePageRouter";

const HomePageSection = lazy(() =>
  import("../../home/HomePageSection").then((m) => ({ default: m.HomePageSection })),
);
const TimelinePageSection = lazy(() =>
  import("../../timeline/TimelinePageSection").then((m) => ({ default: m.TimelinePageSection })),
);
const CalendarPage = lazy(() =>
  import("../../calendar/CalendarPage").then((m) => ({ default: m.CalendarPage })),
);
const PlannerPage = lazy(() =>
  import("../../planner/PlannerPage").then((m) => ({ default: m.PlannerPage })),
);
const SeasonalPlanPage = lazy(() =>
  import("../../planning/SeasonalPlanPage").then((m) => ({ default: m.SeasonalPlanPage })),
);
const SensorsPageSection = lazy(() =>
  import("../../sensors/SensorsPageSection").then((m) => ({ default: m.SensorsPageSection })),
);
const CoachPageSection = lazy(() =>
  import("../../coach/CoachPageSection").then((m) => ({ default: m.CoachPageSection })),
);
const PestsPageSection = lazy(() =>
  import("../../pests/PestsPageSection").then((m) => ({ default: m.PestsPageSection })),
);
const CropsPageSection = lazy(() =>
  import("../../crops/CropsPageSection").then((m) => ({ default: m.CropsPageSection })),
);

function PageRouteFallback() {
  return (
    <div className="page-route-fallback" role="status" aria-live="polite" aria-busy="true">
      <p className="page-route-fallback-text">Loading this section…</p>
    </div>
  );
}

type AppPageContentProps = Pick<
  AppPageRouterProps,
  "routing" | "garden" | "calendar" | "insights" | "cropLibrary" | "loading" | "plannerUi" | "actions" | "confirm" | "notices"
>;

export function AppPageContent({
  routing,
  garden,
  calendar,
  insights,
  cropLibrary,
  loading,
  plannerUi,
  actions,
  confirm,
  notices,
}: AppPageContentProps) {
  const { activePage, setActivePage, navigateTo } = routing;
  const { selectedGarden, setSelectedGarden, selectedGardenRecord, gardens, publicGardens, beds, placements, cropTemplates } = garden;
  const { today, monthCursor, setMonthCursor, selectedDate, setSelectedDate, selectedCropName } = calendar;
  const {
    weather,
    gardenClimate,
    gardenSunPath,
    seasonalPlan,
    selectedRecommendationPlantingId,
    setSelectedRecommendationPlantingId,
    plantingRecommendation,
    refreshSeasonalPlan,
    sensorSummary,
    gardenTimeline,
    loadTimelineForGarden,
    loadSensorSummaryForGarden,
    gardenExtensionResources,
    loadExtensionResourcesForGarden,
  } = insights;
  const {
    cropTemplateSyncStatus,
    isRefreshingCropLibrary,
    isCleaningLegacyCropLibrary,
    refreshCropTemplateDatabase,
    requestLegacyCropCleanup,
  } = cropLibrary;
  const {
    isLoadingGardenData,
    isLoadingWeather,
    isLoadingClimate,
    isLoadingPlantingWindows,
    isLoadingSunPath,
    isLoadingSeasonalPlan,
    isLoadingSensorSummary,
    isLoadingTimeline,
    isLoadingPlantingRecommendation,
    isLoadingExtensionResources,
  } = loading;
  const { placementBedId, setPlacementBedId, plannerUndoCount, plannerRedoCount, undoPlannerChange, redoPlannerChange, plantingSettings } = plannerUi;
  const { taskActions, gardenActions, cropFormState, plannerActions, coachState, pestLogActions, derived } = actions;
  const { setConfirmState } = confirm;
  const { pushNotice } = notices;

  if (activePage === "home") {
    return (
      <Suspense fallback={<PageRouteFallback />}>
        <HomePageSection
          selectedGarden={selectedGarden}
          selectedGardenRecord={selectedGardenRecord}
          gardens={gardens}
          publicGardens={publicGardens}
          beds={beds}
          placements={placements}
          cropTemplatesCount={cropTemplates.length}
          gardenClimate={gardenClimate}
          gardenExtensionResources={gardenExtensionResources}
          loadExtensionResourcesForGarden={loadExtensionResourcesForGarden}
          isLoadingWeather={isLoadingWeather}
          isLoadingClimate={isLoadingClimate}
          isLoadingExtensionResources={isLoadingExtensionResources}
          derived={derived}
          taskActions={taskActions}
          gardenActions={gardenActions}
          plannerActions={plannerActions}
          setSelectedGarden={setSelectedGarden}
          onNavigate={navigateTo}
        />
      </Suspense>
    );
  }

  if (!selectedGarden && GARDEN_REQUIRED_PAGES.includes(activePage)) {
    return null;
  }

  switch (activePage) {
    case "timeline":
      return (
        <Suspense fallback={<PageRouteFallback />}>
          <TimelinePageSection
            selectedGardenRecord={selectedGardenRecord}
            selectedGardenName={derived.selectedGardenName}
            timeline={gardenTimeline}
            isLoading={isLoadingTimeline}
            loadTimelineForGarden={loadTimelineForGarden}
          />
        </Suspense>
      );
    case "calendar":
      return (
        <Suspense fallback={<PageRouteFallback />}>
          <CalendarPage
            monthCursor={monthCursor}
            setMonthCursor={setMonthCursor}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            today={today}
            beds={beds}
            weather={weather}
            gardenClimate={gardenClimate}
            taskActions={taskActions}
            cropFormState={cropFormState}
            derived={derived}
            selectedCropName={selectedCropName}
            isLoadingPlantingWindows={isLoadingPlantingWindows}
            isLoadingClimate={isLoadingClimate}
            isLoadingWeather={isLoadingWeather}
            pushNotice={pushNotice}
          />
        </Suspense>
      );
    case "planner":
      return (
        <Suspense fallback={<PageRouteFallback />}>
          <PlannerPage
            beds={beds}
            placements={placements}
            cropTemplates={cropTemplates}
            selectedCropName={selectedCropName}
            selectedGardenRecord={selectedGardenRecord}
            gardenSunPath={gardenSunPath}
            derived={derived}
            cropFormState={cropFormState}
            gardenActions={gardenActions}
            plannerActions={plannerActions}
            placementBedId={placementBedId}
            setPlacementBedId={setPlacementBedId}
            plantingSettings={plantingSettings}
            plannerUndoCount={plannerUndoCount}
            plannerRedoCount={plannerRedoCount}
            undoPlannerChange={undoPlannerChange}
            redoPlannerChange={redoPlannerChange}
            isLoadingGardenData={isLoadingGardenData}
            isLoadingSunPath={isLoadingSunPath}
            isLoadingPlantingWindows={isLoadingPlantingWindows}
            pushNotice={pushNotice}
            setConfirmState={setConfirmState}
            onGoToCrops={() => setActivePage("crops")}
          />
        </Suspense>
      );
    case "seasonal":
      return (
        <Suspense fallback={<PageRouteFallback />}>
          <SeasonalPlanPage
            selectedGardenName={derived.selectedGardenName}
            seasonalPlan={seasonalPlan}
            selectedRecommendationPlantingId={selectedRecommendationPlantingId}
            plantingRecommendation={plantingRecommendation}
            setSelectedRecommendationPlantingId={setSelectedRecommendationPlantingId}
            refreshSeasonalPlan={refreshSeasonalPlan}
            isLoadingSeasonalPlan={isLoadingSeasonalPlan}
            isLoadingPlantingRecommendation={isLoadingPlantingRecommendation}
            pushNotice={pushNotice}
          />
        </Suspense>
      );
    case "sensors":
      return (
        <Suspense fallback={<PageRouteFallback />}>
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
        </Suspense>
      );
    case "coach":
      return (
        <Suspense fallback={<PageRouteFallback />}>
          <CoachPageSection
            selectedGardenName={derived.selectedGardenName}
            coachState={coachState}
            pushNotice={pushNotice}
          />
        </Suspense>
      );
    case "pests":
      return (
        <Suspense fallback={<PageRouteFallback />}>
          <PestsPageSection
            pestLogActions={pestLogActions}
            selectedDate={selectedDate}
          />
        </Suspense>
      );
    case "crops":
    default:
      return (
        <Suspense fallback={<PageRouteFallback />}>
          <CropsPageSection
            cropTemplates={cropTemplates}
            isRefreshingCropLibrary={isRefreshingCropLibrary}
            isCleaningLegacyCropLibrary={isCleaningLegacyCropLibrary}
            cropTemplateSyncStatus={cropTemplateSyncStatus}
            refreshCropTemplateDatabase={refreshCropTemplateDatabase}
            requestLegacyCropCleanup={requestLegacyCropCleanup}
            cropFormState={cropFormState}
          />
        </Suspense>
      );
  }
}
