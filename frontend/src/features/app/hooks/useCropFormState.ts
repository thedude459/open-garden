import { FormEvent, useCallback } from "react";
import { getErrorMessage, hasValidationErrors } from "../utils/appUtils";
import { FetchAuthed } from "../types";
import { CropTemplate } from "../../types";
import { useCropTemplateDraftState } from "./useCropTemplateDraftState";
import { useCropTemplateSearchState } from "./useCropTemplateSearchState";

type NoticeKind = "info" | "success" | "error";

interface UseCropFormStateParams {
  fetchAuthed: FetchAuthed;
  pushNotice: (message: string, kind: NoticeKind) => void;
  selectedCropName: string;
  setSelectedCropName: (name: string) => void;
  loadCropTemplates: (selectName?: string) => Promise<void>;
  selectedGarden: number | null;
  loadGardenData: () => Promise<void>;
  cropTemplates: CropTemplate[];
  refreshTasks: () => Promise<void>;
}

export function useCropFormState({
  fetchAuthed,
  pushNotice,
  selectedCropName,
  setSelectedCropName,
  loadCropTemplates,
  selectedGarden,
  loadGardenData,
  cropTemplates,
  refreshTasks,
}: UseCropFormStateParams) {
  const draftState = useCropTemplateDraftState();
  const searchState = useCropTemplateSearchState({
    cropTemplates,
    selectedCropName,
    setSelectedCropName,
  });

  const {
    newCropName,
    setNewCropName,
    newCropVariety,
    setNewCropVariety,
    newCropFamily,
    setNewCropFamily,
    newCropSpacing,
    setNewCropSpacing,
    newCropDays,
    setNewCropDays,
    newCropPlantingWindow,
    setNewCropPlantingWindow,
    newCropDirectSow,
    setNewCropDirectSow,
    newCropFrostHardy,
    setNewCropFrostHardy,
    newCropWeeksToTransplant,
    setNewCropWeeksToTransplant,
    newCropNotes,
    setNewCropNotes,
    newCropImageUrl,
    setNewCropImageUrl,
    editingCropId,
    showCropValidation,
    setShowCropValidation,
    cropFormErrors,
    resetCropForm,
    populateCropForm,
  } = draftState;
  const {
    cropSearchQuery,
    setCropSearchQuery,
    cropSearchActiveIndex,
    filteredCropTemplates,
    selectCrop,
    handleCropSearchKeyDown,
  } = searchState;

  const upsertCropTemplate = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setShowCropValidation(true);
      if (hasValidationErrors(cropFormErrors)) return;

      try {
        const targetPath = editingCropId ? `/crop-templates/${editingCropId}` : "/crop-templates";
        const method = editingCropId ? "PATCH" : "POST";
        const savedCrop: CropTemplate = await fetchAuthed(targetPath, {
          method,
          body: JSON.stringify({
            name: newCropName.trim(),
            variety: newCropVariety.trim(),
            family: newCropFamily.trim(),
            spacing_in: Math.max(1, Math.round(newCropSpacing)),
            days_to_harvest: Math.max(1, Math.round(newCropDays)),
            planting_window: newCropPlantingWindow.trim() || "Spring",
            image_url: newCropImageUrl.trim(),
            direct_sow: newCropDirectSow,
            frost_hardy: newCropFrostHardy,
            weeks_to_transplant: Math.max(1, Math.round(newCropWeeksToTransplant)),
            notes: newCropNotes.trim(),
          }),
        });

        await loadCropTemplates(savedCrop.name);
        if (selectedGarden) {
          await loadGardenData();
          await refreshTasks();
        }
        resetCropForm();
        pushNotice(editingCropId ? "Vegetable updated." : "Vegetable added.", "success");
      } catch (err: unknown) {
        pushNotice(
          getErrorMessage(err, `Unable to ${editingCropId ? "update" : "add"} vegetable.`),
          "error",
        );
      }
    },
    [
      fetchAuthed,
      cropFormErrors,
      editingCropId,
      newCropName,
      newCropVariety,
      newCropFamily,
      newCropSpacing,
      newCropDays,
      newCropPlantingWindow,
      newCropImageUrl,
      newCropDirectSow,
      newCropFrostHardy,
      newCropWeeksToTransplant,
      newCropNotes,
      loadCropTemplates,
      selectedGarden,
      loadGardenData,
      refreshTasks,
      resetCropForm,
      pushNotice,
    ],
  );

  return {
    newCropName,
    setNewCropName,
    newCropVariety,
    setNewCropVariety,
    newCropFamily,
    setNewCropFamily,
    newCropSpacing,
    setNewCropSpacing,
    newCropDays,
    setNewCropDays,
    newCropPlantingWindow,
    setNewCropPlantingWindow,
    newCropDirectSow,
    setNewCropDirectSow,
    newCropFrostHardy,
    setNewCropFrostHardy,
    newCropWeeksToTransplant,
    setNewCropWeeksToTransplant,
    newCropNotes,
    setNewCropNotes,
    newCropImageUrl,
    setNewCropImageUrl,
    cropSearchQuery,
    setCropSearchQuery,
    cropSearchActiveIndex,
    editingCropId,
    showCropValidation,
    filteredCropTemplates,
    cropFormErrors,
    selectCrop,
    resetCropForm,
    populateCropForm,
    handleCropSearchKeyDown,
    upsertCropTemplate,
  };
}
