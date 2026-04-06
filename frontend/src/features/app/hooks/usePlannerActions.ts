import { useCallback } from "react";
import { ConfirmState, FetchAuthed, PlannerHistoryEntry } from "../types";
import { Bed, CropTemplate, Garden, Placement, Planting, Task } from "../../types";
import { getErrorMessage } from "../utils/appUtils";
import { usePlacementSpacing } from "./usePlacementSpacing";
import { usePlannerPlacementActions } from "./usePlannerPlacementActions";
import { usePlannerBedActions } from "./usePlannerBedActions";

type NoticeKind = "info" | "success" | "error";

interface UsePlannerActionsParams {
  fetchAuthed: FetchAuthed;
  pushNotice: (message: string, kind: NoticeKind) => void;
  setBeds: React.Dispatch<React.SetStateAction<Bed[]>>;
  setPlacements: React.Dispatch<React.SetStateAction<Placement[]>>;
  beds: Bed[];
  placements: Placement[];
  selectedGarden: number | null;
  selectedGardenRecord: Garden | undefined;
  yardWidthFt: number;
  yardLengthFt: number;
  cropMap: Map<string, CropTemplate>;
  selectedCropName: string;
  selectedDate: string;
  pushPlannerHistory: (entry: PlannerHistoryEntry) => void;
  setConfirmState: React.Dispatch<React.SetStateAction<ConfirmState | null>>;
  loadGardens: () => Promise<void>;
  loadGardenData: () => Promise<void>;
  setSelectedGarden: (id: number | null) => void;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  setPlantings: React.Dispatch<React.SetStateAction<Planting[]>>;
}

export function usePlannerActions({
  fetchAuthed,
  pushNotice,
  setBeds,
  setPlacements,
  beds,
  placements,
  selectedGarden,
  selectedGardenRecord,
  yardWidthFt,
  yardLengthFt,
  cropMap,
  selectedCropName,
  selectedDate,
  pushPlannerHistory,
  setConfirmState,
  loadGardens,
  loadGardenData,
  setSelectedGarden,
  setTasks,
  setPlantings,
}: UsePlannerActionsParams) {
  const {
    isCellInBuffer,
    placementSpacingConflict,
    isCellBlockedForSelectedCrop,
  } = usePlacementSpacing({
    beds,
    placements,
    selectedGardenRecord,
    cropMap,
    selectedCropName,
  });

  const placementActions = usePlannerPlacementActions({
    fetchAuthed,
    pushNotice,
    setPlacements,
    placements,
    beds,
    selectedGarden,
    selectedCropName,
    selectedDate,
    placementSpacingConflict,
    pushPlannerHistory,
  });

  const nudgePlacementByDelta = useCallback(
    async (placementId: number, dx: number, dy: number) => {
      const placement = placements.find((item) => item.id === placementId);
      if (!placement) return;
      const bed = beds.find((item) => item.id === placement.bed_id);
      if (!bed) return;
      const cols = Math.max(1, Math.ceil(bed.width_in / 3));
      const rows = Math.max(1, Math.ceil(bed.height_in / 3));
      const nextX = Math.min(cols - 1, Math.max(0, placement.grid_x + dx));
      const nextY = Math.min(rows - 1, Math.max(0, placement.grid_y + dy));
      if (nextX === placement.grid_x && nextY === placement.grid_y) return;
      try {
        await placementActions.movePlacement(placementId, placement.bed_id, nextX, nextY);
      } catch (err: unknown) {
        pushNotice(getErrorMessage(err, "Unable to move placement."), "error");
      }
    },
    [placements, beds, placementActions, pushNotice],
  );

  const bedActions = usePlannerBedActions({
    fetchAuthed,
    pushNotice,
    setBeds,
    beds,
    yardWidthFt,
    yardLengthFt,
    pushPlannerHistory,
    setConfirmState,
    loadGardenData,
    loadGardens,
    setSelectedGarden,
    setTasks,
    setPlantings,
    setPlacements,
  });

  return {
    isCellInBuffer,
    placementSpacingConflict,
    isCellBlockedForSelectedCrop,
    addPlacement: placementActions.addPlacement,
    removePlacement: placementActions.removePlacement,
    movePlacement: placementActions.movePlacement,
    movePlacementsByDelta: placementActions.movePlacementsByDelta,
    removePlacementsBulk: placementActions.removePlacementsBulk,
    nudgePlacementByDelta,
    moveBedInYard: bedActions.moveBedInYard,
    nudgeBedByDelta: bedActions.nudgeBedByDelta,
    rotateBedInYard: bedActions.rotateBedInYard,
    renameBed: bedActions.renameBed,
    deleteBed: bedActions.deleteBed,
    deleteGarden: bedActions.deleteGarden,
  };
}
