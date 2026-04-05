import { useCallback } from "react";
import { Bed, Placement, Planting, Task } from "../../types";
import { ConfirmState, FetchAuthed, PlannerHistoryEntry } from "../types";
import { getErrorMessage } from "../utils/appUtils";

type NoticeKind = "info" | "success" | "error";

interface UsePlannerBedActionsParams {
  fetchAuthed: FetchAuthed;
  pushNotice: (message: string, kind: NoticeKind) => void;
  setBeds: React.Dispatch<React.SetStateAction<Bed[]>>;
  beds: Bed[];
  yardWidthFt: number;
  yardLengthFt: number;
  pushPlannerHistory: (entry: PlannerHistoryEntry) => void;
  setConfirmState: React.Dispatch<React.SetStateAction<ConfirmState | null>>;
  loadGardenData: () => Promise<void>;
  loadGardens: () => Promise<void>;
  setSelectedGarden: (id: number | null) => void;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  setPlantings: React.Dispatch<React.SetStateAction<Planting[]>>;
  setPlacements: React.Dispatch<React.SetStateAction<Placement[]>>;
}

export function usePlannerBedActions({
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
}: UsePlannerBedActionsParams) {
  const apiMoveBedInYard = useCallback(
    async (bedId: number, nextX: number, nextY: number) => {
      const updated: Bed = await fetchAuthed(`/beds/${bedId}/position`, {
        method: "PATCH",
        body: JSON.stringify({ grid_x: nextX, grid_y: nextY }),
      });
      setBeds((prev) => prev.map((item) => (item.id === bedId ? updated : item)));
      return updated;
    },
    [fetchAuthed, setBeds],
  );

  const apiRotateBedInYard = useCallback(
    async (bedId: number) => {
      const rotated: Bed = await fetchAuthed(`/beds/${bedId}/rotate`, { method: "PATCH" });
      setBeds((prev) => prev.map((item) => (item.id === bedId ? rotated : item)));
      return rotated;
    },
    [fetchAuthed, setBeds],
  );

  const moveBedInYard = useCallback(
    async (
      bedId: number,
      nextX: number,
      nextY: number,
      options?: { recordHistory?: boolean },
    ) => {
      const bed = beds.find((item) => item.id === bedId);
      if (!bed) return;
      const updated = await apiMoveBedInYard(bedId, nextX, nextY);
      if (
        options?.recordHistory !== false &&
        (bed.grid_x !== updated.grid_x || bed.grid_y !== updated.grid_y)
      ) {
        pushPlannerHistory({
          label: `Move ${bed.name}`,
          undo: () => apiMoveBedInYard(bedId, bed.grid_x, bed.grid_y).then(() => undefined),
          redo: () =>
            apiMoveBedInYard(bedId, updated.grid_x, updated.grid_y).then(() => undefined),
        });
      }
    },
    [beds, apiMoveBedInYard, pushPlannerHistory],
  );

  const nudgeBedByDelta = useCallback(
    async (bedId: number, dx: number, dy: number) => {
      const bed = beds.find((item) => item.id === bedId);
      if (!bed) return;
      const bedWidthFt = Math.max(1, Math.ceil(bed.width_in / 12));
      const bedLengthFt = Math.max(1, Math.ceil(bed.height_in / 12));
      const maxX = Math.max(0, yardWidthFt - bedWidthFt);
      const maxY = Math.max(0, yardLengthFt - bedLengthFt);
      const nextX = Math.min(maxX, Math.max(0, bed.grid_x + dx));
      const nextY = Math.min(maxY, Math.max(0, bed.grid_y + dy));
      if (nextX === bed.grid_x && nextY === bed.grid_y) return;
      try {
        await moveBedInYard(bedId, nextX, nextY);
        pushNotice(`Moved ${bed.name} to (${nextX + 1}, ${nextY + 1}).`, "info");
      } catch (err: unknown) {
        pushNotice(getErrorMessage(err, "Unable to move bed."), "error");
      }
    },
    [beds, yardWidthFt, yardLengthFt, moveBedInYard, pushNotice],
  );

  const rotateBedInYard = useCallback(
    async (bedId: number, autoFit = false) => {
      const bed = beds.find((item) => item.id === bedId);
      if (!bed) return;
      try {
        const rotatedWidthFt = Math.max(1, Math.ceil(bed.height_in / 12));
        const rotatedLengthFt = Math.max(1, Math.ceil(bed.width_in / 12));
        const exceedsBounds =
          bed.grid_x + rotatedWidthFt > yardWidthFt ||
          bed.grid_y + rotatedLengthFt > yardLengthFt;
        const rotatedFromX = bed.grid_x;
        const rotatedFromY = bed.grid_y;
        let rotatedToX = bed.grid_x;
        let rotatedToY = bed.grid_y;
        if (exceedsBounds && autoFit) {
          rotatedToX = Math.min(
            Math.max(0, bed.grid_x),
            Math.max(0, yardWidthFt - rotatedWidthFt),
          );
          rotatedToY = Math.min(
            Math.max(0, bed.grid_y),
            Math.max(0, yardLengthFt - rotatedLengthFt),
          );
          await apiMoveBedInYard(bed.id, rotatedToX, rotatedToY);
        } else if (exceedsBounds) {
          throw new Error(
            "Bed cannot rotate at its current position. Use Auto-fit rotate or move the bed first.",
          );
        }
        await apiRotateBedInYard(bedId);
        pushPlannerHistory({
          label: `Rotate ${bed.name}`,
          undo: async () => {
            await apiRotateBedInYard(bedId);
            if (rotatedFromX !== rotatedToX || rotatedFromY !== rotatedToY) {
              await apiMoveBedInYard(bedId, rotatedFromX, rotatedFromY);
            }
          },
          redo: async () => {
            if (rotatedFromX !== rotatedToX || rotatedFromY !== rotatedToY) {
              await apiMoveBedInYard(bedId, rotatedToX, rotatedToY);
            }
            await apiRotateBedInYard(bedId);
          },
        });
        pushNotice(`Rotated ${bed.name}.`, "success");
      } catch (err: unknown) {
        pushNotice(getErrorMessage(err, "Unable to rotate bed."), "error");
        throw err;
      }
    },
    [
      beds,
      yardWidthFt,
      yardLengthFt,
      apiMoveBedInYard,
      apiRotateBedInYard,
      pushPlannerHistory,
      pushNotice,
    ],
  );

  const deleteBed = useCallback(
    async (bedId: number) => {
      setConfirmState({
        title: "Delete bed?",
        message: "This removes the bed and all crop placements in it.",
        confirmLabel: "Delete bed",
        onConfirm: async () => {
          await fetchAuthed(`/beds/${bedId}`, { method: "DELETE" });
          await loadGardenData();
          pushNotice("Bed deleted.", "info");
        },
      });
    },
    [fetchAuthed, loadGardenData, pushNotice, setConfirmState],
  );

  const deleteGarden = useCallback(
    async (gardenId: number) => {
      setConfirmState({
        title: "Delete garden?",
        message: "This permanently removes this garden and all related data.",
        confirmLabel: "Delete garden",
        onConfirm: async () => {
          await fetchAuthed(`/gardens/${gardenId}`, { method: "DELETE" });
          setSelectedGarden(null);
          setBeds([]);
          setTasks([]);
          setPlantings([]);
          setPlacements([]);
          await loadGardens();
          pushNotice("Garden deleted.", "info");
        },
      });
    },
    [
      fetchAuthed,
      setSelectedGarden,
      setBeds,
      setTasks,
      setPlantings,
      setPlacements,
      loadGardens,
      pushNotice,
      setConfirmState,
    ],
  );

  return {
    moveBedInYard,
    nudgeBedByDelta,
    rotateBedInYard,
    deleteBed,
    deleteGarden,
  };
}
