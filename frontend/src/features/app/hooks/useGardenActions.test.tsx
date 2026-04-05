import type { FormEvent } from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useGardenActions } from "./useGardenActions";
import { Garden } from "../../types";

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

function makeFormEvent() {
  return {
    preventDefault: vi.fn(),
    currentTarget: { reset: vi.fn() },
  } as unknown as FormEvent<HTMLFormElement>;
}

function renderGardenActions(overrides: Partial<Parameters<typeof useGardenActions>[0]> = {}) {
  const pushNotice = vi.fn();
  const loadGardens = vi.fn(async () => undefined);
  const loadGardenData = vi.fn(async () => undefined);
  const fetchAuthed = vi.fn(async () => undefined);

  const hook = renderHook(() =>
    useGardenActions({
      fetchAuthed: fetchAuthed as unknown as <T = unknown>(url: string, options?: RequestInit) => Promise<T>,
      pushNotice,
      selectedGarden: 1,
      selectedGardenRecord: garden,
      loadGardens,
      loadGardenData,
      invalidateGardenInsightCaches: vi.fn(),
      loadClimateForGarden: vi.fn(async () => undefined),
      loadPlantingWindowsForGarden: vi.fn(async () => undefined),
      loadSunPathForGarden: vi.fn(async () => undefined),
      setGardens: vi.fn(),
      invalidateSensorCaches: vi.fn(),
      loadSensorSummaryForGarden: vi.fn(async () => undefined),
      setBeds: vi.fn(),
      ...overrides,
    }),
  );

  return { ...hook, fetchAuthed, pushNotice, loadGardens, loadGardenData };
}

describe("useGardenActions", () => {
  it("blocks garden creation when validation fails", async () => {
    const { result, fetchAuthed } = renderGardenActions();

    await act(async () => {
      await result.current.createGarden(makeFormEvent());
    });

    expect(fetchAuthed).not.toHaveBeenCalled();
    expect(result.current.showGardenValidation).toBe(true);
  });

  it("creates a garden and refreshes the garden list", async () => {
    const { result, fetchAuthed, loadGardens, pushNotice } = renderGardenActions();

    act(() => {
      result.current.setGardenDraft({
        name: "Kitchen Garden",
        description: "Sunny beds",
        zip_code: "80301",
        yard_width_ft: 18,
        yard_length_ft: 24,
        address_private: "",
        is_shared: false,
      });
    });

    await act(async () => {
      await result.current.createGarden(makeFormEvent());
    });

    expect(fetchAuthed).toHaveBeenCalledWith(
      "/gardens",
      expect.objectContaining({ method: "POST" }),
    );
    expect(loadGardens).toHaveBeenCalledTimes(1);
    expect(pushNotice).toHaveBeenCalledWith("Garden created.", "success");
    expect(result.current.showGardenValidation).toBe(false);
  });

  it("returns early when creating a bed without a selected garden", async () => {
    const { result, fetchAuthed } = renderGardenActions({ selectedGarden: null });

    act(() => {
      result.current.setBedDraft({ name: "North Bed", width_ft: 4, length_ft: 8 });
    });

    await act(async () => {
      await result.current.createBed(makeFormEvent());
    });

    expect(fetchAuthed).not.toHaveBeenCalled();
  });

  it("updates yard size and reloads garden data", async () => {
    const { result, fetchAuthed, loadGardens, loadGardenData, pushNotice } = renderGardenActions();

    act(() => {
      result.current.setYardWidthDraft(28);
      result.current.setYardLengthDraft(32);
    });

    await act(async () => {
      await result.current.updateYardSize(makeFormEvent());
    });

    expect(fetchAuthed).toHaveBeenCalledWith(
      "/gardens/1/yard",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(loadGardens).toHaveBeenCalledTimes(1);
    expect(loadGardenData).toHaveBeenCalledTimes(1);
    expect(pushNotice).toHaveBeenCalledWith("Yard size updated.", "success");
  });

  it("exposes suggestMicroclimateProfile and loads suggestions", async () => {
    const fetchAuthedMock = vi.fn(async (path: string) => {
      if (path === "/gardens/1/microclimate/suggest") {
        return {
          sun_exposure: { value: "part_sun", note: "" },
          wind_exposure: { value: "moderate", note: "" },
          slope_position: { value: "mid", note: "" },
          frost_pocket_risk: { value: "low", note: "" },
          orientation: { value: "south", note: "" },
          thermal_mass: { value: "moderate", note: "" },
        };
      }
      throw new Error(`Unhandled path: ${path}`);
    });

    const { result } = renderHook(() => useGardenActions({
      fetchAuthed: fetchAuthedMock as unknown as <T = unknown>(url: string, options?: RequestInit) => Promise<T>,
      pushNotice: vi.fn(),
      selectedGarden: 1,
      selectedGardenRecord: garden,
      loadGardens: vi.fn(async () => undefined),
      loadGardenData: vi.fn(async () => undefined),
      invalidateGardenInsightCaches: vi.fn(),
      loadClimateForGarden: vi.fn(async () => undefined),
      loadPlantingWindowsForGarden: vi.fn(async () => undefined),
      loadSunPathForGarden: vi.fn(async () => undefined),
      setGardens: vi.fn(),
      invalidateSensorCaches: vi.fn(),
      loadSensorSummaryForGarden: vi.fn(async () => undefined),
      setBeds: vi.fn(),
    }));

    expect(typeof result.current.suggestMicroclimateProfile).toBe("function");

    await act(async () => {
      await result.current.suggestMicroclimateProfile();
    });

    expect(fetchAuthedMock).toHaveBeenCalledWith("/gardens/1/microclimate/suggest");
  });
});
