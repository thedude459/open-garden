import type { ValidationViolation, ValidationWarning } from "@/lib/garden/types";

export function formatViolation(violation: ValidationViolation): string {
  switch (violation.code) {
    case "SPACING":
      return violation.message.includes("close")
        ? violation.message
        : `This spot is too close to another plant — ${violation.message}`;
    case "INCOMPATIBLE":
      return violation.message.includes("incompatible")
        ? violation.message
        : `These plants should not grow side by side — ${violation.message}`;
    case "BOUNDARY":
      return "Place inside a garden bed, not on a path or outside the bed.";
    case "OVERLAP":
      return "This placement overlaps another area in the garden.";
    case "TREE_SPACING":
      return violation.message || "Trees need more room — check spacing for this variety.";
    default:
      return violation.message;
  }
}

export function formatWarning(warning: ValidationWarning): string {
  switch (warning.code) {
    case "CLIMATE_DATE":
      return warning.message || "This planting date is outside the ideal window for your area.";
    case "CROP_ROTATION":
      return warning.message || "Consider crop rotation before planting the same family here again.";
    case "ORCHARD_COMPANION":
      return warning.message;
    case "ORCHARD_GUILD":
      return warning.message;
    default:
      return warning.message;
  }
}

export const EMPTY_BED_HINT = "Drag or tap to add plants from the library.";
export const ARMED_PLANT_HINT = "Click a spot on a bed to place the plant. Press Escape to cancel.";
export const ARMED_TRANSPLANT_HINT =
  "Click where the plant should go on its target bed. Press Escape to cancel.";
export const FIRST_PLANT_HINT =
  "Ready for your first plant — search the library, then drag or click a bed.";
export const EMPTY_CANVAS_HINT =
  "Start by adding a bed in the area editor below, then place plants from the library.";
