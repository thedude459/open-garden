import { useCallback } from "react";
import { Bed, CropTemplate, Placement } from "../../types";
import { colorForCrop } from "../utils/cropUtils";
import { FetchAuthed, PlannerHistoryEntry } from "../types";

type NoticeKind = "info" | "success" | "error";

interface UsePlannerPlacementActionsParams {
  fetchAuthed: FetchAuthed;
  pushNotice: (message: string, kind: NoticeKind) => void;
  setPlacements: React.Dispatch<React.SetStateAction<Placement[]>>;
  placements: Placement[];
  beds: Bed[];
  selectedGarden: number | null;
  selectedCropName: string;
  selectedDate: string;
  placementSpacingConflict: (
    bedId: number,
    x: number,
    y: number,
    cropName: string,
    excludePlacementId?: number,
  ) => string | null;
  pushPlannerHistory: (entry: PlannerHistoryEntry) => void;
}

export function usePlannerPlacementActions({
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
}: UsePlannerPlacementActionsParams) {
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

  return {
    addPlacement,
    removePlacement,
    movePlacement,
    movePlacementsByDelta,
    removePlacementsBulk,
  };
}
