import type { AppPageRouterProps } from "./AppPageRouter";
import { GARDEN_REQUIRED_PAGES } from "../hooks/usePageRouter";
import { CalendarPage } from "../../calendar/CalendarPage";
import { CoachPageSection } from "../../coach/CoachPageSection";
import { CropsPageSection } from "../../crops/CropsPageSection";
import { HomePageSection } from "../../home/HomePageSection";
import { PestsPageSection } from "../../pests/PestsPageSection";
import { SeasonalPlanPage } from "../../planning/SeasonalPlanPage";
import { PlannerPage } from "../../planner/PlannerPage";
import { SensorsPageSection } from "../../sensors/SensorsPageSection";
import { TimelinePageSection } from "../../timeline/TimelinePageSection";

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
  } = loading;
  const { placementBedId, setPlacementBedId, plannerUndoCount, plannerRedoCount, undoPlannerChange, redoPlannerChange } = plannerUi;
  const { taskActions, gardenActions, cropFormState, plannerActions, coachState, pestLogActions, derived } = actions;
  const { setConfirmState } = confirm;
  const { pushNotice } = notices;

  if (activePage === "home") {
    return (
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
    );
  }

  if (!selectedGarden && GARDEN_REQUIRED_PAGES.includes(activePage)) {
    return null;
  }

  switch (activePage) {
    case "timeline":
      return (
        <TimelinePageSection
          selectedGardenRecord={selectedGardenRecord}
          selectedGardenName={derived.selectedGardenName}
          timeline={gardenTimeline}
          isLoading={isLoadingTimeline}
          loadTimelineForGarden={loadTimelineForGarden}
        />
      );
    case "calendar":
      return (
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
      );
    case "planner":
      return (
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
      );
    case "seasonal":
      return (
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
      );
    case "sensors":
      return (
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
      );
    case "coach":
      return (
        <CoachPageSection
          selectedGardenName={derived.selectedGardenName}
          coachState={coachState}
          pushNotice={pushNotice}
        />
      );
    case "pests":
      return (
        <PestsPageSection
          pestLogActions={pestLogActions}
          selectedDate={selectedDate}
        />
      );
    case "crops":
    default:
      return (
        <CropsPageSection
          cropTemplates={cropTemplates}
          isRefreshingCropLibrary={isRefreshingCropLibrary}
          isCleaningLegacyCropLibrary={isCleaningLegacyCropLibrary}
          cropTemplateSyncStatus={cropTemplateSyncStatus}
          refreshCropTemplateDatabase={refreshCropTemplateDatabase}
          requestLegacyCropCleanup={requestLegacyCropCleanup}
          cropFormState={cropFormState}
        />
      );
  }
}