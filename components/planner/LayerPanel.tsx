"use client";

import { useMemo } from "react";
import type { GardenStructure, VisualPlantPlacement } from "@/lib/planner/types";
import { buildLayerItems, sendBackward, sendForward } from "@/lib/planner/layers";

interface LayerPanelProps {
  structures: GardenStructure[];
  placements: VisualPlantPlacement[];
  selectedId?: string | null;
  onLayerPatch: (layers: Array<{ id: string; kind: "structure" | "placement"; z_index?: number; locked?: boolean }>) => void;
}

function labelForItem(
  structures: GardenStructure[],
  placements: VisualPlantPlacement[],
  id: string,
  kind: "structure" | "placement",
): string {
  if (kind === "structure") {
    return structures.find((structure) => structure.id === id)?.structure_type.name ?? "Structure";
  }
  return placements.find((placement) => placement.id === id)?.plant.common_name ?? "Plant";
}

export function LayerPanel({
  structures,
  placements,
  selectedId,
  onLayerPatch,
}: LayerPanelProps) {
  const items = useMemo(
    () =>
      buildLayerItems(
        structures.map((structure) => ({
          id: structure.id,
          z_index: structure.z_index,
          locked: structure.locked,
        })),
        placements.map((placement) => ({
          id: placement.id,
          z_index: placement.z_index,
          locked: placement.locked,
        })),
      ),
    [structures, placements],
  );

  function applyReorder(nextItems: ReturnType<typeof buildLayerItems>) {
    onLayerPatch(
      nextItems.map((item) => ({
        id: item.id,
        kind: item.kind,
        z_index: item.z_index,
      })),
    );
  }

  return (
    <div className="planner-panel card stack" style={{ background: "var(--planner-panel-bg)" }}>
      <h2>Layers</h2>
      <ul className="layer-panel-list">
        {[...items].reverse().map((item) => (
          <li
            key={`${item.kind}-${item.id}`}
            className={`layer-panel-item${selectedId === item.id ? " selected" : ""}`}
          >
            <span>
              {labelForItem(structures, placements, item.id, item.kind)}
              {item.locked ? " 🔒" : ""}
            </span>
            <div className="row">
              <button
                type="button"
                className="btn secondary"
                aria-label="Send backward"
                onClick={() => applyReorder(sendBackward(items, item.id))}
              >
                ↓
              </button>
              <button
                type="button"
                className="btn secondary"
                aria-label="Send forward"
                onClick={() => applyReorder(sendForward(items, item.id))}
              >
                ↑
              </button>
              <button
                type="button"
                className="btn secondary"
                aria-label={item.locked ? "Unlock" : "Lock"}
                onClick={() =>
                  onLayerPatch([
                    { id: item.id, kind: item.kind, locked: !item.locked },
                  ])
                }
              >
                {item.locked ? "Unlock" : "Lock"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
