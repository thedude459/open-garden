import { FormEvent, useCallback } from "react";
import { getErrorMessage, hasValidationErrors } from "../utils/appUtils";
import {
  FetchAuthed,
} from "../types";
import { Bed, Garden, SensorKind } from "../../types";
import { useGardenDraftState } from "./useGardenDraftState";
import { useGardenMicroclimateActions } from "./useGardenMicroclimateActions";
import { useGardenSensorActions } from "./useGardenSensorActions";

type NoticeKind = "info" | "success" | "error";

interface UseGardenActionsParams {
  fetchAuthed: FetchAuthed;
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
  setBeds: React.Dispatch<React.SetStateAction<Bed[]>>;
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
  const {
    gardenDraft,
    setGardenDraft,
    bedDraft,
    setBedDraft,
    showGardenValidation,
    setShowGardenValidation,
    showBedValidation,
    setShowBedValidation,
    showYardValidation,
    setShowYardValidation,
    yardWidthDraft,
    setYardWidthDraft,
    yardLengthDraft,
    setYardLengthDraft,
    microclimateDraft,
    setMicroclimateDraft,
    microclimateSuggestion,
    setMicroclimateSuggestion,
    gardenFormErrors,
    bedFormErrors,
    yardFormErrors,
  } = useGardenDraftState({ selectedGardenRecord });

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
      } catch (err: unknown) {
        pushNotice(getErrorMessage(err, "Unable to create garden."), "error");
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
      } catch (err: unknown) {
        pushNotice(getErrorMessage(err, "Unable to create bed."), "error");
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
      } catch (err: unknown) {
        pushNotice(getErrorMessage(err, "Unable to update yard size."), "error");
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

  const microclimateActions = useGardenMicroclimateActions({
    fetchAuthed,
    pushNotice,
    selectedGarden,
    microclimateDraft,
    setMicroclimateDraft,
    setMicroclimateSuggestion,
    setGardens,
    invalidateGardenInsightCaches,
    loadClimateForGarden,
    loadPlantingWindowsForGarden,
    loadSunPathForGarden,
  });

  const sensorActions = useGardenSensorActions({
    fetchAuthed,
    pushNotice,
    selectedGardenRecord,
    invalidateSensorCaches,
    loadSensorSummaryForGarden,
  });

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
    isGeocodingAddress: microclimateActions.isGeocodingAddress,
    isSuggestingMicroclimate: microclimateActions.isSuggestingMicroclimate,
    gardenFormErrors,
    bedFormErrors,
    yardFormErrors,
    createGarden,
    createBed,
    updateYardSize,
    saveMicroclimateProfile: microclimateActions.saveMicroclimateProfile,
    geocodeGardenAddress: microclimateActions.geocodeGardenAddress,
    suggestMicroclimateProfile: microclimateActions.suggestMicroclimateProfile,
    registerSensor: sensorActions.registerSensor,
    ingestSensorData: sensorActions.ingestSensorData,
  };
}
