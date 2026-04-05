import { useEffect, useMemo, useState } from "react";
import { BedFormState, GardenFormState, MicroclimateFormState, MicroclimateSuggestion } from "../types";
import { Garden } from "../../types";

type UseGardenDraftStateParams = {
  selectedGardenRecord: Garden | undefined;
};

export function useGardenDraftState({ selectedGardenRecord }: UseGardenDraftStateParams) {
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
  const [microclimateSuggestion, setMicroclimateSuggestion] = useState<MicroclimateSuggestion | null>(null);

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

  return {
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
  };
}
