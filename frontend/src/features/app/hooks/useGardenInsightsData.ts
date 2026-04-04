import { useCallback, useRef, useState } from "react";
import {
  Garden,
  GardenClimate,
  GardenClimatePlantingWindows,
  GardenSeasonalPlan,
  GardenSensorsSummary,
  GardenSunPath,
  GardenTimeline,
  PlantingRecommendations,
} from "../../types";
import {
  CacheEntry,
  createInvalidateCaches,
  getCachedData,
  setCachedData,
} from "../utils/cacheUtils";

type UseGardenInsightsDataParams = {
  fetchAuthed: (path: string, opts?: RequestInit) => Promise<unknown>;
};

const NO_TTL = Number.POSITIVE_INFINITY;

export function useGardenInsightsData({ fetchAuthed }: UseGardenInsightsDataParams) {
  const [gardenClimate, setGardenClimate] = useState<GardenClimate | null>(null);
  const [plantingWindows, setPlantingWindows] = useState<GardenClimatePlantingWindows | null>(null);
  const [gardenSunPath, setGardenSunPath] = useState<GardenSunPath | null>(null);
  const [seasonalPlan, setSeasonalPlan] = useState<GardenSeasonalPlan | null>(null);
  const [sensorSummary, setSensorSummary] = useState<GardenSensorsSummary | null>(null);
  const [gardenTimeline, setGardenTimeline] = useState<GardenTimeline | null>(null);
  const [plantingRecommendation, setPlantingRecommendation] = useState<PlantingRecommendations | null>(null);
  const [selectedRecommendationPlantingId, setSelectedRecommendationPlantingId] = useState<number | null>(null);

  const [isLoadingClimate, setIsLoadingClimate] = useState(false);
  const [isLoadingPlantingWindows, setIsLoadingPlantingWindows] = useState(false);
  const [isLoadingSunPath, setIsLoadingSunPath] = useState(false);
  const [isLoadingSeasonalPlan, setIsLoadingSeasonalPlan] = useState(false);
  const [isLoadingSensorSummary, setIsLoadingSensorSummary] = useState(false);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  const [isLoadingPlantingRecommendation, setIsLoadingPlantingRecommendation] = useState(false);

  const climateCacheRef = useRef<Map<number, CacheEntry<GardenClimate>>>(new Map());
  const plantingWindowCacheRef = useRef<Map<number, CacheEntry<GardenClimatePlantingWindows>>>(new Map());
  const sunPathCacheRef = useRef<Map<number, CacheEntry<GardenSunPath>>>(new Map());
  const seasonalPlanCacheRef = useRef<Map<number, CacheEntry<GardenSeasonalPlan>>>(new Map());
  const sensorSummaryCacheRef = useRef<Map<number, CacheEntry<GardenSensorsSummary>>>(new Map());
  const timelineCacheRef = useRef<Map<number, CacheEntry<GardenTimeline>>>(new Map());
  const plantingRecommendationCacheRef = useRef<Map<number, CacheEntry<PlantingRecommendations>>>(new Map());

  const loadClimateForGarden = useCallback(async (garden: Garden) => {
    const cached = getCachedData(climateCacheRef.current, garden.id, NO_TTL);
    if (cached) {
      setGardenClimate(cached);
      return;
    }

    setIsLoadingClimate(true);
    try {
      const climateData = await fetchAuthed(`/gardens/${garden.id}/climate`) as GardenClimate;
      setCachedData(climateCacheRef.current, garden.id, climateData);
      setGardenClimate(climateData);
    } finally {
      setIsLoadingClimate(false);
    }
  }, [fetchAuthed]);

  const loadPlantingWindowsForGarden = useCallback(async (garden: Garden) => {
    const cached = getCachedData(plantingWindowCacheRef.current, garden.id, NO_TTL);
    if (cached) {
      setPlantingWindows(cached);
      return;
    }

    setIsLoadingPlantingWindows(true);
    try {
      const windowsData = await fetchAuthed(`/gardens/${garden.id}/climate/planting-windows`) as GardenClimatePlantingWindows;
      setCachedData(plantingWindowCacheRef.current, garden.id, windowsData);
      setPlantingWindows(windowsData);
    } finally {
      setIsLoadingPlantingWindows(false);
    }
  }, [fetchAuthed]);

  const loadSunPathForGarden = useCallback(async (garden: Garden) => {
    const cached = getCachedData(sunPathCacheRef.current, garden.id, NO_TTL);
    if (cached) {
      setGardenSunPath(cached);
      return;
    }

    setIsLoadingSunPath(true);
    try {
      const sunPathData = await fetchAuthed(`/gardens/${garden.id}/layout/sun-path`) as GardenSunPath;
      setCachedData(sunPathCacheRef.current, garden.id, sunPathData);
      setGardenSunPath(sunPathData);
    } finally {
      setIsLoadingSunPath(false);
    }
  }, [fetchAuthed]);

  const loadSeasonalPlanForGarden = useCallback(async (garden: Garden, forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = getCachedData(seasonalPlanCacheRef.current, garden.id, NO_TTL);
      if (cached) {
        setSeasonalPlan(cached);
        return;
      }
    }

    setIsLoadingSeasonalPlan(true);
    try {
      const planData = await fetchAuthed(`/gardens/${garden.id}/plan/seasonal`) as GardenSeasonalPlan;
      setCachedData(seasonalPlanCacheRef.current, garden.id, planData);
      setSeasonalPlan(planData);
    } finally {
      setIsLoadingSeasonalPlan(false);
    }
  }, [fetchAuthed]);

  const loadSensorSummaryForGarden = useCallback(async (garden: Garden, forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = getCachedData(sensorSummaryCacheRef.current, garden.id, NO_TTL);
      if (cached) {
        setSensorSummary(cached);
        return;
      }
    }

    setIsLoadingSensorSummary(true);
    try {
      const summaryData = await fetchAuthed(`/gardens/${garden.id}/sensors/summary`) as GardenSensorsSummary;
      setCachedData(sensorSummaryCacheRef.current, garden.id, summaryData);
      setSensorSummary(summaryData);
    } finally {
      setIsLoadingSensorSummary(false);
    }
  }, [fetchAuthed]);

  const loadTimelineForGarden = useCallback(async (garden: Garden, forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = getCachedData(timelineCacheRef.current, garden.id, NO_TTL);
      if (cached) {
        setGardenTimeline(cached);
        return;
      }
    }

    setIsLoadingTimeline(true);
    try {
      const timelineData = await fetchAuthed(`/gardens/${garden.id}/timeline`) as GardenTimeline;
      setCachedData(timelineCacheRef.current, garden.id, timelineData);
      setGardenTimeline(timelineData);
    } finally {
      setIsLoadingTimeline(false);
    }
  }, [fetchAuthed]);

  const loadPlantingRecommendation = useCallback(async (plantingId: number) => {
    const cached = getCachedData(plantingRecommendationCacheRef.current, plantingId, NO_TTL);
    if (cached) {
      setPlantingRecommendation(cached);
      return;
    }

    setIsLoadingPlantingRecommendation(true);
    try {
      const recData = await fetchAuthed(`/plantings/${plantingId}/recommendations`) as PlantingRecommendations;
      setCachedData(plantingRecommendationCacheRef.current, plantingId, recData);
      setPlantingRecommendation(recData);
    } finally {
      setIsLoadingPlantingRecommendation(false);
    }
  }, [fetchAuthed]);

  const invalidateGardenInsightCaches = useCallback(createInvalidateCaches(
    climateCacheRef.current,
    plantingWindowCacheRef.current,
    sunPathCacheRef.current,
    seasonalPlanCacheRef.current,
  ), []);

  const invalidateSensorCaches = useCallback(createInvalidateCaches(
    sensorSummaryCacheRef.current,
    timelineCacheRef.current,
  ), []);

  const invalidateSeasonalPlanCache = useCallback((gardenId: number) => {
    seasonalPlanCacheRef.current.delete(gardenId);
  }, []);

  const resetForNoGarden = useCallback(() => {
    setGardenClimate(null);
    setPlantingWindows(null);
    setGardenSunPath(null);
    setSeasonalPlan(null);
    setSensorSummary(null);
    setGardenTimeline(null);
    setPlantingRecommendation(null);
    setSelectedRecommendationPlantingId(null);
  }, []);

  const clearPlantingRecommendationCacheEntry = useCallback((plantingId: number) => {
    plantingRecommendationCacheRef.current.delete(plantingId);
  }, []);

  return {
    gardenClimate,
    plantingWindows,
    gardenSunPath,
    seasonalPlan,
    setSeasonalPlan,
    sensorSummary,
    gardenTimeline,
    plantingRecommendation,
    selectedRecommendationPlantingId,
    setSelectedRecommendationPlantingId,

    isLoadingClimate,
    isLoadingPlantingWindows,
    isLoadingSunPath,
    isLoadingSeasonalPlan,
    isLoadingSensorSummary,
    isLoadingTimeline,
    isLoadingPlantingRecommendation,

    loadClimateForGarden,
    loadPlantingWindowsForGarden,
    loadSunPathForGarden,
    loadSeasonalPlanForGarden,
    loadSensorSummaryForGarden,
    loadTimelineForGarden,
    loadPlantingRecommendation,

    invalidateGardenInsightCaches,
    invalidateSensorCaches,
    invalidateSeasonalPlanCache,

    resetForNoGarden,
    clearPlantingRecommendationCacheEntry,
  };
}
