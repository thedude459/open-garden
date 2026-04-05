import { useCallback, useState } from "react";
import { FetchAuthed, MicroclimateFormState, MicroclimateSuggestion } from "../types";
import { Garden } from "../../types";
import { getErrorMessage } from "../utils/appUtils";

type NoticeKind = "info" | "success" | "error";

interface UseGardenMicroclimateActionsParams {
  fetchAuthed: FetchAuthed;
  pushNotice: (message: string, kind: NoticeKind) => void;
  selectedGarden: number | null;
  microclimateDraft: MicroclimateFormState;
  setMicroclimateDraft: React.Dispatch<React.SetStateAction<MicroclimateFormState>>;
  setMicroclimateSuggestion: React.Dispatch<React.SetStateAction<MicroclimateSuggestion | null>>;
  setGardens: React.Dispatch<React.SetStateAction<Garden[]>>;
  invalidateGardenInsightCaches: (gardenId: number) => void;
  loadClimateForGarden: (garden: Garden) => Promise<void>;
  loadPlantingWindowsForGarden: (garden: Garden) => Promise<void>;
  loadSunPathForGarden: (garden: Garden) => Promise<void>;
}

export function useGardenMicroclimateActions({
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
}: UseGardenMicroclimateActionsParams) {
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [isSuggestingMicroclimate, setIsSuggestingMicroclimate] = useState(false);

  const saveMicroclimateProfile = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selectedGarden) return;
      try {
        const updatedGarden: Garden = await fetchAuthed(`/gardens/${selectedGarden}/microclimate`, {
          method: "PATCH",
          body: JSON.stringify(microclimateDraft),
        });
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
      } catch (err: unknown) {
        pushNotice(getErrorMessage(err, "Unable to update the microclimate profile."), "error");
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
        current.map((garden) => (garden.id === updatedGarden.id ? { ...garden, ...updatedGarden } : garden)),
      );
      invalidateGardenInsightCaches(selectedGarden);
      await loadClimateForGarden(updatedGarden);
      pushNotice(
        "Location refined - weather and climate guidance now use your precise address.",
        "success",
      );
    } catch (err: unknown) {
      pushNotice(getErrorMessage(err, "Unable to refine location from address."), "error");
    } finally {
      setIsGeocodingAddress(false);
    }
  }, [fetchAuthed, selectedGarden, setGardens, invalidateGardenInsightCaches, loadClimateForGarden, pushNotice]);

  const suggestMicroclimateProfile = useCallback(async () => {
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
      pushNotice("Fields updated from location data - review and save.", "success");
    } catch (err: unknown) {
      pushNotice(getErrorMessage(err, "Unable to fetch location suggestions."), "error");
    } finally {
      setIsSuggestingMicroclimate(false);
    }
  }, [fetchAuthed, selectedGarden, setMicroclimateSuggestion, setMicroclimateDraft, pushNotice]);

  return {
    isGeocodingAddress,
    isSuggestingMicroclimate,
    saveMicroclimateProfile,
    geocodeGardenAddress,
    suggestMicroclimateProfile,
  };
}
