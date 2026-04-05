import { useCallback, useEffect, useMemo, useState } from "react";
import { Bed, CropTemplate, Garden, GardenSunPath, Placement } from "../../types";
import { buildCanopyPreview } from "../engine/growthSim";
import { buildShadeMap } from "../engine/shadeMap";
import { buildSunExposureGrid, sampleSunVector } from "../engine/sunModel";

interface UsePlannerOverlayStateParams {
  gardenSunPath: GardenSunPath | null;
  yardWidthFt: number;
  yardLengthFt: number;
  gardenOrientation: Garden["orientation"];
  beds: Bed[];
  placements: Placement[];
  cropTemplates: CropTemplate[];
}

export function usePlannerOverlayState({
  gardenSunPath,
  yardWidthFt,
  yardLengthFt,
  gardenOrientation,
  beds,
  placements,
  cropTemplates,
}: UsePlannerOverlayStateParams) {
  const [showSunOverlay, setShowSunOverlay] = useState(false);
  const [showShadeOverlay, setShowShadeOverlay] = useState(false);
  const [showGrowthPreview, setShowGrowthPreview] = useState(false);
  const [sunHour, setSunHour] = useState(12);
  const [growthDayOffset, setGrowthDayOffset] = useState(21);

  const defaultSunHour = useMemo(() => {
    if (!gardenSunPath) return 12;
    return Math.round((gardenSunPath.sunrise_hour + gardenSunPath.sunset_hour) / 2);
  }, [gardenSunPath]);

  useEffect(() => {
    setSunHour(defaultSunHour);
  }, [defaultSunHour]);

  const setOverlayPreset = useCallback((preset: "layout" | "sun" | "shade" | "growth") => {
    setShowSunOverlay(preset === "sun");
    setShowShadeOverlay(preset === "shade");
    setShowGrowthPreview(preset === "growth");
  }, []);

  const sunSample = useMemo(() => sampleSunVector(gardenSunPath, sunHour), [gardenSunPath, sunHour]);

  const sunExposure = useMemo(
    () => buildSunExposureGrid(yardWidthFt, yardLengthFt, sunSample, gardenOrientation),
    [yardWidthFt, yardLengthFt, sunSample, gardenOrientation],
  );

  const shadeMap = useMemo(
    () => buildShadeMap(yardWidthFt, yardLengthFt, beds, sunSample),
    [yardWidthFt, yardLengthFt, beds, sunSample],
  );

  const canopyPreview = useMemo(
    () => buildCanopyPreview(beds, placements, cropTemplates, growthDayOffset),
    [beds, placements, cropTemplates, growthDayOffset],
  );

  return {
    showSunOverlay,
    setShowSunOverlay,
    showShadeOverlay,
    setShowShadeOverlay,
    showGrowthPreview,
    setShowGrowthPreview,
    sunHour,
    setSunHour,
    growthDayOffset,
    setGrowthDayOffset,
    setOverlayPreset,
    sunSample,
    sunExposure,
    shadeMap,
    canopyPreview,
  };
}
