"use client";

import { useCallback, useMemo, useState } from "react";
import type { GardenDetail, ValidationViolation, ValidationWarning } from "@/lib/garden/types";
import { isPointInBed } from "@/lib/garden/geometry";
import { LayoutCanvas } from "./LayoutCanvas";
import { AreaEditor, type AreaDraft } from "./AreaEditor";
import { PlantPlacementPanel } from "./PlantPlacementPanel";
import { IndoorStartsPanel } from "./IndoorStartsPanel";
import { ValidationFeedback } from "./ValidationFeedback";
import { GardenSettingsPanel } from "./GardenSettingsPanel";
import { ConflictDialog } from "./ConflictDialog";

interface LayoutEditorProps {
  initialGarden: GardenDetail;
}

export function LayoutEditor({ initialGarden }: LayoutEditorProps) {
  const [garden, setGarden] = useState(initialGarden);
  const [preview, setPreview] = useState<AreaDraft | null>(null);
  const [selectedBedId, setSelectedBedId] = useState(
    () => initialGarden.areas.find((area) => area.area_type === "bed")?.id ?? "",
  );
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [transplantStartId, setTransplantStartId] = useState<string | null>(null);
  const [transplantPosition, setTransplantPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [violations, setViolations] = useState<ValidationViolation[]>([]);
  const [warnings, setWarnings] = useState<ValidationWarning[]>([]);
  const [placing, setPlacing] = useState(false);
  const [conflictGarden, setConflictGarden] = useState<GardenDetail | null>(null);

  const onPreviewChange = useCallback((draft: AreaDraft | null) => {
    setPreview(draft);
  }, []);

  const selectedBed = useMemo(
    () => garden.areas.find((area) => area.id === selectedBedId) ?? null,
    [garden.areas, selectedBedId],
  );

  const transplantStart = useMemo(
    () => garden.indoor_starts.find((start) => start.id === transplantStartId) ?? null,
    [garden.indoor_starts, transplantStartId],
  );

  const candidatePlacement = useMemo(() => {
    if (transplantStartId && transplantPosition) {
      return {
        position_x: transplantPosition.x,
        position_y: transplantPosition.y,
        spacing_radius: 0.75,
        label: "Transplant",
      };
    }
    if (!position) {
      return null;
    }
    const existing = garden.placements[0];
    return {
      position_x: position.x,
      position_y: position.y,
      spacing_radius: existing?.spacing_radius ?? 0.75,
      label: "New",
    };
  }, [position, transplantPosition, transplantStartId, garden.placements]);

  function handleConflict(current: GardenDetail) {
    setConflictGarden(current);
  }

  function handleUseRemoteVersion() {
    if (conflictGarden) {
      setGarden(conflictGarden);
    }
    setConflictGarden(null);
  }

  function handleShrinkConflict(
    affectedPlacementIds: string[],
    retry: () => Promise<void>,
  ) {
    const confirmed = window.confirm(
      `${affectedPlacementIds.length} plant placement(s) no longer fit after this change. Remove them and continue?`,
    );
    if (confirmed) {
      void retry();
    }
  }

  function handleCanvasClick(nextPosition: { x: number; y: number }) {
    if (transplantStart) {
      const targetBed = garden.areas.find((area) => area.id === transplantStart.target_bed_area_id);
      if (!targetBed) {
        setViolations([
          {
            code: "BOUNDARY",
            message: "Assign a target bed before transplanting",
          },
        ]);
        return;
      }
      if (
        !isPointInBed(nextPosition.x, nextPosition.y, {
          origin_x: targetBed.origin_x,
          origin_y: targetBed.origin_y,
          length: targetBed.length,
          width: targetBed.width,
          rotation_degrees: targetBed.rotation_degrees,
        })
      ) {
        setViolations([
          {
            code: "BOUNDARY",
            message: "Click inside the target bed",
          },
        ]);
        return;
      }
      setTransplantPosition(nextPosition);
      return;
    }

    if (!selectedBed) {
      return;
    }
    if (
      !isPointInBed(nextPosition.x, nextPosition.y, {
        origin_x: selectedBed.origin_x,
        origin_y: selectedBed.origin_y,
        length: selectedBed.length,
        width: selectedBed.width,
        rotation_degrees: selectedBed.rotation_degrees,
      })
    ) {
      setViolations([
        {
          code: "BOUNDARY",
          message: "Click inside the selected bed",
        },
      ]);
      return;
    }
    setPosition(nextPosition);
  }

  return (
    <div className="stack">
      <LayoutCanvas
        gardenLength={garden.length}
        gardenWidth={garden.width}
        unit={garden.unit}
        areas={garden.areas}
        placements={garden.placements}
        previewArea={
          preview
            ? {
                area_type: preview.area_type,
                origin_x: preview.origin_x,
                origin_y: preview.origin_y,
                length: preview.length,
                width: preview.width,
              }
            : null
        }
        candidatePlacement={candidatePlacement}
        placementMode={Boolean(selectedBedId || transplantStartId)}
        onCanvasClick={handleCanvasClick}
      />
      <ValidationFeedback violations={violations} warnings={warnings} />
      <GardenSettingsPanel
        garden={garden}
        onGardenUpdate={setGarden}
        onConflict={handleConflict}
        onShrinkConflict={handleShrinkConflict}
      />
      <div className="layout-editor grid">
        <PlantPlacementPanel
          garden={garden}
          selectedBedId={selectedBedId}
          onBedChange={setSelectedBedId}
          position={position}
          violations={violations}
          warnings={warnings}
          onViolationsChange={setViolations}
          onWarningsChange={setWarnings}
          onGardenUpdate={setGarden}
          placing={placing}
          onPlacingChange={setPlacing}
        />
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
          onGardenUpdate={setGarden}
          onConflict={handleConflict}
        />
        <AreaEditor
          unit={garden.unit}
          gardenId={garden.id}
          gardenVersion={garden.version}
          areas={garden.areas}
          onPreviewChange={onPreviewChange}
          onGardenUpdate={setGarden}
          onConflict={handleConflict}
          onShrinkConflict={handleShrinkConflict}
        />
      </div>
      <ConflictDialog
        open={conflictGarden != null}
        current={conflictGarden}
        onUseRemote={handleUseRemoteVersion}
        onDismiss={() => setConflictGarden(null)}
      />
    </div>
  );
}
