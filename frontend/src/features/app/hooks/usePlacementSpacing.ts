import { useCallback } from "react";
import { CropTemplate, Bed, Placement, Garden } from "../../types";

interface UsePlacementSpacingParams {
  beds: Bed[];
  placements: Placement[];
  selectedGardenRecord: Garden | undefined;
  cropMap: Map<string, CropTemplate>;
  selectedCropName: string;
}

interface UsePlacementSpacingReturn {
  isCellInBuffer: (bedId: number, x: number, y: number) => boolean;
  placementSpacingConflict: (
    bedId: number,
    x: number,
    y: number,
    cropName: string,
    ignorePlacementId?: number
  ) => string | null;
  isCellBlockedForSelectedCrop: (
    bedId: number,
    x: number,
    y: number,
    occupant: Placement | undefined
  ) => boolean;
}

/**
 * Isolates placement spacing and buffer validation logic.
 * Checks if placements violate edge buffers, crop spacing requirements,
 * or other placement constraints.
 */
export function usePlacementSpacing({
  beds,
  placements,
  selectedGardenRecord,
  cropMap,
  selectedCropName,
}: UsePlacementSpacingParams): UsePlacementSpacingReturn {
  const isCellInBuffer = useCallback(
    (bedId: number, x: number, y: number): boolean => {
      if (!selectedGardenRecord) return false;
      const bed = beds.find((b) => b.id === bedId);
      if (!bed) return false;
      const bufferCells = Math.ceil(selectedGardenRecord.edge_buffer_in / 3);
      const bedCols = Math.max(1, Math.ceil(bed.width_in / 3));
      const bedRows = Math.max(1, Math.ceil(bed.height_in / 3));
      return (
        x < bufferCells ||
        x >= bedCols - bufferCells ||
        y < bufferCells ||
        y >= bedRows - bufferCells
      );
    },
    [selectedGardenRecord, beds]
  );

  const placementSpacingConflict = useCallback(
    (
      bedId: number,
      x: number,
      y: number,
      cropName: string,
      ignorePlacementId?: number
    ): string | null => {
      if (isCellInBuffer(bedId, x, y)) {
        return `Placement is too close to the bed edge. Required buffer is ${
          selectedGardenRecord?.edge_buffer_in ?? 6
        } inches.`;
      }
      const newSpacing = cropMap.get(cropName)?.spacing_in || 12;
      const bedPlacements = placements.filter(
        (p) => p.bed_id === bedId && p.id !== ignorePlacementId
      );
      for (const existing of bedPlacements) {
        const existingSpacing = cropMap.get(existing.crop_name)?.spacing_in || 12;
        const required = Math.max(newSpacing, existingSpacing);
        const dx = (x - existing.grid_x) * 3;
        const dy = (y - existing.grid_y) * 3;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < required) {
          return `Too close to ${existing.crop_name}. Required spacing is ${required} inches.`;
        }
      }
      return null;
    },
    [isCellInBuffer, cropMap, placements, selectedGardenRecord]
  );

  const isCellBlockedForSelectedCrop = useCallback(
    (
      bedId: number,
      x: number,
      y: number,
      occupant: Placement | undefined
    ): boolean => {
      if (occupant || !selectedCropName) return false;
      return Boolean(placementSpacingConflict(bedId, x, y, selectedCropName));
    },
    [placementSpacingConflict, selectedCropName]
  );

  return {
    isCellInBuffer,
    placementSpacingConflict,
    isCellBlockedForSelectedCrop,
  };
}
