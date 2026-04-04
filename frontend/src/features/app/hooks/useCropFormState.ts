import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useState } from "react";
import { cropBaseName, cropDisplayName } from "../cropUtils";
import { hasValidationErrors } from "../utils";
import { CropTemplate } from "../../types";

type NoticeKind = "info" | "success" | "error";

interface UseCropFormStateParams {
  fetchAuthed: (url: string, options?: RequestInit) => Promise<any>;
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
  const [newCropName, setNewCropName] = useState("");
  const [newCropVariety, setNewCropVariety] = useState("");
  const [newCropFamily, setNewCropFamily] = useState("");
  const [newCropSpacing, setNewCropSpacing] = useState(12);
  const [newCropDays, setNewCropDays] = useState(60);
  const [newCropPlantingWindow, setNewCropPlantingWindow] = useState("Spring");
  const [newCropDirectSow, setNewCropDirectSow] = useState(true);
  const [newCropFrostHardy, setNewCropFrostHardy] = useState(false);
  const [newCropWeeksToTransplant, setNewCropWeeksToTransplant] = useState(6);
  const [newCropNotes, setNewCropNotes] = useState("");
  const [newCropImageUrl, setNewCropImageUrl] = useState("");
  const [cropSearchQuery, setCropSearchQuery] = useState("");
  const [cropSearchActiveIndex, setCropSearchActiveIndex] = useState(0);
  const [editingCropId, setEditingCropId] = useState<number | null>(null);
  const [showCropValidation, setShowCropValidation] = useState(false);

  const filteredCropTemplates = useMemo(() => {
    const query = cropSearchQuery.trim().toLowerCase();
    if (!query) return cropTemplates;
    return cropTemplates.filter((crop) => {
      const haystack = [crop.name, crop.variety, crop.family].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [cropSearchQuery, cropTemplates]);

  const cropFormErrors = useMemo(
    () => ({
      name: newCropName.trim() ? "" : "Crop name is required.",
      spacing: newCropSpacing >= 1 ? "" : "Spacing must be at least 1 inch.",
      days: newCropDays >= 1 ? "" : "Days to harvest must be at least 1.",
      planting_window: newCropPlantingWindow.trim() ? "" : "Add a planting window.",
      weeks_to_transplant:
        newCropDirectSow || newCropWeeksToTransplant >= 1
          ? ""
          : "Indoor starts need at least 1 week.",
    }),
    [newCropDays, newCropDirectSow, newCropName, newCropPlantingWindow, newCropSpacing, newCropWeeksToTransplant],
  );

  useEffect(() => {
    setCropSearchActiveIndex(0);
  }, [cropSearchQuery]);

  useEffect(() => {
    if (cropSearchActiveIndex > Math.max(0, filteredCropTemplates.length - 1)) {
      setCropSearchActiveIndex(0);
    }
  }, [cropSearchActiveIndex, filteredCropTemplates.length]);

  const selectCrop = useCallback(
    (crop: CropTemplate) => {
      setSelectedCropName(crop.name);
      setCropSearchQuery(cropDisplayName(crop));
    },
    [setSelectedCropName],
  );

  const resetCropForm = useCallback(() => {
    setShowCropValidation(false);
    setEditingCropId(null);
    setNewCropName("");
    setNewCropVariety("");
    setNewCropFamily("");
    setNewCropSpacing(12);
    setNewCropDays(60);
    setNewCropPlantingWindow("Spring");
    setNewCropDirectSow(true);
    setNewCropFrostHardy(false);
    setNewCropWeeksToTransplant(6);
    setNewCropNotes("");
    setNewCropImageUrl("");
  }, []);

  const populateCropForm = useCallback((crop: CropTemplate) => {
    setShowCropValidation(false);
    setEditingCropId(crop.id);
    setNewCropName(cropBaseName(crop));
    setNewCropVariety(crop.variety);
    setNewCropFamily(crop.family);
    setNewCropSpacing(crop.spacing_in);
    setNewCropDays(crop.days_to_harvest);
    setNewCropPlantingWindow(crop.planting_window);
    setNewCropDirectSow(crop.direct_sow);
    setNewCropFrostHardy(crop.frost_hardy);
    setNewCropWeeksToTransplant(crop.weeks_to_transplant);
    setNewCropNotes(crop.notes);
    setNewCropImageUrl(crop.image_url || "");
  }, []);

  const handleCropSearchKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (filteredCropTemplates.length === 0) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setCropSearchActiveIndex((prev) => Math.min(prev + 1, filteredCropTemplates.length - 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setCropSearchActiveIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const crop = filteredCropTemplates[cropSearchActiveIndex] || filteredCropTemplates[0];
        if (crop) selectCrop(crop);
        return;
      }
      if (event.key === "Escape") {
        const current = cropTemplates.find((c) => c.name === selectedCropName);
        if (current) {
          event.preventDefault();
          setCropSearchQuery(cropDisplayName(current));
        }
      }
    },
    [filteredCropTemplates, cropSearchActiveIndex, selectCrop, cropTemplates, selectedCropName],
  );

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
      } catch (err: any) {
        pushNotice(
          err?.message || `Unable to ${editingCropId ? "update" : "add"} vegetable.`,
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
