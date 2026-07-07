"use client";

import { useEffect, useState } from "react";
import type { RootstockOption } from "@/lib/catalog/types";
import type { GardenZoneType } from "@/lib/garden/enums";
import type { GardenArea } from "@/lib/garden/types";
import {
  ARMED_PLANT_HINT,
  ARMED_TRANSPLANT_HINT,
} from "@/lib/garden/messages";
import type { ArmedContext, VisualPlantPlacement, GardenStructure } from "@/lib/planner/types";
import type { ValidationViolation, ValidationWarning } from "@/lib/garden/types";
import { ValidationFeedback } from "@/components/garden/ValidationFeedback";
import type { DragPlantPayload } from "./VisualCanvas";

interface PropertyPanelProps {
  variant?: "desktop" | "mobile";
  zoneType: GardenZoneType;
  areas: GardenArea[];
  unit: string;
  selectedPlacement: VisualPlantPlacement | null;
  selectedStructure?: GardenStructure | null;
  armedPayload?: DragPlantPayload | null;
  armedContext?: ArmedContext;
  dropRootstockId?: string | null;
  onDropRootstockChange?: (rootstockId: string | null) => void;
  onCancelArmed?: () => void;
  violations: ValidationViolation[];
  warnings: ValidationWarning[];
  plantedOn: string;
  onPlantedOnChange: (value: string) => void;
  onDeletePlacement?: (placementId: string) => void;
  onDeleteStructure?: (structureId: string) => void;
}

export function PropertyPanel({
  variant = "desktop",
  zoneType,
  areas,
  unit,
  selectedPlacement,
  selectedStructure = null,
  armedPayload = null,
  armedContext = null,
  dropRootstockId,
  onDropRootstockChange,
  onCancelArmed,
  violations,
  warnings,
  plantedOn,
  onPlantedOnChange,
  onDeletePlacement,
  onDeleteStructure,
}: PropertyPanelProps) {
  const [rootstocks, setRootstocks] = useState<RootstockOption[]>([]);
  const plantId = selectedPlacement?.plant.id ?? armedPayload?.plant_id ?? null;

  useEffect(() => {
    if (zoneType !== "orchard" || !plantId) {
      setRootstocks([]);
      return;
    }

    async function loadRootstocks() {
      const response = await fetch(`/api/plants/${plantId}/rootstocks`);
      if (!response.ok) {
        setRootstocks([]);
        return;
      }
      const body = await response.json();
      setRootstocks(body.rootstocks ?? []);
    }

    void loadRootstocks();
  }, [zoneType, plantId]);

  const activeRootstockId = selectedPlacement?.rootstock_id ?? dropRootstockId ?? null;
  const activeRootstock = rootstocks.find((option) => option.id === activeRootstockId) ?? null;

  const bedName = selectedPlacement
    ? (areas.find((area) => area.id === selectedPlacement.bed_area_id)?.name ?? "Bed")
    : null;

  const armedHint =
    armedContext === "transplant"
      ? ARMED_TRANSPLANT_HINT
      : armedPayload
        ? ARMED_PLANT_HINT
        : null;

  return (
    <div
      className={`planner-panel card stack${variant === "mobile" ? " mobile-property-panel" : ""}`}
      style={{ background: "var(--planner-panel-bg)" }}
      role="complementary"
      aria-label="Item details"
    >
      <h2>Details</h2>
      {armedPayload ? (
        <div className="placement-hint" role="status">
          <p>
            Placing <strong>{armedPayload.common_name}</strong>
          </p>
          <p className="field-label">{armedHint}</p>
          {onCancelArmed ? (
            <button type="button" className="btn secondary" onClick={onCancelArmed}>
              Cancel
            </button>
          ) : null}
        </div>
      ) : null}
      {selectedPlacement ? (
        <>
          <p>
            <strong>{selectedPlacement.plant.common_name}</strong>
          </p>
          <p className="field-label">Bed: {bedName}</p>
          <p className="field-label">
            Spacing: {selectedPlacement.spacing_radius.toFixed(2)} {unit} circle
          </p>
          <label className="stack">
            <span className="field-label">Planted on</span>
            <input
              type="date"
              className="input"
              value={plantedOn}
              onChange={(event) => onPlantedOnChange(event.target.value)}
            />
          </label>
          {onDeletePlacement ? (
            <button
              type="button"
              className="btn secondary"
              onClick={() => onDeletePlacement(selectedPlacement.id)}
            >
              Remove plant
            </button>
          ) : null}
        </>
      ) : selectedStructure ? (
        <>
          <p>
            <strong>{selectedStructure.structure_type.name}</strong>
          </p>
          <p className="field-label">
            Size: {selectedStructure.length.toFixed(1)} × {selectedStructure.width.toFixed(1)} {unit}
          </p>
          {selectedStructure.locked ? (
            <p className="field-label">Locked — unlock in the layer panel to move or resize.</p>
          ) : null}
          {onDeleteStructure ? (
            <button
              type="button"
              className="btn secondary"
              onClick={() => onDeleteStructure(selectedStructure.id)}
            >
              Remove structure
            </button>
          ) : null}
        </>
      ) : !armedPayload ? (
        <p className="field-label">
          Select a plant or structure on the canvas, or choose one from the library.
        </p>
      ) : null}

      {zoneType === "orchard" && rootstocks.length > 0 ? (
        <label className="stack">
          <span className="field-label">Rootstock</span>
          <select
            className="input"
            value={activeRootstockId ?? ""}
            onChange={(event) =>
              onDropRootstockChange?.(event.target.value ? event.target.value : null)
            }
          >
            <option value="">Select rootstock…</option>
            {rootstocks.map((rootstock) => (
              <option key={rootstock.id} value={rootstock.id}>
                {rootstock.name} ({rootstock.vigor}, spacing {rootstock.spacing_cm ?? "—"} cm)
              </option>
            ))}
          </select>
          {activeRootstock ? (
            <p className="field-label">
              Mature spread {activeRootstock.mature_spread_cm ?? "—"} cm · spacing{" "}
              {activeRootstock.spacing_cm ?? "—"} cm
            </p>
          ) : (
            <p className="field-label">Choose a rootstock before placing orchard trees.</p>
          )}
        </label>
      ) : null}

      <ValidationFeedback violations={violations} warnings={warnings} />
    </div>
  );
}
