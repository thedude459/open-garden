import { useCallback } from "react";
import { Bed, Placement, PlantingLocation, PlantingMethod } from "../../types";
import { colorForCrop } from "../utils/cropUtils";
import { FetchAuthed, PlannerHistoryEntry } from "../types";

type NoticeKind = "info" | "success" | "error";

interface UsePlannerPlacementActionsParams {
  fetchAuthed: FetchAuthed;
  pushNotice: (message: string, kind: NoticeKind) => void;
  setPlacements: React.Dispatch<React.SetStateAction<Placement[]>>;
  setPlantings?: React.Dispatch<React.SetStateAction<Placement[]>>;
  placements: Placement[];
  beds: Bed[];
  selectedGarden: number | null;
  selectedCropName: string;
  selectedDate: string;
  plantingMovedOn?: string | null;
  plantingMethod?: PlantingMethod;
  plantingLocation?: PlantingLocation;
  placementSpacingConflict: (
    bedId: number,
    x: number,
    y: number,
    cropName: string,
    excludePlacementId?: number,
  ) => string | null;
  pushPlannerHistory: (entry: PlannerHistoryEntry) => void;
  refreshTasks: () => Promise<void>;
}

export function usePlannerPlacementActions({
  fetchAuthed,
  pushNotice,
  setPlacements,
  setPlantings,
  placements,
  beds,
  selectedGarden,
  selectedCropName,
  selectedDate,
  plantingMovedOn,
  plantingMethod = "direct_seed",
  plantingLocation = "in_bed",
  placementSpacingConflict,
  pushPlannerHistory,
  refreshTasks,
}: UsePlannerPlacementActionsParams) {
  const syncBoth = useCallback(
    (updater: (prev: Placement[]) => Placement[]) => {
      setPlacements(updater);
      if (setPlantings) {
        setPlantings(updater);
      }
    },
    [setPlacements, setPlantings],
  );

  const apiCreatePlacement = useCallback(
    async (payload: {
      garden_id: number;
      bed_id: number;
      crop_name: string;
      grid_x: number;
      grid_y: number;
      planted_on: string;
      color: string;
      method?: PlantingMethod;
      location?: PlantingLocation;
      moved_on?: string | null;
    }) => {
      const location = payload.location ?? "in_bed";
      const body: Record<string, unknown> = {
        ...payload,
        method: payload.method ?? "direct_seed",
        location,
      };
      // Only forward moved_on for indoor plantings — the backend ignores
      // it for in_bed plantings, but stripping it keeps the payload clean.
      if (location === "indoor" && payload.moved_on) {
        body.moved_on = payload.moved_on;
      } else {
        delete body.moved_on;
      }
      const created: Placement = await fetchAuthed("/plantings", {
        method: "POST",
        body: JSON.stringify(body),
      });
      syncBoth((prev) => [...prev, created]);
      return created;
    },
    [fetchAuthed, syncBoth],
  );

  const apiUpdatePlantingDates = useCallback(
    async (
      placementId: number,
      changes: { planted_on?: string; moved_on?: string | null },
    ) => {
      const body: Record<string, unknown> = {};
      if (changes.planted_on) body.planted_on = changes.planted_on;
      if (changes.moved_on === null) {
        body.clear_moved_on = true;
      } else if (changes.moved_on) {
        body.moved_on = changes.moved_on;
      }
      const updated: Placement = await fetchAuthed(
        `/plantings/${placementId}/dates`,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        },
      );
      syncBoth((prev) =>
        prev.map((item) => (item.id === placementId ? updated : item)),
      );
      return updated;
    },
    [fetchAuthed, syncBoth],
  );

  const apiDeletePlacement = useCallback(
    async (placementId: number) => {
      await fetchAuthed(`/plantings/${placementId}`, { method: "DELETE" });
      syncBoth((prev) => prev.filter((item) => item.id !== placementId));
    },
    [fetchAuthed, syncBoth],
  );

  const apiMovePlacement = useCallback(
    async (placementId: number, bedId: number, x: number, y: number) => {
      const updated: Placement = await fetchAuthed(`/plantings/${placementId}/move`, {
        method: "PATCH",
        body: JSON.stringify({ bed_id: bedId, grid_x: x, grid_y: y }),
      });
      syncBoth((prev) => prev.map((item) => (item.id === placementId ? updated : item)));
      return updated;
    },
    [fetchAuthed, syncBoth],
  );

  const apiRelocatePlanting = useCallback(
    async (placementId: number, location: PlantingLocation, movedOn?: string) => {
      const body: { location: PlantingLocation; moved_on?: string } = { location };
      if (movedOn) body.moved_on = movedOn;
      const updated: Placement = await fetchAuthed(`/plantings/${placementId}/relocate`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      syncBoth((prev) => prev.map((item) => (item.id === placementId ? updated : item)));
      return updated;
    },
    [fetchAuthed, syncBoth],
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
        method: plantingMethod,
        location: plantingLocation,
        moved_on: plantingMovedOn ?? undefined,
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
            method: plantingMethod,
            location: plantingLocation,
            moved_on: plantingMovedOn ?? undefined,
          });
          trackedPlacementId = recreated.id;
        },
      });
      pushNotice(
        plantingLocation === "indoor"
          ? "Indoor start added to bed sheet."
          : "Placement added to bed sheet.",
        "success",
      );
    },
    [
      selectedGarden,
      selectedCropName,
      selectedDate,
      plantingMovedOn,
      plantingMethod,
      plantingLocation,
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
            method: placement.method,
            location: placement.location,
          });
          trackedPlacementId = recreated.id;
        },
        redo: async () => {
          await apiDeletePlacement(trackedPlacementId);
        },
      });
      pushNotice("Placement removed.", "info");
      void refreshTasks();
    },
    [
      placements,
      selectedGarden,
      apiDeletePlacement,
      apiCreatePlacement,
      pushPlannerHistory,
      pushNotice,
      refreshTasks,
    ],
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
                method: p.method,
                location: p.location,
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
      void refreshTasks();
    },
    [
      selectedGarden,
      placements,
      apiDeletePlacement,
      apiCreatePlacement,
      pushPlannerHistory,
      pushNotice,
      refreshTasks,
    ],
  );

  const relocatePlanting = useCallback(
    async (placementId: number, location: PlantingLocation) => {
      const existing = placements.find((item) => item.id === placementId);
      if (!existing) return;
      const previousLocation = existing.location;
      const previousMovedOn = existing.moved_on;
      await apiRelocatePlanting(placementId, location);
      pushPlannerHistory({
        label:
          location === "in_bed"
            ? `Move ${existing.crop_name} to bed`
            : `Move ${existing.crop_name} indoors`,
        undo: async () => {
          await fetchAuthed(`/plantings/${placementId}/relocate`, {
            method: "PATCH",
            body: JSON.stringify({
              location: previousLocation,
              moved_on: previousMovedOn ?? undefined,
            }),
          }).then((updated) => {
            syncBoth((prev) =>
              prev.map((item) => (item.id === placementId ? (updated as Placement) : item)),
            );
          });
        },
        redo: async () => {
          await apiRelocatePlanting(placementId, location);
        },
      });
      pushNotice(
        location === "in_bed" ? "Moved into bed." : "Moved indoors.",
        "success",
      );
      await refreshTasks();
    },
    [placements, apiRelocatePlanting, fetchAuthed, syncBoth, pushPlannerHistory, pushNotice, refreshTasks],
  );

  const updatePlantingDates = useCallback(
    async (
      placementId: number,
      changes: { planted_on?: string; moved_on?: string | null },
    ) => {
      const existing = placements.find((item) => item.id === placementId);
      if (!existing) return;
      const previousPlantedOn = existing.planted_on;
      const previousMovedOn = existing.moved_on;
      try {
        await apiUpdatePlantingDates(placementId, changes);
      } catch (err) {
        pushNotice("Could not update planting dates.", "error");
        throw err;
      }
      pushPlannerHistory({
        label: `Update ${existing.crop_name} dates`,
        undo: async () => {
          await apiUpdatePlantingDates(placementId, {
            planted_on: previousPlantedOn,
            moved_on: previousMovedOn,
          });
        },
        redo: async () => {
          await apiUpdatePlantingDates(placementId, changes);
        },
      });
      pushNotice("Planting dates updated.", "success");
      await refreshTasks();
    },
    [placements, apiUpdatePlantingDates, pushPlannerHistory, pushNotice, refreshTasks],
  );

  return {
    addPlacement,
    removePlacement,
    movePlacement,
    movePlacementsByDelta,
    removePlacementsBulk,
    relocatePlanting,
    updatePlantingDates,
  };
}
