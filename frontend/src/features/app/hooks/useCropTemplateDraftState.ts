import { useCallback, useMemo, useState } from "react";
import { cropBaseName } from "../utils/cropUtils";
import { CropTemplate } from "../../types";

export function useCropTemplateDraftState() {
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
  const [editingCropId, setEditingCropId] = useState<number | null>(null);
  const [showCropValidation, setShowCropValidation] = useState(false);

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
    editingCropId,
    showCropValidation,
    setShowCropValidation,
    cropFormErrors,
    resetCropForm,
    populateCropForm,
  };
}