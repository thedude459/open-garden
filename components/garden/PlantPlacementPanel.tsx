"use client";

import { FormEvent, useEffect, useState } from "react";
import type { PlantDetail } from "@/lib/catalog/types";
import type { PlantSummary } from "@/lib/catalog/types";
import {
  resolvePlantingMethods,
  type PlantingMethod,
} from "@/lib/garden/planting-methods";
import type {
  GardenDetail,
  PlantPlacement,
  ValidationViolation,
  ValidationWarning,
} from "@/lib/garden/types";

interface SelectedPlant {
  id: string;
  common_name: string;
  provenance: "authoritative" | "provisional";
}

interface PlantPlacementPanelProps {
  garden: GardenDetail;
  selectedBedId: string;
  onBedChange: (bedId: string) => void;
  position: { x: number; y: number } | null;
  violations: ValidationViolation[];
  warnings: ValidationWarning[];
  onViolationsChange: (violations: ValidationViolation[]) => void;
  onWarningsChange: (warnings: ValidationWarning[]) => void;
  onGardenUpdate: (garden: GardenDetail) => void;
  placing: boolean;
  onPlacingChange: (placing: boolean) => void;
}

export function PlantPlacementPanel({
  garden,
  selectedBedId,
  onBedChange,
  position,
  violations,
  warnings,
  onViolationsChange,
  onWarningsChange,
  onGardenUpdate,
  placing,
  onPlacingChange,
}: PlantPlacementPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlantSummary[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<SelectedPlant | null>(null);
  const [plantDetail, setPlantDetail] = useState<PlantDetail | null>(null);
  const [plantingMethod, setPlantingMethod] = useState<PlantingMethod>("direct_seed");
  const [plantedOn, setPlantedOn] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [saveWarnings, setSaveWarnings] = useState<ValidationWarning[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const beds = garden.areas.filter((area) => area.area_type === "bed");
  const methodSupport = resolvePlantingMethods(plantDetail);
  const isDirectSeed = plantingMethod === "direct_seed";

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
      setResults(body.results ?? []);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    async function loadDetail() {
      if (!selectedPlant || selectedPlant.provenance !== "authoritative") {
        setPlantDetail(null);
        return;
      }

      const response = await fetch(`/api/plants/${selectedPlant.id}`);
      if (!response.ok) {
        setPlantDetail(null);
        return;
      }
      setPlantDetail((await response.json()) as PlantDetail);
    }

    void loadDetail();
  }, [selectedPlant]);

  useEffect(() => {
    const support = resolvePlantingMethods(plantDetail);
    if (!support.direct_seed && support.indoor_start) {
      setPlantingMethod("indoor_start");
    } else if (support.direct_seed && !support.indoor_start) {
      setPlantingMethod("direct_seed");
    }
  }, [plantDetail]);

  useEffect(() => {
    async function preview() {
      if (!selectedPlant || !selectedBedId || !position || !isDirectSeed) {
        onViolationsChange([]);
        onWarningsChange([]);
        return;
      }

      const response = await fetch(`/api/gardens/${garden.id}/validate-placement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bed_area_id: selectedBedId,
          plant_id: selectedPlant.id,
          plant_provenance: selectedPlant.provenance,
          position_x: position.x,
          position_y: position.y,
          planted_on: plantedOn,
          planting_context: "direct_seed",
        }),
      });

      if (!response.ok) {
        onViolationsChange([]);
        onWarningsChange([]);
        return;
      }

      const body = await response.json();
      onViolationsChange(body.violations ?? []);
      onWarningsChange(body.warnings ?? []);
    }

    void preview();
  }, [
    garden.id,
    selectedPlant,
    selectedBedId,
    position,
    plantedOn,
    isDirectSeed,
    onViolationsChange,
    onWarningsChange,
  ]);

  async function handlePlace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPlant || !selectedBedId) {
      setError("Select a bed and plant first.");
      return;
    }

    if (isDirectSeed && !position) {
      setError("Click the canvas inside a bed to set position.");
      return;
    }

    setError(null);
    setSaveWarnings([]);
    onPlacingChange(true);

    if (isDirectSeed) {
      const response = await fetch(`/api/gardens/${garden.id}/placements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expected_version: garden.version,
          bed_area_id: selectedBedId,
          plant_id: selectedPlant.id,
          plant_provenance: selectedPlant.provenance,
          position_x: position!.x,
          position_y: position!.y,
          planted_on: plantedOn,
        }),
      });

      onPlacingChange(false);

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        if (body?.violations?.length) {
          onViolationsChange(body.violations);
        } else if (body?.error === "conflict" && body.current) {
          onGardenUpdate(body.current);
          setError("Garden changed elsewhere — refreshed to the latest version.");
        } else {
          setError(body?.error ?? "Failed to place plant");
        }
        return;
      }

      const body = await response.json();
      onGardenUpdate(body.garden);
      onViolationsChange([]);
      onWarningsChange([]);
      setSaveWarnings(body.warnings ?? []);
      setSelectedPlant(null);
      setPlantDetail(null);
      setQuery("");
      setResults([]);
      return;
    }

    const response = await fetch(`/api/gardens/${garden.id}/indoor-starts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expected_version: garden.version,
        target_bed_area_id: selectedBedId,
        plant_id: selectedPlant.id,
        plant_provenance: selectedPlant.provenance,
        started_on: plantedOn,
      }),
    });

    onPlacingChange(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      if (body?.error === "conflict" && body.current) {
        onGardenUpdate(body.current);
        setError("Garden changed elsewhere — refreshed to the latest version.");
      } else {
        setError(body?.error ?? "Failed to start indoors");
      }
      return;
    }

    const body = await response.json();
    onGardenUpdate(body.garden);
    onViolationsChange([]);
    onWarningsChange([]);
    setSaveWarnings(body.warnings ?? []);
    setSelectedPlant(null);
    setPlantDetail(null);
    setQuery("");
    setResults([]);
  }

  async function handleRemove(placement: PlantPlacement) {
    setError(null);
    setRemovingId(placement.id);

    const response = await fetch(
      `/api/gardens/${garden.id}/placements/${placement.id}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expected_version: garden.version }),
      },
    );

    setRemovingId(null);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      if (body?.error === "conflict" && body.current) {
        onGardenUpdate(body.current);
        setError("Garden changed elsewhere — refreshed to the latest version.");
      } else {
        setError(body?.error ?? "Failed to remove plant");
      }
      return;
    }

    const updated = (await response.json()) as GardenDetail;
    onGardenUpdate(updated);
  }

  const displayWarnings = saveWarnings.length > 0 ? saveWarnings : warnings;

  return (
    <div className="stack card">
      <h2>Place plants</h2>
      <p className="field-label">
        Choose direct seed or indoor start, select a target bed, then place on the canvas (direct
        seed only).
      </p>
      <label className="stack">
        Target bed
        <select
          className="input"
          value={selectedBedId}
          onChange={(event) => onBedChange(event.target.value)}
        >
          <option value="">Select bed…</option>
          {beds.map((bed) => (
            <option key={bed.id} value={bed.id}>
              {bed.name ?? "Bed"} ({bed.length}×{bed.width} {garden.unit})
            </option>
          ))}
        </select>
      </label>
      <fieldset className="stack">
        <legend>Planting method</legend>
        <label className="row">
          <input
            type="radio"
            name="planting-method"
            checked={plantingMethod === "direct_seed"}
            disabled={!methodSupport.direct_seed}
            onChange={() => setPlantingMethod("direct_seed")}
          />
          Direct seed
        </label>
        {!methodSupport.direct_seed && methodSupport.direct_seed_disabled_reason ? (
          <p className="field-label">{methodSupport.direct_seed_disabled_reason}</p>
        ) : null}
        <label className="row">
          <input
            type="radio"
            name="planting-method"
            checked={plantingMethod === "indoor_start"}
            disabled={!methodSupport.indoor_start}
            onChange={() => setPlantingMethod("indoor_start")}
          />
          Start indoors
        </label>
        {!methodSupport.indoor_start && methodSupport.indoor_start_disabled_reason ? (
          <p className="field-label">{methodSupport.indoor_start_disabled_reason}</p>
        ) : null}
      </fieldset>
      <label className="stack">
        Search catalog
        <input
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tomato, basil…"
        />
      </label>
      {results.length > 0 ? (
        <ul className="stack plant-search-results">
          {results.map((plant) => (
            <li key={plant.id}>
              <button
                type="button"
                className={`btn secondary${selectedPlant?.id === plant.id ? " selected" : ""}`}
                onClick={() =>
                  setSelectedPlant({
                    id: plant.id,
                    common_name: plant.common_name,
                    provenance:
                      plant.provenance === "provisional" || plant.provenance === "linked_provisional"
                        ? "provisional"
                        : "authoritative",
                  })
                }
              >
                {plant.common_name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {selectedPlant ? (
        <p>
          Selected: <strong>{selectedPlant.common_name}</strong>
        </p>
      ) : null}
      <label className="stack">
        {isDirectSeed ? "Planted on" : "Started on"}
        <input
          className="input"
          type="date"
          value={plantedOn}
          onChange={(event) => setPlantedOn(event.target.value)}
        />
      </label>
      {isDirectSeed ? (
        position ? (
          <p className="field-label">
            Position: ({position.x.toFixed(1)}, {position.y.toFixed(1)}) {garden.unit}
          </p>
        ) : (
          <p className="field-label">Click the canvas inside a bed to set position.</p>
        )
      ) : (
        <p className="field-label">
          Indoor starts are tracked separately until transplant — no canvas position needed.
        </p>
      )}
      {displayWarnings.length > 0 ? (
        <div className="stack validation-warnings">
          <strong>Advisory</strong>
          <ul>
            {displayWarnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`}>{warning.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <form onSubmit={handlePlace}>
        <button
          className="btn"
          type="submit"
          disabled={
            placing ||
            !selectedPlant ||
            !selectedBedId ||
            (isDirectSeed && (!position || violations.length > 0))
          }
        >
          {placing
            ? "Saving…"
            : isDirectSeed
              ? "Direct seed"
              : "Start indoors"}
        </button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      <div className="stack">
        <h3>Placed plants</h3>
        {garden.placements.length === 0 ? (
          <p className="field-label">No plants placed yet.</p>
        ) : (
          <ul className="stack">
            {garden.placements.map((placement) => (
              <li key={placement.id} className="row">
                <span>
                  {placement.plant.common_name} at ({placement.position_x.toFixed(1)},{" "}
                  {placement.position_y.toFixed(1)})
                </span>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={removingId === placement.id}
                  onClick={() => void handleRemove(placement)}
                >
                  {removingId === placement.id ? "Removing…" : "Remove"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
