"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { GardenArea } from "@/lib/garden/types";
import type { GardenStructure, VisualPlantPlacement } from "@/lib/planner/types";
import { sortByZIndex } from "@/lib/planner/layers";
import {
  gardenPointFromClient,
  layoutScale,
  svgDimensions,
  toSvgX,
  toSvgY,
  CANVAS_PADDING,
} from "@/lib/planner/canvas-projection";
import { PlantSprite } from "./sprites/PlantSprite";
import { StructureSprite } from "./sprites/StructureSprite";

export interface DragPlantPayload {
  plant_id: string;
  plant_provenance: "authoritative" | "provisional";
  common_name: string;
  illustration_url: string;
  spacing_radius: number;
  rootstock_id?: string | null;
  plant_category?: string;
}

export interface DragStructurePayload {
  structure_type_slug: string;
  name: string;
  illustration_url: string;
  default_length: number;
  default_width: number;
}

type CanvasRenderable =
  | { kind: "placement"; z_index: number; placement: VisualPlantPlacement }
  | { kind: "structure"; z_index: number; structure: GardenStructure };

export interface VisualCanvasProps {
  gardenLength: number;
  gardenWidth: number;
  unit: string;
  areas: GardenArea[];
  structures: GardenStructure[];
  placements: VisualPlantPlacement[];
  selectedPlacementId?: string | null;
  selectedStructureId?: string | null;
  dropPreview?: { x: number; y: number; spacing_radius: number; valid: boolean } | null;
  onSelectPlacement?: (placementId: string | null) => void;
  onSelectStructure?: (structureId: string | null) => void;
  onGardenDrop?: (position: { x: number; y: number }) => void;
  onGardenClick?: (position: { x: number; y: number }) => void;
  onGardenPointerMove?: (position: { x: number; y: number } | null) => void;
  onPlacementMove?: (placementId: string, position: { x: number; y: number }) => void;
  onStructureMove?: (structureId: string, origin: { x: number; y: number }) => void;
  onStructureResize?: (
    structureId: string,
    bounds: { origin_x: number; origin_y: number; length: number; width: number },
  ) => void;
  onExternalPlantDrop?: (payload: DragPlantPayload, position: { x: number; y: number }) => void;
  onExternalStructureDrop?: (
    payload: DragStructurePayload,
    position: { x: number; y: number },
  ) => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  dragEnabled?: boolean;
  canvasSvgRef?: RefObject<SVGSVGElement | null>;
  reducedMotion?: boolean;
  invalidDrop?: boolean;
  armed?: boolean;
  highlightedBedId?: string | null;
  showEmptyBedHints?: boolean;
}

export function VisualCanvas({
  gardenLength,
  gardenWidth,
  unit,
  areas,
  structures,
  placements,
  selectedPlacementId,
  selectedStructureId,
  dropPreview,
  onSelectPlacement,
  onSelectStructure,
  onGardenDrop,
  onGardenClick,
  onGardenPointerMove,
  onPlacementMove,
  onStructureMove,
  onStructureResize,
  onExternalPlantDrop,
  onExternalStructureDrop,
  zoom: controlledZoom,
  onZoomChange,
  dragEnabled = true,
  canvasSvgRef,
  reducedMotion = false,
  invalidDrop = false,
  armed = false,
  highlightedBedId = null,
  showEmptyBedHints = false,
}: VisualCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [internalZoom, setInternalZoom] = useState(1);
  const zoom = controlledZoom ?? internalZoom;
  const setZoom = onZoomChange ?? setInternalZoom;
  const [pan] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (canvasSvgRef) {
      canvasSvgRef.current = svgRef.current;
    }
  });

  const scale = layoutScale(gardenLength, gardenWidth);
  const { width: svgWidth, height: svgHeight } = svgDimensions(gardenLength, gardenWidth, scale);

  const renderables = useMemo(
    () =>
      sortByZIndex<CanvasRenderable>([
        ...structures.map((structure) => ({
          kind: "structure" as const,
          z_index: structure.z_index,
          structure,
        })),
        ...placements.map((placement) => ({
          kind: "placement" as const,
          z_index: placement.z_index,
          placement,
        })),
      ]),
    [structures, placements],
  );

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.1 : 0.1;
      const next = Math.min(2.5, Math.max(0.5, zoom + delta));
      setZoom(next);
    },
    [setZoom, zoom],
  );

  const resolveGardenPoint = useCallback(
    (clientX: number, clientY: number) => {
      if (!svgRef.current) {
        return null;
      }
      return gardenPointFromClient(svgRef.current, clientX, clientY, scale);
    },
    [scale],
  );

  function handleDragOver(event: React.DragEvent<SVGSVGElement>) {
    if (!dragEnabled) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    const point = resolveGardenPoint(event.clientX, event.clientY);
    if (point) {
      onGardenPointerMove?.(point);
    }
  }

  function handleDrop(event: React.DragEvent<SVGSVGElement>) {
    if (!dragEnabled) {
      return;
    }
    const point = resolveGardenPoint(event.clientX, event.clientY);
    if (!point) {
      return;
    }
    const plantRaw = event.dataTransfer.getData("application/garden-plant");
    if (plantRaw && onExternalPlantDrop) {
      onExternalPlantDrop(JSON.parse(plantRaw) as DragPlantPayload, point);
      return;
    }
    const structureRaw = event.dataTransfer.getData("application/garden-structure");
    if (structureRaw && onExternalStructureDrop) {
      onExternalStructureDrop(JSON.parse(structureRaw) as DragStructurePayload, point);
      return;
    }
    onGardenDrop?.(point);
  }

  function startStructureDrag(structureId: string, event: React.PointerEvent<SVGGElement>) {
    if (!dragEnabled) {
      return;
    }
    event.stopPropagation();
    const structure = structures.find((item) => item.id === structureId);
    if (!structure || structure.locked) {
      return;
    }
    const svg = svgRef.current;
    if (!svg) {
      return;
    }
    const offsetX = event.clientX;
    const offsetY = event.clientY;
    const startOrigin = { x: structure.origin_x, y: structure.origin_y };

    const handleMove = (_moveEvent: PointerEvent) => {
      // Preview handled visually on pointer up only to avoid API spam.
    };
    const handleUp = (upEvent: PointerEvent) => {
      const point = gardenPointFromClient(svg, upEvent.clientX, upEvent.clientY, scale);
      const startPoint = gardenPointFromClient(svg, offsetX, offsetY, scale);
      onStructureMove?.(structureId, {
        x: Math.max(0, startOrigin.x + (point.x - startPoint.x)),
        y: Math.max(0, startOrigin.y + (point.y - startPoint.y)),
      });
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  function startStructureResize(structureId: string, event: React.PointerEvent<SVGCircleElement>) {
    if (!dragEnabled) {
      return;
    }
    event.stopPropagation();
    const structure = structures.find((item) => item.id === structureId);
    if (!structure || structure.locked) {
      return;
    }
    const svg = svgRef.current;
    if (!svg) {
      return;
    }

    const handleMove = (_moveEvent: PointerEvent) => {
      // Persist dimensions on pointer up only.
    };
    const handleUp = (upEvent: PointerEvent) => {
      const point = gardenPointFromClient(svg, upEvent.clientX, upEvent.clientY, scale);
      onStructureResize?.(structureId, {
        origin_x: structure.origin_x,
        origin_y: structure.origin_y,
        length: Math.max(0.5, point.x - structure.origin_x),
        width: Math.max(0.5, point.y - structure.origin_y),
      });
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  return (
    <div
      className={`visual-canvas-wrap card${invalidDrop && !reducedMotion ? " drop-shake" : ""}${armed ? " armed" : ""}`}
      style={{ background: "var(--planner-canvas-bg)", overflow: "hidden" }}
      onWheel={handleWheel}
    >
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "center center",
        }}
      >
        <svg
          ref={svgRef}
          className="visual-canvas"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          width="100%"
          height={svgHeight}
          role="img"
          aria-label={`Visual garden ${gardenLength} by ${gardenWidth} ${unit}`}
          onClick={(event) => {
            const point = resolveGardenPoint(event.clientX, event.clientY);
            if (armed && point && onGardenClick) {
              event.stopPropagation();
              onGardenClick(point);
              return;
            }
            onSelectPlacement?.(null);
            onSelectStructure?.(null);
          }}
          onPointerMove={(event) => {
            if (!armed || !onGardenPointerMove) {
              return;
            }
            onGardenPointerMove(resolveGardenPoint(event.clientX, event.clientY));
          }}
          onPointerLeave={() => onGardenPointerMove?.(null)}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <rect
            className="garden-boundary"
            x={CANVAS_PADDING}
            y={CANVAS_PADDING}
            width={gardenLength * scale}
            height={gardenWidth * scale}
            fill="var(--planner-bed-fill)"
            opacity={0.15}
          />
          {areas.map((area) => (
            <rect
              key={area.id}
              className={
                area.area_type === "bed"
                  ? `garden-area-bed${highlightedBedId === area.id ? " highlighted" : ""}`
                  : "garden-area-path"
              }
              x={toSvgX(area.origin_x, scale)}
              y={toSvgY(area.origin_y, scale)}
              width={area.length * scale}
              height={area.width * scale}
              fill={area.area_type === "bed" ? "var(--planner-bed-fill)" : "var(--planner-path-fill)"}
              stroke="var(--border)"
            />
          ))}
          {showEmptyBedHints
            ? areas
                .filter((area) => area.area_type === "bed")
                .map((bed) => {
                  const occupied = placements.some((placement) => placement.bed_area_id === bed.id);
                  if (occupied) {
                    return null;
                  }
                  return (
                    <text
                      key={`hint-${bed.id}`}
                      className="bed-empty-hint"
                      x={toSvgX(bed.origin_x + bed.length / 2, scale)}
                      y={toSvgY(bed.origin_y + bed.width / 2, scale)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={Math.max(10, 12 / zoom)}
                    >
                      Drag or tap to add plants
                    </text>
                  );
                })
            : null}
          {renderables.map((item) =>
            item.kind === "structure" ? (
              <StructureSprite
                key={`structure-${item.structure.id}`}
                structure={item.structure}
                scale={scale}
                selected={selectedStructureId === item.structure.id}
                onSelect={(id) => {
                  onSelectStructure?.(id);
                  onSelectPlacement?.(null);
                }}
                onPointerDragStart={dragEnabled ? startStructureDrag : undefined}
                onResizeStart={
                  dragEnabled
                    ? (id, _corner, event) => startStructureResize(id, event)
                    : undefined
                }
              />
            ) : (
              <PlantSprite
                key={`placement-${item.placement.id}`}
                placement={item.placement}
                scale={scale}
                selected={selectedPlacementId === item.placement.id}
                onSelect={(id) => {
                  onSelectPlacement?.(id);
                  onSelectStructure?.(null);
                }}
                onPointerDragStart={
                  dragEnabled
                    ? (id, event) => {
                        if (item.placement.locked) {
                          return;
                        }
                        event.stopPropagation();
                        const svg = svgRef.current;
                        if (!svg) {
                          return;
                        }
                        const handleMove = (moveEvent: PointerEvent) => {
                          const point = gardenPointFromClient(
                            svg,
                            moveEvent.clientX,
                            moveEvent.clientY,
                            scale,
                          );
                          onPlacementMove?.(id, point);
                        };
                        const handleUp = (upEvent: PointerEvent) => {
                          const point = gardenPointFromClient(
                            svg,
                            upEvent.clientX,
                            upEvent.clientY,
                            scale,
                          );
                          onPlacementMove?.(id, point);
                          window.removeEventListener("pointermove", handleMove);
                          window.removeEventListener("pointerup", handleUp);
                        };
                        window.addEventListener("pointermove", handleMove);
                        window.addEventListener("pointerup", handleUp);
                      }
                    : undefined
                }
              />
            ),
          )}
          {dropPreview ? (
            <circle
              cx={toSvgX(dropPreview.x, scale)}
              cy={toSvgY(dropPreview.y, scale)}
              r={dropPreview.spacing_radius * scale}
              className={dropPreview.valid ? "drop-preview-valid" : "drop-preview-invalid"}
              fill="none"
            />
          ) : null}
        </svg>
      </div>
    </div>
  );
}
