import { Bed, CropTemplate, Placement } from "../types";

export type CanopyShape = {
  placementId: number;
  cropName: string;
  centerXFt: number;
  centerYFt: number;
  radiusFt: number;
  progress: number;
  ageDays: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function dayDiff(startIso: string, endDate: Date) {
  const start = new Date(`${startIso}T00:00:00`);
  const diff = endDate.getTime() - start.getTime();
  return Math.max(0, Math.floor(diff / MS_PER_DAY));
}

export function buildCanopyPreview(
  beds: Bed[],
  placements: Placement[],
  cropTemplates: CropTemplate[],
  dayOffset: number,
): CanopyShape[] {
  const bedMap = new Map(beds.map((bed) => [bed.id, bed]));
  const cropMap = new Map(cropTemplates.map((crop) => [crop.name, crop]));
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + Math.round(dayOffset));

  return placements
    .map((placement) => {
      const bed = bedMap.get(placement.bed_id);
      if (!bed) {
        return null;
      }

      const crop = cropMap.get(placement.crop_name);
      const spacingIn = Math.max(6, crop?.spacing_in || 12);
      const daysToHarvest = Math.max(21, crop?.days_to_harvest || 75);
      const ageDays = dayDiff(placement.planted_on, targetDate);
      const growthProgress = clamp01(ageDays / daysToHarvest);

      const centerXFt = bed.grid_x + (placement.grid_x * 3 + 1.5) / 12;
      const centerYFt = bed.grid_y + (placement.grid_y * 3 + 1.5) / 12;
      const matureRadiusFt = Math.max(0.24, spacingIn / 24);
      const radiusFt = matureRadiusFt * (0.28 + 0.72 * growthProgress);

      return {
        placementId: placement.id,
        cropName: placement.crop_name,
        centerXFt,
        centerYFt,
        radiusFt,
        progress: growthProgress,
        ageDays,
      };
    })
    .filter((shape): shape is CanopyShape => Boolean(shape));
}
