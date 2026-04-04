export const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
export const palette = ["#ed7b49", "#57a773", "#2f6fba", "#c95f90", "#8979ff", "#1c8c84"];
export const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const YARD_CELL_PX = 24;

export const orientationOptions = [
  { value: "north", label: "North-facing" },
  { value: "east", label: "East-facing" },
  { value: "south", label: "South-facing" },
  { value: "west", label: "West-facing" },
] as const;

export const sunExposureOptions = [
  { value: "full_sun", label: "Full sun" },
  { value: "part_sun", label: "Part sun" },
  { value: "part_shade", label: "Part shade" },
  { value: "full_shade", label: "Full shade" },
] as const;

export const windExposureOptions = [
  { value: "sheltered", label: "Sheltered" },
  { value: "moderate", label: "Moderate" },
  { value: "exposed", label: "Exposed" },
] as const;

export const thermalMassOptions = [
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
] as const;

export const slopePositionOptions = [
  { value: "low", label: "Low spot" },
  { value: "mid", label: "Mid-slope" },
  { value: "high", label: "High ground" },
] as const;

export const frostPocketOptions = [
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
] as const;
