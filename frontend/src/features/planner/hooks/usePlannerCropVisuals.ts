import { useCallback, useMemo } from "react";
import defaultPlantPhoto from "../../../assets/plants/default-plant-photo.svg";
import { CropTemplate } from "../../types";

export function usePlannerCropVisuals(cropTemplates: CropTemplate[]) {
  const cropTemplateByName = useMemo(
    () => new Map(cropTemplates.map((crop) => [crop.name.toLowerCase(), crop])),
    [cropTemplates],
  );

  const cropVisual = useCallback((cropName: string) => {
    const template = cropTemplateByName.get(cropName.trim().toLowerCase());
    return {
      imageUrl: template?.image_url?.trim() || defaultPlantPhoto,
      rowSpacingIn: Math.max(1, template?.row_spacing_in || 18),
      inRowSpacingIn: Math.max(1, template?.in_row_spacing_in || 12),
    };
  }, [cropTemplateByName]);

  return { cropVisual };
}
