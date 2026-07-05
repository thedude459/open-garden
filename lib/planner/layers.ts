import type { CanvasLayerItem, CanvasLayerKind } from "./types";

export function sortByZIndex<T extends { z_index: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.z_index - b.z_index);
}

export function buildLayerItems(
  structures: Array<{ id: string; z_index: number; locked: boolean }>,
  placements: Array<{ id: string; z_index: number; locked: boolean }>,
): CanvasLayerItem[] {
  return sortByZIndex([
    ...structures.map((structure) => ({
      id: structure.id,
      kind: "structure" as const,
      z_index: structure.z_index,
      locked: structure.locked,
    })),
    ...placements.map((placement) => ({
      id: placement.id,
      kind: "placement" as const,
      z_index: placement.z_index,
      locked: placement.locked,
    })),
  ]);
}

export interface LayerPatchItem {
  id: string;
  kind: CanvasLayerKind;
  z_index?: number;
  locked?: boolean;
}

export function applyLayerPatch(
  items: CanvasLayerItem[],
  patch: LayerPatchItem[],
): CanvasLayerItem[] {
  const byId = new Map(items.map((item) => [item.id, { ...item }]));
  for (const update of patch) {
    const existing = byId.get(update.id);
    if (!existing || existing.kind !== update.kind) {
      continue;
    }
    if (update.z_index != null) {
      existing.z_index = update.z_index;
    }
    if (update.locked != null) {
      existing.locked = update.locked;
    }
  }
  return sortByZIndex([...byId.values()]);
}

export function sendBackward(items: CanvasLayerItem[], id: string): CanvasLayerItem[] {
  const sorted = sortByZIndex(items);
  const index = sorted.findIndex((item) => item.id === id);
  if (index <= 0) {
    return sorted;
  }
  const swapped = [...sorted];
  const current = swapped[index]!;
  const below = swapped[index - 1]!;
  const tmpZ = current.z_index;
  current.z_index = below.z_index;
  below.z_index = tmpZ;
  return sortByZIndex(swapped);
}

export function sendForward(items: CanvasLayerItem[], id: string): CanvasLayerItem[] {
  const sorted = sortByZIndex(items);
  const index = sorted.findIndex((item) => item.id === id);
  if (index < 0 || index >= sorted.length - 1) {
    return sorted;
  }
  const swapped = [...sorted];
  const current = swapped[index]!;
  const above = swapped[index + 1]!;
  const tmpZ = current.z_index;
  current.z_index = above.z_index;
  above.z_index = tmpZ;
  return sortByZIndex(swapped);
}
