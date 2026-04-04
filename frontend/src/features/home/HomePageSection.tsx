import { CreateGardenForm } from "./CreateGardenForm";
import { GardenListSidebar } from "./GardenListSidebar";
import { HomeHero } from "./HomeHero";
import { MicroclimateProfileCard } from "./MicroclimateProfileCard";
import { AppPage } from "../app/types";
import { Garden, GardenClimate } from "../types";

type HomePageSectionProps = {
  selectedGarden: number | null;
  selectedGardenRecord: Garden | undefined;
  gardens: Garden[];
  publicGardens: Garden[];
  beds: { id: number }[];
  placements: { id: number }[];
  cropTemplatesCount: number;
  gardenClimate: GardenClimate | null;
  isLoadingWeather: boolean;
  isLoadingClimate: boolean;
  derived: any;
  taskActions: any;
  gardenActions: any;
  plannerActions: any;
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
  isLoadingWeather,
  isLoadingClimate,
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
        <div className="home-management-column">
          <GardenListSidebar
            gardens={gardens}
            publicGardens={publicGardens}
            selectedGarden={selectedGarden}
            onSelectGarden={setSelectedGarden}
            onDeleteGarden={(id) => plannerActions.deleteGarden(id).catch(() => undefined)}
          />
        </div>
        <div className="home-main-column">
          <CreateGardenForm
            gardenDraft={gardenActions.gardenDraft}
            setGardenDraft={gardenActions.setGardenDraft}
            showGardenValidation={gardenActions.showGardenValidation}
            gardenFormErrors={gardenActions.gardenFormErrors}
            onSubmit={gardenActions.createGarden}
          />
          {selectedGarden && selectedGardenRecord && (
            <MicroclimateProfileCard
              selectedGardenRecord={selectedGardenRecord}
              gardenClimate={gardenClimate}
              isLoadingClimate={isLoadingClimate}
              microclimateDraft={gardenActions.microclimateDraft}
              setMicroclimateDraft={gardenActions.setMicroclimateDraft}
              microclimateSuggestion={gardenActions.microclimateSuggestion}
              isGeocodingAddress={gardenActions.isGeocodingAddress}
              isSuggestingMicroclimate={gardenActions.isSuggestingMicroclimate}
              onSubmit={gardenActions.saveMicroclimateProfile}
              onGeocode={gardenActions.geocodeGardenAddress}
              onSuggest={gardenActions.suggestMicrocliamateProfile}
            />
          )}
        </div>
      </div>
    </>
  );
}
