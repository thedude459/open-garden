import { CreateGardenForm } from "./CreateGardenForm";
import { GardenListSidebar } from "./GardenListSidebar";
import { HomeHero } from "./HomeHero";
import { HomeWelcomeCard } from "./HomeWelcomeCard";
import { MicroclimateProfileCard } from "./MicroclimateProfileCard";
import { AppPage } from "../app/types";
import { Bed, Garden, GardenClimate, GardenExtensionResources, Placement } from "../types";
import { useDerivedGardenState } from "../app/hooks/useDerivedGardenState";
import { useGardenActions } from "../app/hooks/useGardenActions";
import { usePlannerActions } from "../app/hooks/usePlannerActions";
import { useTaskActions } from "../app/hooks/useTaskActions";

type HomePageSectionProps = {
  selectedGarden: number | null;
  selectedGardenRecord: Garden | undefined;
  gardens: Garden[];
  publicGardens: Garden[];
  beds: Bed[];
  placements: Placement[];
  cropTemplatesCount: number;
  gardenClimate: GardenClimate | null;
  gardenExtensionResources: GardenExtensionResources | null;
  loadExtensionResourcesForGarden: (garden: Garden) => Promise<void>;
  isLoadingWeather: boolean;
  isLoadingClimate: boolean;
  isLoadingExtensionResources: boolean;
  derived: ReturnType<typeof useDerivedGardenState>;
  taskActions: ReturnType<typeof useTaskActions>;
  gardenActions: ReturnType<typeof useGardenActions>;
  plannerActions: ReturnType<typeof usePlannerActions>;
  setSelectedGarden: (id: number) => void;
  onNavigate: (page: AppPage) => void;
};

export function HomePageSection({
  selectedGarden,
  selectedGardenRecord,
  gardens,
  publicGardens,
  beds,
  placements,
  cropTemplatesCount,
  gardenClimate,
  gardenExtensionResources,
  loadExtensionResourcesForGarden,
  isLoadingWeather,
  isLoadingClimate,
  isLoadingExtensionResources,
  derived,
  taskActions,
  gardenActions,
  plannerActions,
  setSelectedGarden,
  onNavigate,
}: HomePageSectionProps) {
  return (
    <>
      {selectedGarden && selectedGardenRecord && (
        <HomeHero
          garden={selectedGardenRecord}
          beds={beds}
          placements={placements}
          tasks={taskActions.tasks}
          cropTemplateCount={cropTemplatesCount}
          gardenClimate={gardenClimate}
          homeTaskPreview={derived.homeTaskPreview}
          overdueTaskCount={derived.overdueTaskCount}
          upcomingTaskCount={derived.upcomingTaskCount}
          weatherPreview={derived.weatherPreview}
          isLoadingWeather={isLoadingWeather}
          actionablePlantingWindows={derived.actionablePlantingWindows}
          weatherRiskCues={derived.weatherRiskCues}
          onNavigate={onNavigate}
        />
      )}
      <div className="home-layout">
        <div className="home-sidebar">
          {selectedGarden && selectedGardenRecord ? (
            <details className="home-create-garden-collapsible">
              <summary>Create another garden</summary>
              <CreateGardenForm
                gardenDraft={gardenActions.gardenDraft}
                setGardenDraft={gardenActions.setGardenDraft}
                showGardenValidation={gardenActions.showGardenValidation}
                gardenFormErrors={gardenActions.gardenFormErrors}
                onSubmit={gardenActions.createGarden}
              />
            </details>
          ) : (
            <CreateGardenForm
              gardenDraft={gardenActions.gardenDraft}
              setGardenDraft={gardenActions.setGardenDraft}
              showGardenValidation={gardenActions.showGardenValidation}
              gardenFormErrors={gardenActions.gardenFormErrors}
              onSubmit={gardenActions.createGarden}
            />
          )}
          <GardenListSidebar
            gardens={gardens}
            publicGardens={publicGardens}
            selectedGarden={selectedGarden}
            onSelectGarden={setSelectedGarden}
            onDeleteGarden={(id) => plannerActions.deleteGarden(id).catch(() => undefined)}
          />
        </div>
        <div className="home-main">
          {!(selectedGarden && selectedGardenRecord) && (
            <HomeWelcomeCard hasAnyGarden={gardens.length > 0} />
          )}
          {selectedGarden && selectedGardenRecord && (
            <MicroclimateProfileCard
              selectedGardenRecord={selectedGardenRecord}
              gardenClimate={gardenClimate}
              gardenExtensionResources={gardenExtensionResources}
              loadExtensionResourcesForGarden={loadExtensionResourcesForGarden}
              isLoadingClimate={isLoadingClimate}
              isLoadingExtensionResources={isLoadingExtensionResources}
              microclimateDraft={gardenActions.microclimateDraft}
              setMicroclimateDraft={gardenActions.setMicroclimateDraft}
              microclimateSuggestion={gardenActions.microclimateSuggestion}
              isGeocodingAddress={gardenActions.isGeocodingAddress}
              isSuggestingMicroclimate={gardenActions.isSuggestingMicroclimate}
              onSubmit={gardenActions.saveMicroclimateProfile}
              onGeocode={gardenActions.geocodeGardenAddress}
              onSuggest={gardenActions.suggestMicroclimateProfile}
            />
          )}
        </div>
      </div>
    </>
  );
}
