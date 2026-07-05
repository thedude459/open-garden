"use client";

import type { RefObject } from "react";
import type { VisualGardenDetail } from "@/lib/planner/types";
import type { ValidationViolation, ValidationWarning } from "@/lib/garden/types";
import { zoneTypeLabel } from "@/lib/planner/zone-plants";
import { VisualCanvas } from "./VisualCanvas";
import { PropertyPanel } from "./PropertyPanel";

interface MobilePlannerViewProps {
  garden: VisualGardenDetail;
  canvasSvgRef: RefObject<SVGSVGElement | null>;
  zoom: number;
  selectedPlacementId: string | null;
  selectedStructureId: string | null;
  violations: ValidationViolation[];
  warnings: ValidationWarning[];
  plantedOn: string;
  onSelectPlacement: (id: string | null) => void;
  onSelectStructure: (id: string | null) => void;
  onPlantedOnChange: (value: string) => void;
  onDeletePlacement: (id: string) => void;
  onDeleteStructure: (id: string) => void;
}

export function MobilePlannerView({
  garden,
  canvasSvgRef,
  zoom,
  selectedPlacementId,
  selectedStructureId,
  violations,
  warnings,
  plantedOn,
  onSelectPlacement,
  onSelectStructure,
  onPlantedOnChange,
  onDeletePlacement,
  onDeleteStructure,
}: MobilePlannerViewProps) {
  const selectedPlacement =
    garden.placements.find((placement) => placement.id === selectedPlacementId) ?? null;
  const selectedStructure =
    garden.structures.find((structure) => structure.id === selectedStructureId) ?? null;

  return (
    <div className="mobile-planner">
      <div className="mobile-planner-header">
        <h1>{garden.name}</h1>
        <span className="zone-badge">{zoneTypeLabel(garden.zone_type)}</span>
      </div>
      <VisualCanvas
        canvasSvgRef={canvasSvgRef}
        zoom={zoom}
        dragEnabled={false}
        gardenLength={garden.length}
        gardenWidth={garden.width}
        unit={garden.unit}
        areas={garden.areas}
        structures={garden.structures}
        placements={garden.placements}
        selectedPlacementId={selectedPlacementId}
        selectedStructureId={selectedStructureId}
        onSelectPlacement={onSelectPlacement}
        onSelectStructure={onSelectStructure}
      />
      <div
        className="mobile-planner-sheet"
        role="region"
        aria-label="Selected item details"
        tabIndex={0}
      >
        <PropertyPanel
          variant="mobile"
          zoneType={garden.zone_type}
          selectedPlacement={selectedPlacement}
          selectedStructure={selectedStructure}
          violations={violations}
          warnings={warnings}
          plantedOn={plantedOn}
          onPlantedOnChange={onPlantedOnChange}
          onDeletePlacement={onDeletePlacement}
          onDeleteStructure={onDeleteStructure}
        />
      </div>
    </div>
  );
}
