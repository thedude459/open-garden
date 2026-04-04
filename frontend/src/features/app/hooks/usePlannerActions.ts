import { useCallback } from "react";
import { colorForCrop } from "../cropUtils";
import { ConfirmState } from "../types";
import { Bed, CropTemplate, Garden, Placement } from "../../types";
import { usePlacementSpacing } from "./usePlacementSpacing";

type NoticeKind = "info" | "success" | "error";

interface UsePlannerActionsParams {
  fetchAuthed: (url: string, options?: RequestInit) => Promise<any>;
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
  pushPlannerHistory: (entry: {
    label: string;
    undo: () => Promise<void>;
    redo: () => Promise<void>;
  }) => void;
  setConfirmState: React.Dispatch<React.SetStateAction<ConfirmState | null>>;
  loadGardens: () => Promise<void>;
  loadGardenData: () => Promise<void>;
  setSelectedGarden: (id: number | null) => void;
  setTasks: React.Dispatch<React.SetStateAction<any[]>>;
  setPlantings: React.Dispatch<React.SetStateAction<any[]>>;
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
  // Use extracted spacing logic
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

  // ── Raw placement API ────────────────────────────────────────────────────

  const apiCreatePlacement = useCallback(
    async (payload: {
      garden_id: number;
      bed_id: number;
      crop_name: string;
      grid_x: number;
      grid_y: number;
      planted_on: string;
      color: string;
    }) => {
      const created: Placement = await fetchAuthed("/placements", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setPlacements((prev) => [...prev, created]);
      return created;
    },
    [fetchAuthed, setPlacements],
  );

  const apiDeletePlacement = useCallback(
    async (placementId: number) => {
      await fetchAuthed(`/placements/${placementId}`, { method: "DELETE" });
      setPlacements((prev) => prev.filter((item) => item.id !== placementId));
    },
    [fetchAuthed, setPlacements],
  );

  const apiMovePlacement = useCallback(
    async (placementId: number, bedId: number, x: number, y: number) => {
      const updated: Placement = await fetchAuthed(`/placements/${placementId}/move`, {
        method: "PATCH",
        body: JSON.stringify({ bed_id: bedId, grid_x: x, grid_y: y }),
      });
      setPlacements((prev) => prev.map((item) => (item.id === placementId ? updated : item)));
      return updated;
    },
    [fetchAuthed, setPlacements],
  );

  // ── Placement actions ────────────────────────────────────────────────────

  const addPlacement = useCallback(
    async (bedId: number, x: number, y: number) => {
      if (!selectedGarden || !selectedCropName.trim()) return;
      const spacingIssue = placementSpacingConflict(bedId, x, y, selectedCropName);
      if (spacingIssue) {
        pushNotice(spacingIssue, "error");
        return;
      }
      const created = await apiCreatePlacement({
        garden_id: selectedGarden,
        bed_id: bedId,
        crop_name: selectedCropName.trim(),
        grid_x: x,
        grid_y: y,
        planted_on: selectedDate,
        color: colorForCrop(selectedCropName),
      });
      let trackedPlacementId = created.id;
      pushPlannerHistory({
        label: `Add ${created.crop_name}`,
        undo: async () => {
          await apiDeletePlacement(trackedPlacementId);
        },
        redo: async () => {
          const recreated = await apiCreatePlacement({
            garden_id: selectedGarden,
            bed_id: bedId,
            crop_name: selectedCropName.trim(),
            grid_x: x,
            grid_y: y,
            planted_on: selectedDate,
            color: colorForCrop(selectedCropName),
          });
          trackedPlacementId = recreated.id;
        },
      });
      pushNotice("Placement added to bed sheet.", "success");
    },
    [
      selectedGarden,
      selectedCropName,
      selectedDate,
      placementSpacingConflict,
      apiCreatePlacement,
      apiDeletePlacement,
      pushPlannerHistory,
      pushNotice,
    ],
  );

  const removePlacement = useCallback(
    async (placementId: number) => {
      const placement = placements.find((item) => item.id === placementId);
      if (!placement || !selectedGarden) return;
      await apiDeletePlacement(placementId);
      let trackedPlacementId = placement.id;
      pushPlannerHistory({
        label: `Remove ${placement.crop_name}`,
        undo: async () => {
          const recreated = await apiCreatePlacement({
            garden_id: selectedGarden,
            bed_id: placement.bed_id,
            crop_name: placement.crop_name,
            grid_x: placement.grid_x,
            grid_y: placement.grid_y,
            planted_on: placement.planted_on,
            color: placement.color,
          });
          trackedPlacementId = recreated.id;
        },
        redo: async () => {
          await apiDeletePlacement(trackedPlacementId);
        },
      });
      pushNotice("Placement removed.", "info");
    },
    [placements, selectedGarden, apiDeletePlacement, apiCreatePlacement, pushPlannerHistory, pushNotice],
  );

  const movePlacement = useCallback(
    async (placementId: number, bedId: number, x: number, y: number) => {
      const moving = placements.find((p) => p.id === placementId);
      if (!moving) return;
      const spacingIssue = placementSpacingConflict(bedId, x, y, moving.crop_name, placementId);
      if (spacingIssue) {
        pushNotice(spacingIssue, "error");
        return;
      }
      const fromBedId = moving.bed_id;
      const fromX = moving.grid_x;
      const fromY = moving.grid_y;
      const updated = await apiMovePlacement(placementId, bedId, x, y);
      pushPlannerHistory({
        label: `Move ${moving.crop_name}`,
        undo: () => apiMovePlacement(placementId, fromBedId, fromX, fromY).then(() => undefined),
        redo: () =>
          apiMovePlacement(placementId, updated.bed_id, updated.grid_x, updated.grid_y).then(
            () => undefined,
          ),
      });
      pushNotice("Placement moved.", "success");
    },
    [placements, placementSpacingConflict, apiMovePlacement, pushPlannerHistory, pushNotice],
  );

  const movePlacementsByDelta = useCallback(
    async (placementIds: number[], dx: number, dy: number) => {
      if (placementIds.length === 0) return;
      const movingPlacements = placements.filter((p) => placementIds.includes(p.id));
      if (movingPlacements.length !== placementIds.length) return;
      const bedId = movingPlacements[0].bed_id;
      if (!movingPlacements.every((p) => p.bed_id === bedId)) {
        pushNotice(
          "Bulk move currently supports selections in one bed at a time.",
          "error",
        );
        return;
      }
      const bed = beds.find((item) => item.id === bedId);
      if (!bed) return;
      const cols = Math.max(1, Math.ceil(bed.width_in / 3));
      const rows = Math.max(1, Math.ceil(bed.height_in / 3));
      const fromState = movingPlacements.map((p) => ({
        placementId: p.id,
        bedId: p.bed_id,
        x: p.grid_x,
        y: p.grid_y,
        cropName: p.crop_name,
      }));
      const target = fromState.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
      if (target.some((p) => p.x < 0 || p.y < 0 || p.x >= cols || p.y >= rows)) {
        pushNotice("Bulk move would push one or more crops outside the bed.", "error");
        return;
      }
      for (const candidate of target) {
        const spacingIssue = placementSpacingConflict(
          candidate.bedId,
          candidate.x,
          candidate.y,
          candidate.cropName,
          candidate.placementId,
        );
        if (spacingIssue) {
          pushNotice(spacingIssue, "error");
          return;
        }
      }
      for (const candidate of target) {
        await apiMovePlacement(candidate.placementId, candidate.bedId, candidate.x, candidate.y);
      }
      pushPlannerHistory({
        label: `Move ${target.length} placement${target.length === 1 ? "" : "s"}`,
        undo: async () => {
          for (const p of fromState) {
            await apiMovePlacement(p.placementId, p.bedId, p.x, p.y);
          }
        },
        redo: async () => {
          for (const p of target) {
            await apiMovePlacement(p.placementId, p.bedId, p.x, p.y);
          }
        },
      });
      pushNotice(`Moved ${target.length} placement${target.length === 1 ? "" : "s"}.`, "success");
    },
    [placements, beds, placementSpacingConflict, apiMovePlacement, pushPlannerHistory, pushNotice],
  );

  const removePlacementsBulk = useCallback(
    async (placementIds: number[]) => {
      if (!selectedGarden || placementIds.length === 0) return;
      const targets = placements.filter((p) => placementIds.includes(p.id));
      if (targets.length === 0) return;
      for (const placement of targets) {
        await apiDeletePlacement(placement.id);
      }
      let tracked = targets.map((p) => ({ ...p }));
      pushPlannerHistory({
        label: `Remove ${targets.length} placement${targets.length === 1 ? "" : "s"}`,
        undo: async () => {
          const recreated: Placement[] = [];
          for (const p of tracked) {
            recreated.push(
              await apiCreatePlacement({
                garden_id: selectedGarden,
                bed_id: p.bed_id,
                crop_name: p.crop_name,
                grid_x: p.grid_x,
                grid_y: p.grid_y,
                planted_on: p.planted_on,
                color: p.color,
              }),
            );
          }
          tracked = recreated;
        },
        redo: async () => {
          for (const p of tracked) {
            await apiDeletePlacement(p.id);
          }
        },
      });
      pushNotice(
        `Removed ${targets.length} placement${targets.length === 1 ? "" : "s"}.`,
        "info",
      );
    },
    [
      selectedGarden,
      placements,
      apiDeletePlacement,
      apiCreatePlacement,
      pushPlannerHistory,
      pushNotice,
    ],
  );

  const nudgePlacementByDelta = useCallback(
    async (placementId: number, dx: number, dy: number) => {
      const placement = placements.find((item) => item.id === placementId);
      if (!placement) return;
      const bed = beds.find((item) => item.id === placement.bed_id);
      if (!bed) return;
      const cols = Math.max(1, Math.ceil(bed.width_in / 12));
      const rows = Math.max(1, Math.ceil(bed.height_in / 12));
      const nextX = Math.min(cols - 1, Math.max(0, placement.grid_x + dx));
      const nextY = Math.min(rows - 1, Math.max(0, placement.grid_y + dy));
      if (nextX === placement.grid_x && nextY === placement.grid_y) return;
      try {
        await movePlacement(placementId, placement.bed_id, nextX, nextY);
      } catch (err: any) {
        pushNotice(err?.message || "Unable to move placement.", "error");
      }
    },
    [placements, beds, movePlacement, pushNotice],
  );

  // ── Bed actions ──────────────────────────────────────────────────────────

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
      } catch (err: any) {
        pushNotice(err?.message || "Unable to move bed.", "error");
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
        let rotatedFromX = bed.grid_x;
        let rotatedFromY = bed.grid_y;
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
      } catch (err: any) {
        pushNotice(err?.message || "Unable to rotate bed.", "error");
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
    isCellInBuffer,
    placementSpacingConflict,
    isCellBlockedForSelectedCrop,
    addPlacement,
    removePlacement,
    movePlacement,
    movePlacementsByDelta,
    removePlacementsBulk,
    nudgePlacementByDelta,
    moveBedInYard,
    nudgeBedByDelta,
    rotateBedInYard,
    deleteBed,
    deleteGarden,
  };
}
