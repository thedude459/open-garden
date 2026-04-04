import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { hasValidationErrors } from "../utils";
import {
  BedFormState,
  GardenFormState,
  MicroclimateFormState,
  MicroclimateSuggestion,
} from "../types";
import { Garden, GardenClimate, SensorKind } from "../../types";

type NoticeKind = "info" | "success" | "error";

interface UseGardenActionsParams {
  fetchAuthed: (url: string, options?: RequestInit) => Promise<any>;
  pushNotice: (message: string, kind: NoticeKind) => void;
  selectedGarden: number | null;
  selectedGardenRecord: Garden | undefined;
  loadGardens: () => Promise<void>;
  loadGardenData: () => Promise<void>;
  invalidateGardenInsightCaches: (gardenId: number) => void;
  loadClimateForGarden: (garden: Garden) => Promise<void>;
  loadPlantingWindowsForGarden: (garden: Garden) => Promise<void>;
  loadSunPathForGarden: (garden: Garden) => Promise<void>;
  setGardens: React.Dispatch<React.SetStateAction<Garden[]>>;
  invalidateSensorCaches: (gardenId: number) => void;
  loadSensorSummaryForGarden: (garden: Garden, force?: boolean) => Promise<void>;
  setBeds: React.Dispatch<React.SetStateAction<any[]>>;
}

export function useGardenActions({
  fetchAuthed,
  pushNotice,
  selectedGarden,
  selectedGardenRecord,
  loadGardens,
  loadGardenData,
  invalidateGardenInsightCaches,
  loadClimateForGarden,
  loadPlantingWindowsForGarden,
  loadSunPathForGarden,
  setGardens,
  invalidateSensorCaches,
  loadSensorSummaryForGarden,
  setBeds,
}: UseGardenActionsParams) {
  const [gardenDraft, setGardenDraft] = useState<GardenFormState>({
    name: "",
    description: "",
    zip_code: "",
    yard_width_ft: 20,
    yard_length_ft: 20,
    address_private: "",
    is_shared: false,
  });
  const [bedDraft, setBedDraft] = useState<BedFormState>({ name: "", width_ft: 4, length_ft: 8 });
  const [showGardenValidation, setShowGardenValidation] = useState(false);
  const [showBedValidation, setShowBedValidation] = useState(false);
  const [showYardValidation, setShowYardValidation] = useState(false);
  const [yardWidthDraft, setYardWidthDraft] = useState(20);
  const [yardLengthDraft, setYardLengthDraft] = useState(20);
  const [microclimateDraft, setMicroclimateDraft] = useState<MicroclimateFormState>({
    orientation: "south",
    sun_exposure: "part_sun",
    wind_exposure: "moderate",
    thermal_mass: "moderate",
    slope_position: "mid",
    frost_pocket_risk: "low",
    address_private: "",
    edge_buffer_in: 6,
  });
  const [microclimateSuggestion, setMicroclimateSuggestion] =
    useState<MicroclimateSuggestion | null>(null);
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [isSuggestingMicroclimate, setIsSuggestingMicroclimate] = useState(false);

  const gardenFormErrors = useMemo(
    () => ({
      name: gardenDraft.name.trim() ? "" : "Garden name is required.",
      zip_code: /^[0-9]{5}$/.test(gardenDraft.zip_code.trim())
        ? ""
        : "Enter a 5-digit US ZIP code.",
      yard_width_ft: gardenDraft.yard_width_ft >= 4 ? "" : "Yard width must be at least 4 ft.",
      yard_length_ft: gardenDraft.yard_length_ft >= 4 ? "" : "Yard length must be at least 4 ft.",
    }),
    [gardenDraft],
  );

  const bedFormErrors = useMemo(
    () => ({
      name: bedDraft.name.trim() ? "" : "Bed name is required.",
      width_ft: bedDraft.width_ft >= 1 ? "" : "Bed width must be at least 1 ft.",
      length_ft: bedDraft.length_ft >= 1 ? "" : "Bed length must be at least 1 ft.",
    }),
    [bedDraft],
  );

  const yardFormErrors = useMemo(
    () => ({
      yard_width_ft: yardWidthDraft >= 4 ? "" : "Yard width must be at least 4 ft.",
      yard_length_ft: yardLengthDraft >= 4 ? "" : "Yard length must be at least 4 ft.",
    }),
    [yardWidthDraft, yardLengthDraft],
  );

  // Sync draft fields when selected garden changes
  useEffect(() => {
    if (selectedGardenRecord) {
      setYardWidthDraft(selectedGardenRecord.yard_width_ft);
      setYardLengthDraft(selectedGardenRecord.yard_length_ft);
      setMicroclimateDraft({
        orientation: selectedGardenRecord.orientation,
        sun_exposure: selectedGardenRecord.sun_exposure,
        wind_exposure: selectedGardenRecord.wind_exposure,
        thermal_mass: selectedGardenRecord.thermal_mass,
        slope_position: selectedGardenRecord.slope_position,
        frost_pocket_risk: selectedGardenRecord.frost_pocket_risk,
        address_private: selectedGardenRecord.address_private ?? "",
        edge_buffer_in: selectedGardenRecord.edge_buffer_in,
      });
      setMicroclimateSuggestion(null);
    }
  }, [selectedGardenRecord]);

  const createGarden = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setShowGardenValidation(true);
      if (hasValidationErrors(gardenFormErrors)) return;
      try {
        await fetchAuthed("/gardens", {
          method: "POST",
          body: JSON.stringify({
            name: gardenDraft.name.trim(),
            description: gardenDraft.description.trim(),
            zip_code: gardenDraft.zip_code.trim(),
            yard_width_ft: Math.max(4, Number(gardenDraft.yard_width_ft || 20)),
            yard_length_ft: Math.max(4, Number(gardenDraft.yard_length_ft || 20)),
            address_private: gardenDraft.address_private.trim(),
            is_shared: gardenDraft.is_shared,
          }),
        });
        setGardenDraft({
          name: "",
          description: "",
          zip_code: "",
          yard_width_ft: 20,
          yard_length_ft: 20,
          address_private: "",
          is_shared: false,
        });
        setShowGardenValidation(false);
        await loadGardens();
        pushNotice("Garden created.", "success");
      } catch (err: any) {
        pushNotice(err?.message || "Unable to create garden.", "error");
      }
    },
    [fetchAuthed, gardenDraft, gardenFormErrors, loadGardens, pushNotice],
  );

  const createBed = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!selectedGarden) return;
      setShowBedValidation(true);
      if (hasValidationErrors(bedFormErrors)) return;
      try {
        const widthFt = bedDraft.width_ft;
        const lengthFt = bedDraft.length_ft;
        await fetchAuthed(`/gardens/${selectedGarden}/beds`, {
          method: "POST",
          body: JSON.stringify({
            name: bedDraft.name.trim(),
            width_in: Math.max(12, Math.round(widthFt * 12)),
            height_in: Math.max(12, Math.round(lengthFt * 12)),
            grid_x: 0,
            grid_y: 0,
          }),
        });
        setBedDraft({ name: "", width_ft: 4, length_ft: 8 });
        setShowBedValidation(false);
        await loadGardenData();
        pushNotice("Bed added to yard layout.", "success");
      } catch (err: any) {
        pushNotice(err?.message || "Unable to create bed.", "error");
      }
    },
    [fetchAuthed, selectedGarden, bedDraft, bedFormErrors, loadGardenData, pushNotice],
  );

  const updateYardSize = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!selectedGarden) return;
      setShowYardValidation(true);
      if (hasValidationErrors(yardFormErrors)) return;
      try {
        await fetchAuthed(`/gardens/${selectedGarden}/yard`, {
          method: "PATCH",
          body: JSON.stringify({
            yard_width_ft: Math.max(4, Math.round(yardWidthDraft)),
            yard_length_ft: Math.max(4, Math.round(yardLengthDraft)),
          }),
        });
        setShowYardValidation(false);
        await loadGardens();
        await loadGardenData();
        pushNotice("Yard size updated.", "success");
      } catch (err: any) {
        pushNotice(err?.message || "Unable to update yard size.", "error");
      }
    },
    [
      fetchAuthed,
      selectedGarden,
      yardWidthDraft,
      yardLengthDraft,
      yardFormErrors,
      loadGardens,
      loadGardenData,
      pushNotice,
    ],
  );

  const saveMicroclimateProfile = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!selectedGarden) return;
      try {
        const updatedGarden: Garden = await fetchAuthed(
          `/gardens/${selectedGarden}/microclimate`,
          { method: "PATCH", body: JSON.stringify(microclimateDraft) },
        );
        setGardens((current) =>
          current.map((garden) =>
            garden.id === updatedGarden.id ? { ...garden, ...updatedGarden } : garden,
          ),
        );
        invalidateGardenInsightCaches(selectedGarden);
        await loadClimateForGarden(updatedGarden);
        await loadPlantingWindowsForGarden(updatedGarden);
        await loadSunPathForGarden(updatedGarden);
        pushNotice("Microclimate profile updated.", "success");
      } catch (err: any) {
        pushNotice(err?.message || "Unable to update the microclimate profile.", "error");
      }
    },
    [
      fetchAuthed,
      selectedGarden,
      microclimateDraft,
      setGardens,
      invalidateGardenInsightCaches,
      loadClimateForGarden,
      loadPlantingWindowsForGarden,
      loadSunPathForGarden,
      pushNotice,
    ],
  );

  const geocodeGardenAddress = useCallback(async () => {
    if (!selectedGarden) return;
    setIsGeocodingAddress(true);
    try {
      const updatedGarden: Garden = await fetchAuthed(`/gardens/${selectedGarden}/geocode`, {
        method: "PATCH",
      });
      setGardens((current) =>
        current.map((g) => (g.id === updatedGarden.id ? { ...g, ...updatedGarden } : g)),
      );
      invalidateGardenInsightCaches(selectedGarden);
      await loadClimateForGarden(updatedGarden);
      pushNotice(
        "Location refined — weather and climate guidance now use your precise address.",
        "success",
      );
    } catch (err: any) {
      pushNotice(err?.message || "Unable to refine location from address.", "error");
    } finally {
      setIsGeocodingAddress(false);
    }
  }, [fetchAuthed, selectedGarden, setGardens, invalidateGardenInsightCaches, loadClimateForGarden, pushNotice]);

  const suggestMicrocliamateProfile = useCallback(async () => {
    if (!selectedGarden) return;
    setIsSuggestingMicroclimate(true);
    setMicroclimateSuggestion(null);
    try {
      const suggestion: MicroclimateSuggestion = await fetchAuthed(
        `/gardens/${selectedGarden}/microclimate/suggest`,
      );
      setMicroclimateSuggestion(suggestion);
      setMicroclimateDraft((current) => ({
        ...current,
        ...(suggestion.sun_exposure.value
          ? { sun_exposure: suggestion.sun_exposure.value as MicroclimateFormState["sun_exposure"] }
          : {}),
        ...(suggestion.wind_exposure.value
          ? { wind_exposure: suggestion.wind_exposure.value as MicroclimateFormState["wind_exposure"] }
          : {}),
        ...(suggestion.slope_position.value
          ? { slope_position: suggestion.slope_position.value as MicroclimateFormState["slope_position"] }
          : {}),
        ...(suggestion.frost_pocket_risk.value
          ? { frost_pocket_risk: suggestion.frost_pocket_risk.value as MicroclimateFormState["frost_pocket_risk"] }
          : {}),
      }));
      pushNotice("Fields updated from location data — review and save.", "success");
    } catch (err: any) {
      pushNotice(err?.message || "Unable to fetch location suggestions.", "error");
    } finally {
      setIsSuggestingMicroclimate(false);
    }
  }, [fetchAuthed, selectedGarden, pushNotice]);

  const registerSensor = useCallback(
    async (payload: {
      bed_id: number | null;
      name: string;
      sensor_kind: SensorKind;
      unit: string;
      location_label: string;
      hardware_id: string;
    }) => {
      if (!selectedGardenRecord) return;
      await fetchAuthed("/sensors/register", {
        method: "POST",
        body: JSON.stringify({
          garden_id: selectedGardenRecord.id,
          bed_id: payload.bed_id,
          name: payload.name,
          sensor_kind: payload.sensor_kind,
          unit: payload.unit,
          location_label: payload.location_label,
          hardware_id: payload.hardware_id,
        }),
      });
      invalidateSensorCaches(selectedGardenRecord.id);
      await loadSensorSummaryForGarden(selectedGardenRecord, true);
      pushNotice("Sensor registered.", "success");
    },
    [fetchAuthed, selectedGardenRecord, invalidateSensorCaches, loadSensorSummaryForGarden, pushNotice],
  );

  const ingestSensorData = useCallback(
    async (sensorId: number, value: number) => {
      if (!selectedGardenRecord) return;
      await fetchAuthed(`/sensors/${sensorId}/data`, {
        method: "POST",
        body: JSON.stringify({ value }),
      });
      invalidateSensorCaches(selectedGardenRecord.id);
      await loadSensorSummaryForGarden(selectedGardenRecord, true);
      pushNotice("Sensor reading ingested.", "success");
    },
    [fetchAuthed, selectedGardenRecord, invalidateSensorCaches, loadSensorSummaryForGarden, pushNotice],
  );

  return {
    gardenDraft,
    setGardenDraft,
    bedDraft,
    setBedDraft,
    showGardenValidation,
    showBedValidation,
    showYardValidation,
    yardWidthDraft,
    setYardWidthDraft,
    yardLengthDraft,
    setYardLengthDraft,
    microclimateDraft,
    setMicroclimateDraft,
    microclimateSuggestion,
    isGeocodingAddress,
    isSuggestingMicroclimate,
    gardenFormErrors,
    bedFormErrors,
    yardFormErrors,
    createGarden,
    createBed,
    updateYardSize,
    saveMicroclimateProfile,
    geocodeGardenAddress,
    suggestMicrocliamateProfile,
    registerSensor,
    ingestSensorData,
  };
}
