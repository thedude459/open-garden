"use client";

import { useState, type RefObject } from "react";
import type { PlacementModeState } from "@/lib/planner/types";
import type { VisualGardenDetail } from "@/lib/planner/types";
import type { ValidationViolation, ValidationWarning } from "@/lib/garden/types";
import { isArmed } from "@/lib/planner/placement-mode";
import { zoneTypeLabel } from "@/lib/planner/zone-plants";
import { PlantLibrary } from "./PlantLibrary";
import { VisualCanvas, type DragPlantPayload } from "./VisualCanvas";
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
  dropRootstockId?: string | null;
  placementMode: PlacementModeState;
  highlightedBedId?: string | null;
  dropPreview?: { x: number; y: number; spacing_radius: number; valid: boolean } | null;
  onSelectPlacement: (id: string | null) => void;
  onSelectStructure: (id: string | null) => void;
  onPlantedOnChange: (value: string) => void;
  onDeletePlacement: (id: string) => void;
  onDeleteStructure: (id: string) => void;
  onPlantArm: (payload: DragPlantPayload) => void;
  onGardenClick: (position: { x: number; y: number }) => void;
  onGardenPointerMove: (position: { x: number; y: number } | null) => void;
  onCancelArmed: () => void;
  onDropRootstockChange?: (rootstockId: string | null) => void;
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
  dropRootstockId,
  placementMode,
  highlightedBedId,
  dropPreview,
  onSelectPlacement,
  onSelectStructure,
  onPlantedOnChange,
  onDeletePlacement,
  onDeleteStructure,
  onPlantArm,
  onGardenClick,
  onGardenPointerMove,
  onCancelArmed,
  onDropRootstockChange,
}: MobilePlannerViewProps) {
  const [libraryOpen, setLibraryOpen] = useState(false);

  const selectedPlacement =
    garden.placements.find((placement) => placement.id === selectedPlacementId) ?? null;
  const selectedStructure =
    garden.structures.find((structure) => structure.id === selectedStructureId) ?? null;

  function handlePlantSelect(payload: DragPlantPayload) {
    onPlantArm(payload);
    setLibraryOpen(false);
  }

  return (
    <div className="mobile-planner">
      <div className="mobile-planner-header">
        <h1>{garden.name}</h1>
        <span className="zone-badge">{zoneTypeLabel(garden.zone_type)}</span>
      </div>
      <button
        type="button"
        className="btn"
        onClick={() => setLibraryOpen((open) => !open)}
        aria-expanded={libraryOpen}
      >
        {libraryOpen ? "Hide plant library" : "Add plants"}
      </button>
      {libraryOpen ? (
        <div className="mobile-plant-library-sheet card" role="region" aria-label="Plant library">
          <PlantLibrary
            zoneType={garden.zone_type}
            dropRootstockId={dropRootstockId}
            selectedPlantId={placementMode.armed_payload?.plant_id ?? null}
            onPlantSelect={handlePlantSelect}
          />
        </div>
      ) : null}
      <VisualCanvas
        canvasSvgRef={canvasSvgRef}
        zoom={zoom}
        dragEnabled={false}
        armed={isArmed(placementMode)}
        highlightedBedId={highlightedBedId}
        showEmptyBedHints
        dropPreview={dropPreview}
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
        onGardenClick={onGardenClick}
        onGardenPointerMove={onGardenPointerMove}
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
          areas={garden.areas}
          unit={garden.unit}
          selectedPlacement={selectedPlacement}
          selectedStructure={selectedStructure}
          armedPayload={placementMode.armed_payload}
          armedContext={placementMode.armed_context}
          dropRootstockId={dropRootstockId}
          onDropRootstockChange={onDropRootstockChange}
          onCancelArmed={onCancelArmed}
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
