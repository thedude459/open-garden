import { useCallback, useEffect, useRef, useState } from "react";
import {
  ALL_PLANT_KINDS,
  type PlantKind,
  readStoredSuggestionKinds,
  suggestionKindsSearchSuffix,
  suggestionKindsSignature,
  writeStoredSuggestionKinds,
} from "../../planning/suggestionKindsStorage";
import {
  Garden,
  GardenClimate,
  GardenClimatePlantingWindows,
  GardenExtensionResources,
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
  isCacheValid,
  setCachedData,
} from "../utils/cacheUtils";

type UseGardenInsightsDataParams = {
  fetchAuthed: (path: string, opts?: RequestInit) => Promise<unknown>;
  selectedGarden: number | null;
  gardens: Garden[];
};

const NO_TTL = Number.POSITIVE_INFINITY;

function seasonalPlanCacheKey(gardenId: number, kindsSig: string): string {
  return `${gardenId}:${kindsSig}`;
}

function plantingRecCacheKey(plantingId: number, kindsSig: string): string {
  return `${plantingId}:${kindsSig}`;
}

function getStringCached<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  ttlMs: number,
): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (!isCacheValid(entry, ttlMs)) {
    cache.delete(key);
    return undefined;
  }
  return entry.data;
}

function setStringCached<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

export function useGardenInsightsData({
  fetchAuthed,
  selectedGarden,
  gardens,
}: UseGardenInsightsDataParams) {
  const [gardenClimate, setGardenClimate] = useState<GardenClimate | null>(null);
  const [plantingWindows, setPlantingWindows] = useState<GardenClimatePlantingWindows | null>(null);
  const [gardenSunPath, setGardenSunPath] = useState<GardenSunPath | null>(null);
  const [seasonalPlan, setSeasonalPlan] = useState<GardenSeasonalPlan | null>(null);
  const [sensorSummary, setSensorSummary] = useState<GardenSensorsSummary | null>(null);
  const [gardenTimeline, setGardenTimeline] = useState<GardenTimeline | null>(null);
  const [plantingRecommendation, setPlantingRecommendation] = useState<PlantingRecommendations | null>(null);
  const [selectedRecommendationPlantingId, setSelectedRecommendationPlantingId] = useState<number | null>(null);
  const [gardenExtensionResources, setGardenExtensionResources] = useState<GardenExtensionResources | null>(null);

  const [isLoadingClimate, setIsLoadingClimate] = useState(false);
  const [isLoadingPlantingWindows, setIsLoadingPlantingWindows] = useState(false);
  const [isLoadingSunPath, setIsLoadingSunPath] = useState(false);
  const [isLoadingSeasonalPlan, setIsLoadingSeasonalPlan] = useState(false);
  const [isLoadingSensorSummary, setIsLoadingSensorSummary] = useState(false);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  const [isLoadingPlantingRecommendation, setIsLoadingPlantingRecommendation] = useState(false);
  const [isLoadingExtensionResources, setIsLoadingExtensionResources] = useState(false);

  const climateCacheRef = useRef<Map<number, CacheEntry<GardenClimate>>>(new Map());
  const plantingWindowCacheRef = useRef<Map<number, CacheEntry<GardenClimatePlantingWindows>>>(new Map());
  const sunPathCacheRef = useRef<Map<number, CacheEntry<GardenSunPath>>>(new Map());
  const seasonalPlanCacheRef = useRef<Map<string, CacheEntry<GardenSeasonalPlan>>>(new Map());
  const sensorSummaryCacheRef = useRef<Map<number, CacheEntry<GardenSensorsSummary>>>(new Map());
  const timelineCacheRef = useRef<Map<number, CacheEntry<GardenTimeline>>>(new Map());
  const plantingRecommendationCacheRef = useRef<Map<string, CacheEntry<PlantingRecommendations>>>(new Map());
  const extensionResourcesCacheRef = useRef<Map<number, CacheEntry<GardenExtensionResources>>>(new Map());

  const seasonalSuggestionKindsRef = useRef<PlantKind[]>([...ALL_PLANT_KINDS]);
  const selectedRecommendationPlantingIdRef = useRef<number | null>(null);

  useEffect(() => {
    selectedRecommendationPlantingIdRef.current = selectedRecommendationPlantingId;
  }, [selectedRecommendationPlantingId]);

  useEffect(() => {
    if (selectedGarden == null) {
      seasonalSuggestionKindsRef.current = [...ALL_PLANT_KINDS];
      return;
    }
    seasonalSuggestionKindsRef.current = readStoredSuggestionKinds(selectedGarden);
  }, [selectedGarden]);

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

  const loadExtensionResourcesForGarden = useCallback(async (garden: Garden) => {
    const cached = getCachedData(extensionResourcesCacheRef.current, garden.id, NO_TTL);
    if (cached) {
      setGardenExtensionResources(cached);
      return;
    }

    setIsLoadingExtensionResources(true);
    try {
      const data = (await fetchAuthed(`/gardens/${garden.id}/extension-resources`)) as GardenExtensionResources;
      setCachedData(extensionResourcesCacheRef.current, garden.id, data);
      setGardenExtensionResources(data);
    } finally {
      setIsLoadingExtensionResources(false);
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
    const kinds = seasonalSuggestionKindsRef.current;
    const kindsSig = suggestionKindsSignature(kinds);
    const cacheKey = seasonalPlanCacheKey(garden.id, kindsSig);

    if (!forceRefresh) {
      const cached = getStringCached(seasonalPlanCacheRef.current, cacheKey, NO_TTL);
      if (cached) {
        setSeasonalPlan(cached);
        return;
      }
    }

    setIsLoadingSeasonalPlan(true);
    try {
      const suffix = suggestionKindsSearchSuffix(kinds);
      const planData = await fetchAuthed(`/gardens/${garden.id}/plan/seasonal${suffix}`) as GardenSeasonalPlan;
      setStringCached(seasonalPlanCacheRef.current, cacheKey, planData);
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
    const kinds = seasonalSuggestionKindsRef.current;
    const kindsSig = suggestionKindsSignature(kinds);
    const cacheKey = plantingRecCacheKey(plantingId, kindsSig);

    const cached = getStringCached(plantingRecommendationCacheRef.current, cacheKey, NO_TTL);
    if (cached) {
      setPlantingRecommendation(cached);
      return;
    }

    setIsLoadingPlantingRecommendation(true);
    try {
      const suffix = suggestionKindsSearchSuffix(kinds);
      const recData = await fetchAuthed(`/plantings/${plantingId}/recommendations${suffix}`) as PlantingRecommendations;
      setStringCached(plantingRecommendationCacheRef.current, cacheKey, recData);
      setPlantingRecommendation(recData);
    } finally {
      setIsLoadingPlantingRecommendation(false);
    }
  }, [fetchAuthed]);

  const invalidateGardenInsightCaches = useCallback((gardenId: number) => {
    createInvalidateCaches(
      climateCacheRef.current,
      plantingWindowCacheRef.current,
      sunPathCacheRef.current,
      extensionResourcesCacheRef.current,
    )(gardenId);
    for (const key of [...seasonalPlanCacheRef.current.keys()]) {
      if (key.startsWith(`${gardenId}:`)) {
        seasonalPlanCacheRef.current.delete(key);
      }
    }
  }, []);

  const invalidateSensorCaches = useCallback((gardenId: number) => {
    createInvalidateCaches(sensorSummaryCacheRef.current, timelineCacheRef.current)(gardenId);
  }, []);

  const invalidateSeasonalPlanCache = useCallback((gardenId: number) => {
    for (const key of [...seasonalPlanCacheRef.current.keys()]) {
      if (key.startsWith(`${gardenId}:`)) {
        seasonalPlanCacheRef.current.delete(key);
      }
    }
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
    setGardenExtensionResources(null);
    plantingRecommendationCacheRef.current.clear();
  }, []);

  const clearPlantingRecommendationCacheEntry = useCallback((plantingId: number) => {
    for (const key of [...plantingRecommendationCacheRef.current.keys()]) {
      if (key.startsWith(`${plantingId}:`)) {
        plantingRecommendationCacheRef.current.delete(key);
      }
    }
  }, []);

  const applySeasonalSuggestionKinds = useCallback(
    async (kinds: PlantKind[]) => {
      seasonalSuggestionKindsRef.current = kinds;
      if (selectedGarden == null) {
        return;
      }
      writeStoredSuggestionKinds(selectedGarden, kinds);
      const garden = gardens.find((g) => g.id === selectedGarden);
      if (!garden) {
        return;
      }
      invalidateSeasonalPlanCache(garden.id);
      await loadSeasonalPlanForGarden(garden, true);

      const recId = selectedRecommendationPlantingIdRef.current;
      if (recId) {
        clearPlantingRecommendationCacheEntry(recId);
        await loadPlantingRecommendation(recId);
      }
    },
    [
      selectedGarden,
      gardens,
      invalidateSeasonalPlanCache,
      loadSeasonalPlanForGarden,
      clearPlantingRecommendationCacheEntry,
      loadPlantingRecommendation,
    ],
  );

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
    gardenExtensionResources,

    isLoadingClimate,
    isLoadingPlantingWindows,
    isLoadingSunPath,
    isLoadingSeasonalPlan,
    isLoadingSensorSummary,
    isLoadingTimeline,
    isLoadingPlantingRecommendation,
    isLoadingExtensionResources,

    loadClimateForGarden,
    loadPlantingWindowsForGarden,
    loadSunPathForGarden,
    loadSeasonalPlanForGarden,
    loadSensorSummaryForGarden,
    loadTimelineForGarden,
    loadPlantingRecommendation,
    loadExtensionResourcesForGarden,

    invalidateGardenInsightCaches,
    invalidateSensorCaches,
    invalidateSeasonalPlanCache,

    resetForNoGarden,
    clearPlantingRecommendationCacheEntry,
    applySeasonalSuggestionKinds,
  };
}
