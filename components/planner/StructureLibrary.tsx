"use client";

import { useEffect, useMemo, useState } from "react";
import type { GardenZoneType } from "@/lib/garden/enums";
import type { StructureTypeSummary } from "@/lib/planner/structure-types";

export interface DragStructurePayload {
  structure_type_slug: string;
  name: string;
  illustration_url: string;
  default_length: number;
  default_width: number;
}

interface StructureLibraryProps {
  zoneType: GardenZoneType;
  onStructureSelect?: (payload: DragStructurePayload) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  bed_frame: "Bed frames",
  container: "Containers",
  protection: "Protection",
  vertical: "Vertical",
  access: "Access",
  amenity: "Amenities",
  other: "Other",
};

export function StructureLibrary({ zoneType, onStructureSelect }: StructureLibraryProps) {
  const [items, setItems] = useState<StructureTypeSummary[]>([]);

  useEffect(() => {
    async function loadStructures() {
      const response = await fetch(
        `/api/planner/structures?zone_type=${encodeURIComponent(zoneType)}`,
      );
      if (!response.ok) {
        return;
      }
      const body = await response.json();
      setItems(body.structure_types ?? []);
    }
    void loadStructures();
  }, [zoneType]);

  const grouped = useMemo(() => {
    const map = new Map<string, StructureTypeSummary[]>();
    for (const item of items) {
      const group = map.get(item.category) ?? [];
      group.push(item);
      map.set(item.category, group);
    }
    return [...map.entries()];
  }, [items]);

  function handleDragStart(event: React.DragEvent<HTMLButtonElement>, item: StructureTypeSummary) {
    const payload: DragStructurePayload = {
      structure_type_slug: item.slug,
      name: item.name,
      illustration_url: item.illustration_url,
      default_length: item.default_length,
      default_width: item.default_width,
    };
    event.dataTransfer.setData("application/garden-structure", JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "copy";
    onStructureSelect?.(payload);
  }

  return (
    <div className="planner-panel card stack" style={{ background: "var(--planner-panel-bg)" }}>
      <h2>Structure library</h2>
      <p className="field-label">Drag structures onto the canvas for your {zoneType.replace(/_/g, " ")} plan.</p>
      {grouped.map(([category, structures]) => (
        <div key={category} className="stack">
          <h3 className="field-label">{CATEGORY_LABELS[category] ?? category}</h3>
          <div className="planner-plant-grid">
            {structures.map((structure) => (
              <button
                key={structure.slug}
                type="button"
                className="planner-plant-card"
                draggable
                onDragStart={(event) => handleDragStart(event, structure)}
              >
                <img src={structure.illustration_url} alt="" width={48} height={48} />
                <span>{structure.name}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
