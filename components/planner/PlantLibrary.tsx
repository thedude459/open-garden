"use client";

import { useEffect, useState } from "react";
import type { PlantSummary } from "@/lib/catalog/types";
import type { GardenZoneType } from "@/lib/garden/enums";
import { isPlantCategoryAllowedInZone } from "@/lib/planner/zone-plants";
import type { DragPlantPayload } from "./VisualCanvas";

interface PlantLibraryProps {
  zoneType: GardenZoneType;
  dropRootstockId?: string | null;
  selectedPlantId?: string | null;
  onPlantSelect?: (plant: DragPlantPayload) => void;
}

async function fetchIllustration(plantId: string): Promise<string> {
  const response = await fetch(`/api/planner/plants/${plantId}/illustration`);
  if (!response.ok) {
    return "/planner/categories/default.svg";
  }
  const body = await response.json();
  return body.illustration_url ?? body.url ?? "/planner/categories/default.svg";
}

export function PlantLibrary({ zoneType, dropRootstockId, selectedPlantId, onPlantSelect }: PlantLibraryProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlantSummary[]>([]);
  const [illustrations, setIllustrations] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      const response = await fetch(`/api/plants/search?q=${encodeURIComponent(query.trim())}`);
      if (!response.ok) {
        return;
      }
      const body = await response.json();
      const filtered = (body.results ?? []).filter((plant: PlantSummary) =>
        isPlantCategoryAllowedInZone(plant.plant_category, zoneType),
      );
      setResults(filtered);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query, zoneType]);

  useEffect(() => {
    async function loadIllustrations() {
      const entries = await Promise.all(
        results.map(async (plant) => {
          const url = await fetchIllustration(plant.id);
          return [plant.id, url] as const;
        }),
      );
      setIllustrations(Object.fromEntries(entries));
    }
    if (results.length > 0) {
      void loadIllustrations();
    }
  }, [results]);

  function buildPayload(plant: PlantSummary): DragPlantPayload {
    return {
      plant_id: plant.id,
      plant_provenance: "authoritative",
      common_name: plant.common_name,
      illustration_url: illustrations[plant.id] ?? "/planner/categories/default.svg",
      spacing_radius: 0.75,
      rootstock_id: dropRootstockId ?? null,
      plant_category: plant.plant_category,
    };
  }

  function handleDragStart(event: React.DragEvent<HTMLButtonElement>, plant: PlantSummary) {
    const payload = buildPayload(plant);
    event.dataTransfer.setData("application/garden-plant", JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "copy";
    onPlantSelect?.(payload);
  }

  function handlePlantClick(plant: PlantSummary) {
    onPlantSelect?.(buildPayload(plant));
  }

  return (
    <div className="planner-panel card stack" style={{ background: "var(--planner-panel-bg)" }}>
      <h2>Plant library</h2>
      <p className="field-label">Showing plants suited to {zoneType.replace(/_/g, " ")} plans.</p>
      <input
        type="search"
        placeholder="Search plants…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Search plant library"
      />
      <div className="planner-plant-grid">
        {results.map((plant) => (
          <button
            key={plant.id}
            type="button"
            className={`planner-plant-card${selectedPlantId === plant.id ? " selected" : ""}`}
            draggable
            onDragStart={(event) => handleDragStart(event, plant)}
            onClick={() => handlePlantClick(plant)}
          >
            <img
              src={illustrations[plant.id] ?? "/planner/categories/default.svg"}
              alt=""
              width={48}
              height={48}
            />
            <span>{plant.common_name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
