import { cropBaseName } from "../app/cropUtils";
import { CropsPanel } from "./CropsPanel";

type CropsPageSectionProps = {
  cropTemplates: any[];
  isRefreshingCropLibrary: boolean;
  isCleaningLegacyCropLibrary: boolean;
  cropTemplateSyncStatus: any;
  refreshCropTemplateDatabase: () => Promise<void>;
  requestLegacyCropCleanup: () => void;
  cropFormState: any;
};

export function CropsPageSection({
  cropTemplates,
  isRefreshingCropLibrary,
  isCleaningLegacyCropLibrary,
  cropTemplateSyncStatus,
  refreshCropTemplateDatabase,
  requestLegacyCropCleanup,
  cropFormState,
}: CropsPageSectionProps) {
  return (
    <CropsPanel
      cropTemplates={cropTemplates}
      isRefreshingLibrary={isRefreshingCropLibrary}
      isCleaningLegacyLibrary={isCleaningLegacyCropLibrary}
      syncStatus={cropTemplateSyncStatus}
      onRefreshLibrary={() => refreshCropTemplateDatabase().catch(() => undefined)}
      onCleanupLegacyLibrary={requestLegacyCropCleanup}
      editingCropId={cropFormState.editingCropId}
      newCropName={cropFormState.newCropName}
      onNewCropNameChange={cropFormState.setNewCropName}
      newCropVariety={cropFormState.newCropVariety}
      onNewCropVarietyChange={cropFormState.setNewCropVariety}
      newCropFamily={cropFormState.newCropFamily}
      onNewCropFamilyChange={cropFormState.setNewCropFamily}
      newCropSpacing={cropFormState.newCropSpacing}
      onNewCropSpacingChange={cropFormState.setNewCropSpacing}
      newCropDays={cropFormState.newCropDays}
      onNewCropDaysChange={cropFormState.setNewCropDays}
      newCropPlantingWindow={cropFormState.newCropPlantingWindow}
      onNewCropPlantingWindowChange={cropFormState.setNewCropPlantingWindow}
      newCropDirectSow={cropFormState.newCropDirectSow}
      onNewCropDirectSowChange={cropFormState.setNewCropDirectSow}
      newCropFrostHardy={cropFormState.newCropFrostHardy}
      onNewCropFrostHardyChange={cropFormState.setNewCropFrostHardy}
      newCropWeeksToTransplant={cropFormState.newCropWeeksToTransplant}
      onNewCropWeeksToTransplantChange={cropFormState.setNewCropWeeksToTransplant}
      newCropNotes={cropFormState.newCropNotes}
      onNewCropNotesChange={cropFormState.setNewCropNotes}
      newCropImageUrl={cropFormState.newCropImageUrl}
      onNewCropImageUrlChange={cropFormState.setNewCropImageUrl}
      cropErrors={{
        name: cropFormState.showCropValidation ? cropFormState.cropFormErrors.name : "",
        spacing: cropFormState.showCropValidation ? cropFormState.cropFormErrors.spacing : "",
        days: cropFormState.showCropValidation ? cropFormState.cropFormErrors.days : "",
        planting_window: cropFormState.showCropValidation ? cropFormState.cropFormErrors.planting_window : "",
        weeks_to_transplant: cropFormState.showCropValidation ? cropFormState.cropFormErrors.weeks_to_transplant : "",
      }}
      onUpsertCropTemplate={cropFormState.upsertCropTemplate}
      onResetCropForm={cropFormState.resetCropForm}
      onPopulateCropForm={cropFormState.populateCropForm}
      cropBaseName={cropBaseName}
    />
  );
}
