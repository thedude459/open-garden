import { Garden } from "../types";

export type TokenResponse = { access_token: string; token_type: string };
export type LoginMode = "signin" | "register";
export type AuthPane = "login" | "forgot-password" | "forgot-username" | "reset";
export type AppPage = "home" | "timeline" | "calendar" | "seasonal" | "planner" | "coach" | "crops" | "pests" | "sensors";

export type ConfirmState = {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
};

export type MicroclimateFormState = Pick<
  Garden,
  "orientation" | "sun_exposure" | "wind_exposure" | "thermal_mass" | "slope_position" | "frost_pocket_risk" | "address_private" | "edge_buffer_in"
>;

export type MicroclimateSignalNote = { value: string | null; note: string };

export type MicroclimateSuggestion = {
  sun_exposure: MicroclimateSignalNote;
  wind_exposure: MicroclimateSignalNote;
  slope_position: MicroclimateSignalNote;
  frost_pocket_risk: MicroclimateSignalNote;
  orientation: MicroclimateSignalNote;
  thermal_mass: MicroclimateSignalNote;
};

export type GardenFormState = {
  name: string;
  description: string;
  zip_code: string;
  yard_width_ft: number;
  yard_length_ft: number;
  address_private: string;
  is_shared: boolean;
};

export type BedFormState = {
  name: string;
  width_ft: number;
  length_ft: number;
};

export type PlannerHistoryEntry = {
  label: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
};
