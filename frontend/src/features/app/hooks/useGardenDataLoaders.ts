import { Dispatch, MutableRefObject, SetStateAction, useCallback } from "react";
import { API } from "../constants";
import { Bed, CropTemplate, Garden, Placement, Planting } from "../../types";
import { CacheEntry, getCachedData, setCachedData } from "../utils/cacheUtils";

type NoticeKind = "info" | "success" | "error";

type WeatherResponse = {
  [key: string]: unknown;
};

type UseGardenDataLoadersParams = {
  fetchAuthed: (path: string, opts?: RequestInit) => Promise<unknown>;
  pushNotice: (message: string, kind: NoticeKind) => void;
  setIsEmailVerified: (value: boolean) => void;
  clearAllCaches: () => void;
  resetForNoGarden: () => void;
  setGardens: Dispatch<SetStateAction<Garden[]>>;
  setPublicGardens: Dispatch<SetStateAction<Garden[]>>;
  setSelectedGarden: Dispatch<SetStateAction<number | null>>;
  setWeather: Dispatch<SetStateAction<WeatherResponse | null>>;
  setCropTemplates: Dispatch<SetStateAction<CropTemplate[]>>;
  setSelectedCropName: Dispatch<SetStateAction<string>>;
  weatherCacheRef: MutableRefObject<Map<number, CacheEntry<WeatherResponse>>>;
  setIsLoadingWeather: Dispatch<SetStateAction<boolean>>;
  selectedGardenRef: MutableRefObject<number | null>;
  gardensRef: MutableRefObject<Garden[]>;
  setIsLoadingGardenData: Dispatch<SetStateAction<boolean>>;
  setBeds: Dispatch<SetStateAction<Bed[]>>;
  setPlantings: Dispatch<SetStateAction<Planting[]>>;
  setPlacements: Dispatch<SetStateAction<Placement[]>>;
  invalidateSeasonalPlanCache: (gardenId: number) => void;
  loadSeasonalPlanForGarden: (garden: Garden, forceRefresh?: boolean) => Promise<void>;
  selectedRecommendationPlantingId: number | null;
  clearPlantingRecommendationCacheEntry: (plantingId: number) => void;
  loadPlantingRecommendation: (plantingId: number) => Promise<void>;
};

export function useGardenDataLoaders({
  fetchAuthed,
  pushNotice,
  setIsEmailVerified,
  clearAllCaches,
  resetForNoGarden,
  setGardens,
  setPublicGardens,
  setSelectedGarden,
  setWeather,
  setCropTemplates,
  setSelectedCropName,
  weatherCacheRef,
  setIsLoadingWeather,
  selectedGardenRef,
  gardensRef,
  setIsLoadingGardenData,
  setBeds,
  setPlantings,
  setPlacements,
  invalidateSeasonalPlanCache,
  loadSeasonalPlanForGarden,
  selectedRecommendationPlantingId,
  clearPlantingRecommendationCacheEntry,
  loadPlantingRecommendation,
}: UseGardenDataLoadersParams) {
  const loadGardens = useCallback(async () => {
    const mine = await fetchAuthed("/gardens") as Garden[];
    setGardens(mine);
    clearAllCaches();

    if (mine.length === 0) {
      setSelectedGarden(null);
      resetForNoGarden();
      setWeather(null);
    } else {
      setSelectedGarden((current) => {
        if (!current || !mine.some((g) => g.id === current)) {
          return mine[0].id;
        }
        return current;
      });
    }

    const publicResponse = await fetch(`${API}/gardens/public`);
    const publicList = await publicResponse.json() as Garden[];
    setPublicGardens(publicList);
  }, [fetchAuthed, clearAllCaches, resetForNoGarden, setGardens, setPublicGardens, setSelectedGarden, setWeather]);

  const loadMe = useCallback(async () => {
    const me = await fetchAuthed("/users/me") as { email_verified?: boolean };
    setIsEmailVerified(Boolean(me.email_verified));
  }, [fetchAuthed, setIsEmailVerified]);

  const selectCrop = useCallback((crop: CropTemplate) => {
    setSelectedCropName(crop.name);
  }, [setSelectedCropName]);

  const loadCropTemplates = useCallback(async (preferredCropName?: string) => {
    const templates = await fetchAuthed("/crop-templates") as CropTemplate[];
    setCropTemplates(templates);

    if (templates.length > 0) {
      const preferredCrop = templates.find((crop) => crop.name === preferredCropName);
      setSelectedCropName((current) => {
        const hasCurrent = templates.some((crop) => crop.name === current);
        if (preferredCrop) {
          return preferredCrop.name;
        }
        if (!hasCurrent) {
          return templates[0].name;
        }
        return current;
      });
    }
  }, [fetchAuthed, setCropTemplates, setSelectedCropName]);

  const loadWeatherForGarden = useCallback(async (garden: Garden) => {
    const cached = getCachedData(weatherCacheRef.current, garden.id);
    if (cached) {
      setWeather(cached);
      return;
    }

    setIsLoadingWeather(true);
    try {
      const res = await fetch(`${API}/weather?latitude=${garden.latitude}&longitude=${garden.longitude}`);
      if (!res.ok) {
        pushNotice("Weather data is temporarily unavailable.", "error");
        return;
      }
      const weatherData = await res.json() as WeatherResponse;
      setCachedData(weatherCacheRef.current, garden.id, weatherData);
      setWeather(weatherData);
    } finally {
      setIsLoadingWeather(false);
    }
  }, [pushNotice, setIsLoadingWeather, setWeather, weatherCacheRef]);

  const loadGardenData = useCallback(async () => {
    const gardenId = selectedGardenRef.current;
    if (!gardenId) {
      return;
    }

    try {
      setIsLoadingGardenData(true);
      const [bedsData, plantingsData, placementData] = await Promise.all([
        fetchAuthed(`/gardens/${gardenId}/beds`) as Promise<Bed[]>,
        fetchAuthed(`/plantings?garden_id=${gardenId}`) as Promise<Planting[]>,
        fetchAuthed(`/placements?garden_id=${gardenId}`) as Promise<Placement[]>,
      ]);
      setBeds(bedsData);
      setPlantings(plantingsData);
      setPlacements(placementData);
    } finally {
      setIsLoadingGardenData(false);
    }

    const garden = gardensRef.current.find((item) => item.id === gardenId);
    if (garden) {
      loadWeatherForGarden(garden).catch(() => {
        pushNotice("Unable to load weather right now.", "error");
      });
    }
  }, [fetchAuthed, gardensRef, loadWeatherForGarden, pushNotice, selectedGardenRef, setBeds, setIsLoadingGardenData, setPlacements, setPlantings]);

  const refreshSeasonalPlan = useCallback(async () => {
    const gardenId = selectedGardenRef.current;
    if (!gardenId) {
      return;
    }

    const garden = gardensRef.current.find((g) => g.id === gardenId);
    if (!garden) {
      return;
    }

    invalidateSeasonalPlanCache(garden.id);
    await loadSeasonalPlanForGarden(garden, true);

    if (selectedRecommendationPlantingId) {
      clearPlantingRecommendationCacheEntry(selectedRecommendationPlantingId);
      await loadPlantingRecommendation(selectedRecommendationPlantingId);
    }
  }, [
    selectedGardenRef,
    gardensRef,
    invalidateSeasonalPlanCache,
    loadSeasonalPlanForGarden,
    selectedRecommendationPlantingId,
    clearPlantingRecommendationCacheEntry,
    loadPlantingRecommendation,
  ]);

  return {
    loadGardens,
    loadMe,
    selectCrop,
    loadCropTemplates,
    loadWeatherForGarden,
    loadGardenData,
    refreshSeasonalPlan,
  };
}
