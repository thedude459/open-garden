import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Garden } from "../../types";
import { useGardenCoreState } from "./useGardenCoreState";
import { useGardenDataLoaders } from "./useGardenDataLoaders";

describe("useGardenCoreState", () => {
  it("keeps refs synchronized with garden selection and garden list", () => {
    const { result } = renderHook(() => useGardenCoreState());
    const garden: Garden = { id: 1, name: "Backyard", description: "", zip_code: "80301", growing_zone: "6a", yard_width_ft: 20, yard_length_ft: 30, latitude: 40, longitude: -105, orientation: "south", sun_exposure: "full_sun", wind_exposure: "moderate", thermal_mass: "moderate", slope_position: "mid", frost_pocket_risk: "low", address_private: "", is_shared: false, edge_buffer_in: 6 };

    act(() => {
      result.current.setGardens([garden]);
      result.current.setSelectedGarden(1);
      result.current.setSelectedCropName("Tomato");
    });

    expect(result.current.gardensRef.current).toHaveLength(1);
    expect(result.current.selectedGardenRef.current).toBe(1);
    expect(result.current.selectedCropName).toBe("Tomato");
  });
});

describe("useGardenDataLoaders", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("resets state when no gardens are returned", async () => {
    const fetchAuthed = vi.fn(async (path: string) => {
      if (path === "/gardens") return [];
      return [];
    });
    vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => [] })));

    const clearAllCaches = vi.fn();
    const resetForNoGarden = vi.fn();
    const setSelectedGarden = vi.fn();
    const setWeather = vi.fn();

    const { result } = renderHook(() => useGardenDataLoaders({
      fetchAuthed,
      pushNotice: vi.fn(),
      setIsEmailVerified: vi.fn(),
      clearAllCaches,
      resetForNoGarden,
      setGardens: vi.fn(),
      setPublicGardens: vi.fn(),
      setSelectedGarden,
      setWeather,
      setCropTemplates: vi.fn(),
      setSelectedCropName: vi.fn(),
      weatherCacheRef: { current: new Map() },
      setIsLoadingWeather: vi.fn(),
      selectedGardenRef: { current: null },
      gardensRef: { current: [] },
      setIsLoadingGardenData: vi.fn(),
      setBeds: vi.fn(),
      setPlantings: vi.fn(),
      setPlacements: vi.fn(),
      invalidateSeasonalPlanCache: vi.fn(),
      loadSeasonalPlanForGarden: vi.fn(async () => undefined),
      selectedRecommendationPlantingId: null,
      clearPlantingRecommendationCacheEntry: vi.fn(),
      loadPlantingRecommendation: vi.fn(async () => undefined),
    }));

    await act(async () => {
      await result.current.loadGardens();
    });

    expect(clearAllCaches).toHaveBeenCalledTimes(1);
    expect(setSelectedGarden).toHaveBeenCalledWith(null);
    expect(resetForNoGarden).toHaveBeenCalledTimes(1);
    expect(setWeather).toHaveBeenCalledWith(null);
  });

  it("selects a default garden, caches weather, and refreshes seasonal recommendation state", async () => {
    const mine: Garden[] = [{ id: 3, name: "Backyard", description: "", zip_code: "80301", growing_zone: "6a", yard_width_ft: 20, yard_length_ft: 30, latitude: 40, longitude: -105, orientation: "south", sun_exposure: "full_sun", wind_exposure: "moderate", thermal_mass: "moderate", slope_position: "mid", frost_pocket_risk: "low", address_private: "", is_shared: false, edge_buffer_in: 6 }];
    const setSelectedGarden = vi.fn();
    const setWeather = vi.fn();
    const setIsLoadingWeather = vi.fn();
    const weatherCacheRef = { current: new Map() };
    const gardensRef = { current: mine };
    const selectedGardenRef = { current: 3 };
    const setBeds = vi.fn();
    const setPlantings = vi.fn();
    const setPlacements = vi.fn();
    const invalidateSeasonalPlanCache = vi.fn();
    const loadSeasonalPlanForGarden = vi.fn(async () => undefined);
    const clearPlantingRecommendationCacheEntry = vi.fn();
    const loadPlantingRecommendation = vi.fn(async () => undefined);
    const fetchAuthed = vi.fn(async (path: string) => {
      if (path === "/gardens") return mine;
      if (path === "/users/me") return { email_verified: true };
      if (path === "/crop-templates") return [{ id: 1, name: "Tomato" }];
      if (path === "/gardens/3/beds") return [{ id: 1, garden_id: 3, name: "Bed A", width_in: 48, height_in: 96, grid_x: 0, grid_y: 0 }];
      if (path === "/plantings?garden_id=3") return [];
      if (path === "/placements?garden_id=3") return [];
      return [];
    });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ([] as unknown[]) } as Response)));
    const setSelectedCropName = vi.fn();
    const setIsEmailVerified = vi.fn();

    const { result } = renderHook(() => useGardenDataLoaders({
      fetchAuthed,
      pushNotice: vi.fn(),
      setIsEmailVerified,
      clearAllCaches: vi.fn(),
      resetForNoGarden: vi.fn(),
      setGardens: vi.fn(),
      setPublicGardens: vi.fn(),
      setSelectedGarden,
      setWeather,
      setCropTemplates: vi.fn(),
      setSelectedCropName,
      weatherCacheRef,
      setIsLoadingWeather,
      selectedGardenRef,
      gardensRef,
      setIsLoadingGardenData: vi.fn(),
      setBeds,
      setPlantings,
      setPlacements,
      invalidateSeasonalPlanCache,
      loadSeasonalPlanForGarden,
      selectedRecommendationPlantingId: 77,
      clearPlantingRecommendationCacheEntry,
      loadPlantingRecommendation,
    }));

    await act(async () => {
      await result.current.loadGardens();
      await result.current.loadMe();
      result.current.selectCrop({ id: 1, name: "Tomato" } as never);
      await result.current.loadCropTemplates("Tomato");
      await result.current.loadWeatherForGarden(mine[0]);
      await result.current.loadWeatherForGarden(mine[0]);
      await result.current.loadGardenData();
      await result.current.refreshSeasonalPlan();
    });

    const gardenSetter = setSelectedGarden.mock.calls[0][0] as (current: number | null) => number | null;
    expect(gardenSetter(null)).toBe(3);
    expect(setIsEmailVerified).toHaveBeenCalledWith(true);
    expect(setSelectedCropName).toHaveBeenCalledWith("Tomato");
    expect(setIsLoadingWeather).toHaveBeenCalledWith(true);
    expect(setIsLoadingWeather).toHaveBeenCalledWith(false);
    expect(setBeds).toHaveBeenCalled();
    expect(setPlantings).toHaveBeenCalled();
    expect(setPlacements).toHaveBeenCalled();
    expect(invalidateSeasonalPlanCache).toHaveBeenCalledWith(3);
    expect(loadSeasonalPlanForGarden).toHaveBeenCalledWith(mine[0], true);
    expect(clearPlantingRecommendationCacheEntry).toHaveBeenCalledWith(77);
    expect(loadPlantingRecommendation).toHaveBeenCalledWith(77);
  });
});