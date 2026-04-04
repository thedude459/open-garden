import { useCallback, useEffect, useRef, useState } from "react";
import { API } from "../constants";
import { ConfirmState } from "../types";
import {
  Bed,
  CropTemplate,
  Garden,
  Placement,
  Planting,
} from "../../types";
import {
  CacheEntry,
  createClearAllCaches,
  getCachedData,
  setCachedData,
} from "../utils/cacheUtils";
import { useCropLibrarySync } from "./useCropLibrarySync";
import { useGardenInsightsData } from "./useGardenInsightsData";

type NoticeKind = "info" | "success" | "error";

type UseGardenDataFlowParams = {
  token: string;
  fetchAuthed: (path: string, opts?: RequestInit) => Promise<unknown>;
  pushNotice: (message: string, kind: NoticeKind) => void;
  setIsEmailVerified: (value: boolean) => void;
  setConfirmState: (state: ConfirmState | null) => void;
};

type WeatherResponse = {
  [key: string]: unknown;
};

export function useGardenDataFlow({
  token,
  fetchAuthed,
  pushNotice,
  setIsEmailVerified,
  setConfirmState,
}: UseGardenDataFlowParams) {
  const [gardens, setGardens] = useState<Garden[]>([]);
  const [publicGardens, setPublicGardens] = useState<Garden[]>([]);
  const [selectedGarden, setSelectedGarden] = useState<number | null>(null);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [plantings, setPlantings] = useState<Planting[]>([]);
  const [cropTemplates, setCropTemplates] = useState<CropTemplate[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);

  const [isLoadingGardenData, setIsLoadingGardenData] = useState(false);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [selectedCropName, setSelectedCropName] = useState("");

  const gardensRef = useRef<Garden[]>([]);
  const selectedGardenRef = useRef<number | null>(null);
  const weatherCacheRef = useRef<Map<number, CacheEntry<WeatherResponse>>>(new Map());

  const insights = useGardenInsightsData({ fetchAuthed });

  const clearAllCaches = useCallback(createClearAllCaches(
    weatherCacheRef.current,
  ), []);

  function noticeUnlessExpired(msg: string) {
    return (err: unknown) => {
      if (typeof err === "object" && err !== null && "sessionExpired" in err && (err as { sessionExpired?: boolean }).sessionExpired) {
        return;
      }
      pushNotice(msg, "error");
    };
  }

  const loadGardens = useCallback(async () => {
    const mine = await fetchAuthed("/gardens") as Garden[];
    setGardens(mine);
    clearAllCaches();

    if (mine.length === 0) {
      setSelectedGarden(null);
      insights.resetForNoGarden();
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
  }, [fetchAuthed, clearAllCaches, insights]);

  const loadMe = useCallback(async () => {
    const me = await fetchAuthed("/users/me") as { email_verified?: boolean };
    setIsEmailVerified(Boolean(me.email_verified));
  }, [fetchAuthed, setIsEmailVerified]);

  const selectCrop = useCallback((crop: CropTemplate) => {
    setSelectedCropName(crop.name);
  }, []);

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
  }, [fetchAuthed]);

  const cropSync = useCropLibrarySync({
    fetchAuthed,
    pushNotice,
    setConfirmState,
    loadCropTemplates,
    selectedCropName,
  });

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
  }, [pushNotice]);

  useEffect(() => {
    gardensRef.current = gardens;
  }, [gardens]);

  useEffect(() => {
    selectedGardenRef.current = selectedGarden;
  }, [selectedGarden]);

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
  }, [fetchAuthed, loadWeatherForGarden, pushNotice]);

  const refreshSeasonalPlan = useCallback(async () => {
    const gardenId = selectedGardenRef.current;
    if (!gardenId) {
      return;
    }

    const garden = gardensRef.current.find((g) => g.id === gardenId);
    if (!garden) {
      return;
    }

    insights.invalidateSeasonalPlanCache(garden.id);
    await insights.loadSeasonalPlanForGarden(garden, true);

    if (insights.selectedRecommendationPlantingId) {
      insights.clearPlantingRecommendationCacheEntry(insights.selectedRecommendationPlantingId);
      await insights.loadPlantingRecommendation(insights.selectedRecommendationPlantingId);
    }
  }, [insights]);

  useEffect(() => {
    if (!token) {
      return;
    }

    loadGardens().catch(noticeUnlessExpired("Unable to load your gardens."));
    loadCropTemplates().catch(noticeUnlessExpired("Unable to load crop templates."));
    loadMe().catch(noticeUnlessExpired("Unable to load profile details."));
    cropSync.loadCropTemplateSyncStatus(false).catch(noticeUnlessExpired("Unable to load crop sync status."));
  }, [token, loadGardens, loadCropTemplates, loadMe, cropSync, noticeUnlessExpired]);

  useEffect(() => {
    if (!token || !cropSync.cropTemplateSyncStatus?.is_running) {
      return;
    }

    const intervalId = window.setInterval(() => {
      cropSync.loadCropTemplateSyncStatus().catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [token, cropSync]);

  useEffect(() => {
    if (!token || !selectedGarden) {
      return;
    }
    loadGardenData().catch(noticeUnlessExpired("Unable to refresh garden layout data."));
  }, [token, selectedGarden, loadGardenData, noticeUnlessExpired]);

  const selectedGardenRecord = gardens.find((g) => g.id === selectedGarden);
  useEffect(() => {
    if (!token || !selectedGardenRecord) {
      insights.resetForNoGarden();
      return;
    }

    insights.loadClimateForGarden(selectedGardenRecord).catch(noticeUnlessExpired("Unable to load climate guidance."));
    insights.loadPlantingWindowsForGarden(selectedGardenRecord).catch(noticeUnlessExpired("Unable to load dynamic planting windows."));
    insights.loadSunPathForGarden(selectedGardenRecord).catch(noticeUnlessExpired("Unable to load sun-path layout guidance."));
  }, [token, selectedGardenRecord, insights, noticeUnlessExpired]);

  return {
    gardens,
    setGardens,
    publicGardens,
    selectedGarden,
    setSelectedGarden,

    beds,
    setBeds,
    plantings,
    setPlantings,
    placements,
    setPlacements,
    cropTemplates,
    weather,

    gardenClimate: insights.gardenClimate,
    plantingWindows: insights.plantingWindows,
    gardenSunPath: insights.gardenSunPath,
    seasonalPlan: insights.seasonalPlan,
    setSeasonalPlan: insights.setSeasonalPlan,
    sensorSummary: insights.sensorSummary,
    gardenTimeline: insights.gardenTimeline,
    plantingRecommendation: insights.plantingRecommendation,
    selectedRecommendationPlantingId: insights.selectedRecommendationPlantingId,
    setSelectedRecommendationPlantingId: insights.setSelectedRecommendationPlantingId,

    cropTemplateSyncStatus: cropSync.cropTemplateSyncStatus,
    isRefreshingCropLibrary: cropSync.isRefreshingCropLibrary,
    isCleaningLegacyCropLibrary: cropSync.isCleaningLegacyCropLibrary,

    isLoadingGardenData,
    isLoadingWeather,
    isLoadingClimate: insights.isLoadingClimate,
    isLoadingPlantingWindows: insights.isLoadingPlantingWindows,
    isLoadingSunPath: insights.isLoadingSunPath,
    isLoadingSeasonalPlan: insights.isLoadingSeasonalPlan,
    isLoadingSensorSummary: insights.isLoadingSensorSummary,
    isLoadingTimeline: insights.isLoadingTimeline,
    isLoadingPlantingRecommendation: insights.isLoadingPlantingRecommendation,

    selectedCropName,
    setSelectedCropName,
    selectCrop,

    loadGardens,
    loadMe,
    loadCropTemplates,
    loadCropTemplateSyncStatus: cropSync.loadCropTemplateSyncStatus,
    loadGardenData,
    loadWeatherForGarden,
    loadClimateForGarden: insights.loadClimateForGarden,
    loadPlantingWindowsForGarden: insights.loadPlantingWindowsForGarden,
    loadSunPathForGarden: insights.loadSunPathForGarden,
    loadSeasonalPlanForGarden: insights.loadSeasonalPlanForGarden,
    loadSensorSummaryForGarden: insights.loadSensorSummaryForGarden,
    loadTimelineForGarden: insights.loadTimelineForGarden,
    loadPlantingRecommendation: insights.loadPlantingRecommendation,

    refreshCropTemplateDatabase: cropSync.refreshCropTemplateDatabase,
    requestLegacyCropCleanup: cropSync.requestLegacyCropCleanup,
    refreshSeasonalPlan,

    invalidateGardenInsightCaches: insights.invalidateGardenInsightCaches,
    invalidateSensorCaches: insights.invalidateSensorCaches,
    invalidateSeasonalPlanCache: insights.invalidateSeasonalPlanCache,

    noticeUnlessExpired,
  };
}
