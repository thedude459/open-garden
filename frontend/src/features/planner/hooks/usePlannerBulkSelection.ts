import { useEffect, useState } from "react";
import { Placement } from "../../types";

export function usePlannerBulkSelection(
  placements: Placement[],
  clearFocusedPlacement: () => void,
) {
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedPlacementIds, setSelectedPlacementIds] = useState<number[]>([]);
  const [lassoStart, setLassoStart] = useState<{ bedId: number; x: number; y: number } | null>(null);
  const [lassoCurrent, setLassoCurrent] = useState<{ bedId: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (bulkMode) {
      clearFocusedPlacement();
    }
  }, [bulkMode, clearFocusedPlacement]);

  const toggleBulkMode = () => {
    setBulkMode((current) => !current);
    setSelectedPlacementIds([]);
  };

  const clearSelection = () => {
    setSelectedPlacementIds([]);
  };

  const togglePlacementSelection = (placementId: number) => {
    setSelectedPlacementIds((current) => (
      current.includes(placementId)
        ? current.filter((id) => id !== placementId)
        : [...current, placementId]
    ));
  };

  const selectPlacementsInRect = (
    bedId: number,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    append: boolean,
  ) => {
    const minX = Math.min(fromX, toX);
    const maxX = Math.max(fromX, toX);
    const minY = Math.min(fromY, toY);
    const maxY = Math.max(fromY, toY);
    const idsInRect = placements
      .filter((placement) => placement.bed_id === bedId)
      .filter((placement) => placement.grid_x >= minX && placement.grid_x <= maxX && placement.grid_y >= minY && placement.grid_y <= maxY)
      .map((placement) => placement.id);

    setSelectedPlacementIds((current) => {
      if (append) {
        return Array.from(new Set([...current, ...idsInRect]));
      }
      return idsInRect;
    });
  };

  const startLasso = (bedId: number, x: number, y: number) => {
    if (!bulkMode) {
      return;
    }
    setLassoStart({ bedId, x, y });
    setLassoCurrent({ bedId, x, y });
  };

  const updateLasso = (bedId: number, x: number, y: number) => {
    if (!lassoStart || lassoStart.bedId !== bedId) {
      return;
    }
    setLassoCurrent({ bedId, x, y });
  };

  const finishLasso = (append: boolean) => {
    if (!lassoStart || !lassoCurrent || lassoStart.bedId !== lassoCurrent.bedId) {
      setLassoStart(null);
      setLassoCurrent(null);
      return;
    }

    selectPlacementsInRect(
      lassoStart.bedId,
      lassoStart.x,
      lassoStart.y,
      lassoCurrent.x,
      lassoCurrent.y,
      append,
    );

    setLassoStart(null);
    setLassoCurrent(null);
  };

  return {
    bulkMode,
    selectedPlacementIds,
    toggleBulkMode,
    clearSelection,
    togglePlacementSelection,
    startLasso,
    updateLasso,
    finishLasso,
  };
}
