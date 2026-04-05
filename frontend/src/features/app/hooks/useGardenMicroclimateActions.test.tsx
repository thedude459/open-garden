import type { FormEvent } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Garden } from "../../types";
import type { MicroclimateFormState, MicroclimateSuggestion } from "../types";
import { useGardenMicroclimateActions } from "./useGardenMicroclimateActions";

const garden: Garden = {
  id: 1,
  name: "Backyard",
  description: "",
  zip_code: "80301",
  growing_zone: "6a",
  yard_width_ft: 20,
  yard_length_ft: 20,
  latitude: 40,
  longitude: -105,
  orientation: "south",
  sun_exposure: "full_sun",
  wind_exposure: "moderate",
  thermal_mass: "moderate",
  slope_position: "mid",
  frost_pocket_risk: "low",
  address_private: "",
  is_shared: false,
  edge_buffer_in: 6,
};

const baseDraft: MicroclimateFormState = {
  orientation: "south",
  sun_exposure: "part_sun",
  wind_exposure: "moderate",
  thermal_mass: "moderate",
  slope_position: "mid",
  frost_pocket_risk: "low",
  address_private: "",
  edge_buffer_in: 6,
};

function makeFormEvent() {
  return {
    preventDefault: vi.fn(),
  } as unknown as FormEvent<HTMLFormElement>;
}

function renderMicroclimateActions(overrides: Partial<Parameters<typeof useGardenMicroclimateActions>[0]> = {}) {
  let currentDraft: MicroclimateFormState = { ...baseDraft };
  let currentSuggestion: MicroclimateSuggestion | null = null;
  let currentGardens: Garden[] = [garden];

  const defaultFetchAuthed = vi.fn(async () => garden);
  const pushNotice = vi.fn();
  const invalidateGardenInsightCaches = vi.fn();
  const loadClimateForGarden = vi.fn(async () => undefined);
  const loadPlantingWindowsForGarden = vi.fn(async () => undefined);
  const loadSunPathForGarden = vi.fn(async () => undefined);
  const setMicroclimateDraft = vi.fn(
    (update: MicroclimateFormState | ((current: MicroclimateFormState) => MicroclimateFormState)) => {
      currentDraft = typeof update === "function" ? update(currentDraft) : update;
    },
  );
  const setMicroclimateSuggestion = vi.fn(
    (
      update:
        | MicroclimateSuggestion
        | null
        | ((current: MicroclimateSuggestion | null) => MicroclimateSuggestion | null),
    ) => {
      currentSuggestion = typeof update === "function" ? update(currentSuggestion) : update;
    },
  );
  const setGardens = vi.fn((update: Garden[] | ((current: Garden[]) => Garden[])) => {
    currentGardens = typeof update === "function" ? update(currentGardens) : update;
  });
  const { fetchAuthed: overrideFetchAuthed, ...restOverrides } = overrides;
  const fetchAuthed = (overrideFetchAuthed ?? defaultFetchAuthed) as <T = unknown>(
    url: string,
    options?: RequestInit,
  ) => Promise<T>;

  const hook = renderHook(() =>
    useGardenMicroclimateActions({
      fetchAuthed,
      pushNotice,
      selectedGarden: 1,
      microclimateDraft: currentDraft,
      setMicroclimateDraft,
      setMicroclimateSuggestion,
      setGardens,
      invalidateGardenInsightCaches,
      loadClimateForGarden,
      loadPlantingWindowsForGarden,
      loadSunPathForGarden,
      ...restOverrides,
    }),
  );

  return {
    ...hook,
    fetchAuthed,
    pushNotice,
    invalidateGardenInsightCaches,
    loadClimateForGarden,
    loadPlantingWindowsForGarden,
    loadSunPathForGarden,
    currentDraftRef: () => currentDraft,
    currentSuggestionRef: () => currentSuggestion,
    currentGardensRef: () => currentGardens,
  };
}

describe("useGardenMicroclimateActions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns early when saving without a selected garden", async () => {
    const { result, fetchAuthed } = renderMicroclimateActions({ selectedGarden: null });

    await act(async () => {
      await result.current.saveMicroclimateProfile(makeFormEvent());
    });

    expect(fetchAuthed).not.toHaveBeenCalled();
  });

  it("saves a microclimate profile and refreshes dependent insights", async () => {
    const updatedGarden: Garden = { ...garden, sun_exposure: "part_sun", wind_exposure: "exposed" };
    const {
      result,
      fetchAuthed,
      invalidateGardenInsightCaches,
      loadClimateForGarden,
      loadPlantingWindowsForGarden,
      loadSunPathForGarden,
      pushNotice,
      currentGardensRef,
    } = renderMicroclimateActions({
      fetchAuthed: vi.fn(async () => updatedGarden) as unknown as <T = unknown>(url: string, options?: RequestInit) => Promise<T>,
    });

    await act(async () => {
      await result.current.saveMicroclimateProfile(makeFormEvent());
    });

    expect(fetchAuthed).toHaveBeenCalledWith(
      "/gardens/1/microclimate",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(invalidateGardenInsightCaches).toHaveBeenCalledWith(1);
    expect(loadClimateForGarden).toHaveBeenCalledWith(updatedGarden);
    expect(loadPlantingWindowsForGarden).toHaveBeenCalledWith(updatedGarden);
    expect(loadSunPathForGarden).toHaveBeenCalledWith(updatedGarden);
    expect(pushNotice).toHaveBeenCalledWith("Microclimate profile updated.", "success");
    expect(currentGardensRef()[0].sun_exposure).toBe("part_sun");
  });

  it("geocodes the garden address and resets loading state on success", async () => {
    const updatedGarden: Garden = { ...garden, latitude: 41, longitude: -104.5 };
    const {
      result,
      fetchAuthed,
      invalidateGardenInsightCaches,
      loadClimateForGarden,
      pushNotice,
    } = renderMicroclimateActions({
      fetchAuthed: vi.fn(async () => updatedGarden) as unknown as <T = unknown>(url: string, options?: RequestInit) => Promise<T>,
    });

    await act(async () => {
      await result.current.geocodeGardenAddress();
    });

    expect(fetchAuthed).toHaveBeenCalledWith(
      "/gardens/1/geocode",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(invalidateGardenInsightCaches).toHaveBeenCalledWith(1);
    expect(loadClimateForGarden).toHaveBeenCalledWith(updatedGarden);
    expect(pushNotice).toHaveBeenCalledWith(
      "Location refined - weather and climate guidance now use your precise address.",
      "success",
    );
    expect(result.current.isGeocodingAddress).toBe(false);
  });

  it("surfaces geocode errors and clears the loading flag", async () => {
    const {
      result,
      pushNotice,
    } = renderMicroclimateActions({
      fetchAuthed: vi.fn(async () => {
        throw new Error("Geocoder offline");
      }) as unknown as <T = unknown>(url: string, options?: RequestInit) => Promise<T>,
    });

    await act(async () => {
      await result.current.geocodeGardenAddress();
    });

    expect(pushNotice).toHaveBeenCalledWith("Geocoder offline", "error");
    expect(result.current.isGeocodingAddress).toBe(false);
  });

  it("applies suggestion values to draft state and stores the suggestion", async () => {
    const suggestion: MicroclimateSuggestion = {
      sun_exposure: { value: "full_sun", note: "South-facing" },
      wind_exposure: { value: "exposed", note: "Open yard" },
      slope_position: { value: "high", note: "Raised site" },
      frost_pocket_risk: { value: "moderate", note: "Cold-air pooling" },
      orientation: { value: "south", note: "" },
      thermal_mass: { value: "moderate", note: "" },
    };
    const {
      result,
      fetchAuthed,
      pushNotice,
      currentDraftRef,
      currentSuggestionRef,
    } = renderMicroclimateActions({
      fetchAuthed: vi.fn(async () => suggestion) as unknown as <T = unknown>(url: string, options?: RequestInit) => Promise<T>,
    });

    await act(async () => {
      await result.current.suggestMicroclimateProfile();
    });

    expect(fetchAuthed).toHaveBeenCalledWith("/gardens/1/microclimate/suggest");
    expect(currentSuggestionRef()).toEqual(suggestion);
    expect(currentDraftRef().sun_exposure).toBe("full_sun");
    expect(currentDraftRef().wind_exposure).toBe("exposed");
    expect(currentDraftRef().slope_position).toBe("high");
    expect(currentDraftRef().frost_pocket_risk).toBe("moderate");
    expect(pushNotice).toHaveBeenCalledWith("Fields updated from location data - review and save.", "success");
    expect(result.current.isSuggestingMicroclimate).toBe(false);
  });
});