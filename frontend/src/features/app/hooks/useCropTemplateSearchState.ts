import { KeyboardEvent, useCallback, useMemo, useState } from "react";
import { cropDisplayName } from "../utils/cropUtils";
import { CropTemplate } from "../../types";

interface UseCropTemplateSearchStateParams {
  cropTemplates: CropTemplate[];
  selectedCropName: string;
  setSelectedCropName: (name: string) => void;
}

export function useCropTemplateSearchState({
  cropTemplates,
  selectedCropName,
  setSelectedCropName,
}: UseCropTemplateSearchStateParams) {
  const [cropSearchQuery, setCropSearchQuery] = useState("");
  const [cropSearchActiveIndex, setCropSearchActiveIndex] = useState(0);
  const [trackedSearchQuery, setTrackedSearchQuery] = useState(cropSearchQuery);

  const filteredCropTemplates = useMemo(() => {
    const query = cropSearchQuery.trim().toLowerCase();
    if (!query) return cropTemplates;
    return cropTemplates.filter((crop) => {
      const haystack = [crop.name, crop.variety, crop.family].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [cropSearchQuery, cropTemplates]);

  const maxActiveIndex = Math.max(0, filteredCropTemplates.length - 1);

  if (cropSearchQuery !== trackedSearchQuery) {
    setTrackedSearchQuery(cropSearchQuery);
    setCropSearchActiveIndex(0);
  } else if (cropSearchActiveIndex > maxActiveIndex) {
    setCropSearchActiveIndex(0);
  }

  const activeIndex = Math.min(cropSearchActiveIndex, maxActiveIndex);

  const selectCrop = useCallback(
    (crop: CropTemplate) => {
      setSelectedCropName(crop.name);
      setCropSearchQuery(cropDisplayName(crop));
    },
    [setSelectedCropName],
  );

  const handleCropSearchKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (filteredCropTemplates.length === 0) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setCropSearchActiveIndex((prev) => Math.min(prev + 1, maxActiveIndex));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setCropSearchActiveIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const crop = filteredCropTemplates[activeIndex] || filteredCropTemplates[0];
        if (crop) selectCrop(crop);
        return;
      }
      if (event.key === "Escape") {
        const current = cropTemplates.find((crop) => crop.name === selectedCropName);
        if (current) {
          event.preventDefault();
          setCropSearchQuery(cropDisplayName(current));
        }
      }
    },
    [activeIndex, filteredCropTemplates, maxActiveIndex, selectCrop, cropTemplates, selectedCropName],
  );

  return {
    cropSearchQuery,
    setCropSearchQuery,
    cropSearchActiveIndex: activeIndex,
    filteredCropTemplates,
    selectCrop,
    handleCropSearchKeyDown,
  };
}
