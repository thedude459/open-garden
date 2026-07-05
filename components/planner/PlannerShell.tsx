"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VisualGardenDetail } from "@/lib/planner/types";
import type { ValidationViolation, ValidationWarning, GardenDetail } from "@/lib/garden/types";
import { isPointInBed } from "@/lib/garden/geometry";
import { uploadGardenThumbnail } from "@/lib/planner/thumbnail";
import { AreaEditor, type AreaDraft } from "@/components/garden/AreaEditor";
import { IndoorStartsPanel } from "@/components/garden/IndoorStartsPanel";
import { GardenSettingsPanel } from "@/components/garden/GardenSettingsPanel";
import { ConflictDialog } from "@/components/garden/ConflictDialog";
import { PlantLibrary } from "./PlantLibrary";
import { StructureLibrary } from "./StructureLibrary";
import { LayerPanel } from "./LayerPanel";
import { PropertyPanel } from "./PropertyPanel";
import { PlannerToolbar } from "./PlannerToolbar";
import { MobilePlannerView } from "./MobilePlannerView";
import { usePlannerViewport, usePrefersReducedMotion } from "./usePlannerViewport";
import {
  VisualCanvas,
  type DragPlantPayload,
  type DragStructurePayload,
} from "./VisualCanvas";

interface PlannerShellProps {
  initialGarden: VisualGardenDetail;
}

function findBedAtPoint(
  garden: VisualGardenDetail,
  x: number,
  y: number,
): { id: string } | null {
  for (const area of garden.areas) {
    if (area.area_type !== "bed") {
      continue;
    }
    if (
      isPointInBed(x, y, {
        origin_x: area.origin_x,
        origin_y: area.origin_y,
        length: area.length,
        width: area.width,
        rotation_degrees: area.rotation_degrees,
      })
    ) {
      return { id: area.id };
    }
  }
  return null;
}

export function PlannerShell({ initialGarden }: PlannerShellProps) {
  const [garden, setGarden] = useState(initialGarden);
  const [preview, setPreview] = useState<AreaDraft | null>(null);
  const [selectedBedId, setSelectedBedId] = useState(
    () => initialGarden.areas.find((area) => area.area_type === "bed")?.id ?? "",
  );
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [violations, setViolations] = useState<ValidationViolation[]>([]);
  const [warnings, setWarnings] = useState<ValidationWarning[]>([]);
  const [dropPreview, setDropPreview] = useState<{
    x: number;
    y: number;
    spacing_radius: number;
    valid: boolean;
  } | null>(null);
  const [conflictGarden, setConflictGarden] = useState<VisualGardenDetail | null>(null);
  const [transplantStartId, setTransplantStartId] = useState<string | null>(null);
  const [transplantPosition, setTransplantPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [dropRootstockId, setDropRootstockId] = useState<string | null>(null);
  const [pendingPlantId, setPendingPlantId] = useState<string | null>(null);
  const [leftPanelTab, setLeftPanelTab] = useState<"plants" | "structures">("plants");
  const [selectedStructureId, setSelectedStructureId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [invalidDrop, setInvalidDrop] = useState(false);
  const [plantedOn, setPlantedOn] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const canvasSvgRef = useRef<SVGSVGElement>(null);
  const { isMobile } = usePlannerViewport();
  const reducedMotion = usePrefersReducedMotion();

  const selectedPlacement = useMemo(
    () => garden.placements.find((placement) => placement.id === selectedPlacementId) ?? null,
    [garden.placements, selectedPlacementId],
  );

  const selectedStructure = useMemo(
    () => garden.structures.find((structure) => structure.id === selectedStructureId) ?? null,
    [garden.structures, selectedStructureId],
  );

  const handleGardenUpdate = useCallback((updated: VisualGardenDetail | GardenDetail) => {
    setGarden(updated as VisualGardenDetail);
  }, []);

  const onPreviewChange = useCallback((draft: AreaDraft | null) => {
    setPreview(draft);
  }, []);

  useEffect(() => {
    if (selectedPlacement) {
      setPlantedOn(selectedPlacement.planted_on);
    }
  }, [selectedPlacement]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedPlacementId(null);
        setSelectedStructureId(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!invalidDrop || reducedMotion) {
      return;
    }
    const timer = window.setTimeout(() => setInvalidDrop(false), 450);
    return () => window.clearTimeout(timer);
  }, [invalidDrop, reducedMotion]);

  const selectedItemLabel = useMemo(() => {
    if (selectedPlacement) {
      return `Selected plant: ${selectedPlacement.plant.common_name}`;
    }
    if (selectedStructure) {
      return `Selected structure: ${selectedStructure.structure_type.name}`;
    }
    return "";
  }, [selectedPlacement, selectedStructure]);

  async function handlePlantedOnChange(value: string) {
    setPlantedOn(value);
    if (!selectedPlacement) {
      return;
    }
    const response = await fetch(
      `/api/gardens/${garden.id}/placements/${selectedPlacement.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expected_version: garden.version,
          planted_on: value,
        }),
      },
    );
    if (response.ok) {
      setGarden((await response.json()) as VisualGardenDetail);
    }
  }

  async function handleSavePlan() {
    setSaving(true);
    try {
      const svg = canvasSvgRef.current;
      if (!svg) {
        return;
      }
      const thumbnailUrl = await uploadGardenThumbnail(garden.id, garden.version, svg);
      if (thumbnailUrl) {
        setGarden((current) => ({
          ...current,
          thumbnail_url: thumbnailUrl,
          visual_version: Math.max(1, current.visual_version),
          version: current.version + 1,
        }));
      }
    } finally {
      setSaving(false);
    }
  }

  function triggerInvalidDrop() {
    if (!reducedMotion) {
      setInvalidDrop(true);
    }
  }

  async function validateAtPoint(
    bedAreaId: string,
    plantId: string,
    provenance: "authoritative" | "provisional",
    position: { x: number; y: number },
    plantedOn: string,
    rootstockId?: string | null,
  ) {
    const response = await fetch(`/api/gardens/${garden.id}/validate-placement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bed_area_id: bedAreaId,
        plant_id: plantId,
        plant_provenance: provenance,
        position_x: position.x,
        position_y: position.y,
        planted_on: plantedOn,
        planting_context: "direct_seed",
        rootstock_id: rootstockId ?? null,
      }),
    });
    if (!response.ok) {
      return { valid: false, violations: [] as ValidationViolation[], warnings: [] as ValidationWarning[] };
    }
    const body = await response.json();
    return {
      valid: body.valid ?? false,
      violations: (body.violations ?? []) as ValidationViolation[],
      warnings: (body.warnings ?? []) as ValidationWarning[],
    };
  }

  async function placePlant(
    bedAreaId: string,
    payload: DragPlantPayload,
    position: { x: number; y: number },
    plantedOn: string,
  ) {
    const response = await fetch(`/api/gardens/${garden.id}/placements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expected_version: garden.version,
        bed_area_id: bedAreaId,
        plant_id: payload.plant_id,
        plant_provenance: payload.plant_provenance,
        position_x: position.x,
        position_y: position.y,
        planted_on: plantedOn,
        rootstock_id: payload.rootstock_id ?? null,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      if (body?.violations?.length) {
        setViolations(body.violations);
      } else if (body?.error === "conflict" && body.current) {
        setConflictGarden(body.current as VisualGardenDetail);
      }
      return;
    }

    const updated = (await response.json()) as VisualGardenDetail;
    setGarden(updated);
    setViolations([]);
    setWarnings([]);
    setDropPreview(null);
  }

  async function handleExternalPlantDrop(payload: DragPlantPayload, position: { x: number; y: number }) {
    const bed = findBedAtPoint(garden, position.x, position.y);
    if (!bed) {
      setViolations([{ code: "BOUNDARY", message: "Drop inside a bed" }]);
      setDropPreview({ ...position, spacing_radius: payload.spacing_radius, valid: false });
      triggerInvalidDrop();
      return;
    }

    const plantedOn = new Date().toISOString().slice(0, 10);
    const result = await validateAtPoint(
      bed.id,
      payload.plant_id,
      payload.plant_provenance,
      position,
      plantedOn,
      payload.rootstock_id ?? dropRootstockId,
    );
    setViolations(result.violations);
    setWarnings(result.warnings);
    setDropPreview({
      x: position.x,
      y: position.y,
      spacing_radius: payload.spacing_radius,
      valid: result.valid,
    });

    if (result.valid) {
      await placePlant(bed.id, payload, position, plantedOn);
    } else {
      triggerInvalidDrop();
    }
  }

  async function handlePlacementMove(placementId: string, position: { x: number; y: number }) {
    const placement = garden.placements.find((item) => item.id === placementId);
    if (!placement) {
      return;
    }

    const bed = findBedAtPoint(garden, position.x, position.y);
    const validBed = bed ?? { id: placement.bed_area_id };
    const result = await validateAtPoint(
      validBed.id,
      placement.plant.id,
      placement.plant.provenance,
      position,
      placement.planted_on,
      placement.rootstock_id,
    );
    setDropPreview({
      x: position.x,
      y: position.y,
      spacing_radius: placement.spacing_radius,
      valid: result.valid,
    });
    setViolations(result.violations);
    setWarnings(result.warnings);

    if (!result.valid || !bed) {
      return;
    }

    const deleteResponse = await fetch(
      `/api/gardens/${garden.id}/placements/${placementId}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expected_version: garden.version }),
      },
    );
    if (!deleteResponse.ok) {
      return;
    }
    const afterDelete = (await deleteResponse.json()) as VisualGardenDetail;
    setGarden(afterDelete);

    await placePlant(
      bed.id,
      {
        plant_id: placement.plant.id,
        plant_provenance: placement.plant.provenance,
        common_name: placement.plant.common_name,
        illustration_url: placement.illustration_url,
        spacing_radius: placement.spacing_radius,
        rootstock_id: placement.rootstock_id,
      },
      position,
      placement.planted_on,
    );
  }

  async function handleExternalStructureDrop(
    payload: DragStructurePayload,
    position: { x: number; y: number },
  ) {
    const response = await fetch(`/api/gardens/${garden.id}/structures`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expected_version: garden.version,
        structure_type_slug: payload.structure_type_slug,
        origin_x: Math.max(0, position.x),
        origin_y: Math.max(0, position.y),
        length: payload.default_length,
        width: payload.default_width,
        rotation_degrees: 0,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      if (body?.violations?.length) {
        setViolations(body.violations);
      } else if (body?.error === "conflict" && body.current) {
        setConflictGarden(body.current as VisualGardenDetail);
      } else {
        setViolations([{ code: "BOUNDARY", message: body?.error ?? "Could not place structure" }]);
      }
      return;
    }

    setGarden((await response.json()) as VisualGardenDetail);
    setViolations([]);
  }

  async function handleStructureMove(structureId: string, origin: { x: number; y: number }) {
    const structure = garden.structures.find((item) => item.id === structureId);
    if (!structure || structure.locked) {
      return;
    }

    const response = await fetch(`/api/gardens/${garden.id}/structures/${structureId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expected_version: garden.version,
        origin_x: origin.x,
        origin_y: origin.y,
        length: structure.length,
        width: structure.width,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      if (body?.violations?.length) {
        setViolations(body.violations);
      } else if (body?.error === "conflict" && body.current) {
        setConflictGarden(body.current as VisualGardenDetail);
      }
      return;
    }

    setGarden((await response.json()) as VisualGardenDetail);
    setViolations([]);
  }

  async function handleStructureResize(
    structureId: string,
    bounds: { origin_x: number; origin_y: number; length: number; width: number },
  ) {
    const structure = garden.structures.find((item) => item.id === structureId);
    if (!structure || structure.locked) {
      return;
    }

    const response = await fetch(`/api/gardens/${garden.id}/structures/${structureId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expected_version: garden.version,
        origin_x: bounds.origin_x,
        origin_y: bounds.origin_y,
        length: bounds.length,
        width: bounds.width,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      if (body?.violations?.length) {
        setViolations(body.violations);
      }
      return;
    }

    setGarden((await response.json()) as VisualGardenDetail);
    setViolations([]);
  }

  async function handleDeleteStructure(structureId: string) {
    const response = await fetch(`/api/gardens/${garden.id}/structures/${structureId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expected_version: garden.version }),
    });
    if (!response.ok) {
      return;
    }
    setGarden((await response.json()) as VisualGardenDetail);
    setSelectedStructureId(null);
  }

  async function handleLayerPatch(
    layers: Array<{ id: string; kind: "structure" | "placement"; z_index?: number; locked?: boolean }>,
  ) {
    const response = await fetch(`/api/gardens/${garden.id}/layers`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expected_version: garden.version,
        layers,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      if (body?.error === "conflict" && body.current) {
        setConflictGarden(body.current as VisualGardenDetail);
      }
      return;
    }

    setGarden((await response.json()) as VisualGardenDetail);
  }

  async function handleDeletePlacement(placementId: string) {
    const response = await fetch(`/api/gardens/${garden.id}/placements/${placementId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expected_version: garden.version }),
    });
    if (!response.ok) {
      return;
    }
    setGarden((await response.json()) as VisualGardenDetail);
    setSelectedPlacementId(null);
  }

  useEffect(() => {
    if (!selectedPlacement || garden.zone_type !== "orchard") {
      return;
    }

    async function loadAdvisories() {
      const result = await validateAtPoint(
        selectedPlacement!.bed_area_id,
        selectedPlacement!.plant.id,
        selectedPlacement!.plant.provenance,
        { x: selectedPlacement!.position_x, y: selectedPlacement!.position_y },
        selectedPlacement!.planted_on,
        selectedPlacement!.rootstock_id,
      );
      setWarnings(result.warnings);
    }

    void loadAdvisories();
  }, [selectedPlacement, garden.zone_type, garden.id]);

  return (
    <div className="planner-shell stack">
      <div className="sr-only" aria-live="polite">
        {selectedItemLabel}
      </div>
      {isMobile ? (
        <MobilePlannerView
          garden={garden}
          canvasSvgRef={canvasSvgRef}
          zoom={zoom}
          selectedPlacementId={selectedPlacementId}
          selectedStructureId={selectedStructureId}
          violations={violations}
          warnings={warnings}
          plantedOn={plantedOn}
          onSelectPlacement={setSelectedPlacementId}
          onSelectStructure={setSelectedStructureId}
          onPlantedOnChange={handlePlantedOnChange}
          onDeletePlacement={handleDeletePlacement}
          onDeleteStructure={handleDeleteStructure}
        />
      ) : (
        <>
          <PlannerToolbar
            planName={garden.name}
            zoneType={garden.zone_type}
            zoom={zoom}
            saving={saving}
            onZoomIn={() => setZoom((current) => Math.min(2.5, current + 0.1))}
            onZoomOut={() => setZoom((current) => Math.max(0.5, current - 0.1))}
            onSave={() => void handleSavePlan()}
          />
          <div className="planner-layout row">
        <div className="planner-left-panel stack">
          <div className="row">
            <button
              type="button"
              className={`btn secondary${leftPanelTab === "plants" ? " active" : ""}`}
              onClick={() => setLeftPanelTab("plants")}
            >
              Plants
            </button>
            <button
              type="button"
              className={`btn secondary${leftPanelTab === "structures" ? " active" : ""}`}
              onClick={() => setLeftPanelTab("structures")}
            >
              Structures
            </button>
          </div>
          {leftPanelTab === "plants" ? (
            <PlantLibrary
              zoneType={garden.zone_type}
              dropRootstockId={dropRootstockId}
              onPlantSelect={(plant) => setPendingPlantId(plant.plant_id)}
            />
          ) : (
            <StructureLibrary zoneType={garden.zone_type} />
          )}
        </div>
        <VisualCanvas
          canvasSvgRef={canvasSvgRef}
          zoom={zoom}
          onZoomChange={setZoom}
          dragEnabled
          reducedMotion={reducedMotion}
          invalidDrop={invalidDrop}
          gardenLength={garden.length}
          gardenWidth={garden.width}
          unit={garden.unit}
          areas={garden.areas}
          structures={garden.structures}
          placements={garden.placements}
          selectedPlacementId={selectedPlacementId}
          selectedStructureId={selectedStructureId}
          dropPreview={dropPreview}
          onSelectPlacement={setSelectedPlacementId}
          onSelectStructure={setSelectedStructureId}
          onExternalPlantDrop={handleExternalPlantDrop}
          onExternalStructureDrop={handleExternalStructureDrop}
          onPlacementMove={handlePlacementMove}
          onStructureMove={handleStructureMove}
          onStructureResize={handleStructureResize}
        />
        <div className="planner-right-panel stack">
          <PropertyPanel
            zoneType={garden.zone_type}
            selectedPlacement={selectedPlacement}
            selectedStructure={selectedStructure}
            pendingPlantId={pendingPlantId}
            dropRootstockId={dropRootstockId}
            onDropRootstockChange={setDropRootstockId}
            violations={violations}
            warnings={warnings}
            plantedOn={plantedOn}
            onPlantedOnChange={handlePlantedOnChange}
            onDeletePlacement={handleDeletePlacement}
            onDeleteStructure={handleDeleteStructure}
          />
          <LayerPanel
            structures={garden.structures}
            placements={garden.placements}
            selectedId={selectedStructureId ?? selectedPlacementId}
            onLayerPatch={handleLayerPatch}
          />
        </div>
      </div>
        </>
      )}
      <GardenSettingsPanel
        garden={garden}
        onGardenUpdate={handleGardenUpdate}
        onConflict={(current) => setConflictGarden(current as VisualGardenDetail)}
        onShrinkConflict={(affected, retry) => {
          if (
            window.confirm(
              `${affected.length} plant placement(s) no longer fit. Remove them and continue?`,
            )
          ) {
            void retry();
          }
        }}
        onZoneChangeConflict={(conflicts, retry) => {
          if (
            window.confirm(
              `${conflicts.length} placement(s) are incompatible with the new zone type:\n${conflicts.map((c) => c.message).join("\n")}\n\nRemove them and continue?`,
            )
          ) {
            void retry();
          }
        }}
      />
      <div className="layout-editor grid">
        <IndoorStartsPanel
          garden={garden}
          transplantStartId={transplantStartId}
          onTransplantStartSelect={(startId) => {
            setTransplantStartId(startId);
            setTransplantPosition(null);
            if (startId) {
              const start = garden.indoor_starts.find((item) => item.id === startId);
              if (start?.target_bed_area_id) {
                setSelectedBedId(start.target_bed_area_id);
              }
            }
          }}
          transplantPosition={transplantPosition}
          onViolationsChange={setViolations}
          onWarningsChange={setWarnings}
          onGardenUpdate={handleGardenUpdate}
          onConflict={(current) => setConflictGarden(current as VisualGardenDetail)}
        />
        <AreaEditor
          unit={garden.unit}
          gardenId={garden.id}
          gardenVersion={garden.version}
          areas={garden.areas}
          onPreviewChange={onPreviewChange}
          onGardenUpdate={handleGardenUpdate}
          onConflict={(current) => setConflictGarden(current as VisualGardenDetail)}
          onShrinkConflict={(affected, retry) => {
            if (
              window.confirm(
                `${affected.length} plant placement(s) no longer fit. Remove them and continue?`,
              )
            ) {
              void retry();
            }
          }}
        />
      </div>
      <ConflictDialog
        open={conflictGarden != null}
        current={conflictGarden}
        onUseRemote={() => {
          if (conflictGarden) {
            setGarden(conflictGarden);
          }
          setConflictGarden(null);
        }}
        onDismiss={() => setConflictGarden(null)}
      />
      {preview ? (
        <p className="field-label">
          Drawing preview: {preview.area_type} {preview.length}×{preview.width}
        </p>
      ) : null}
      {!selectedBedId ? (
        <p className="field-label">Add a bed with the area editor to start planting.</p>
      ) : null}
      {garden.areas.length === 0 &&
      garden.placements.length === 0 &&
      garden.structures.length === 0 ? (
        <p className="field-label planner-empty-hint">
          {garden.zone_type === "container_patio"
            ? "Add containers from the Structures tab or choose a template when creating a new plan."
            : garden.zone_type === "orchard"
              ? "Add beds for tree rows, then drag fruit trees from the plant library."
              : "Add beds with the area editor below, drag plants from the library, or start from a template next time."}
        </p>
      ) : null}
    </div>
  );
}
