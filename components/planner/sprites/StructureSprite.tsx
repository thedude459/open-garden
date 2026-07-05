"use client";

import type { PointerEvent } from "react";
import type { GardenStructure } from "@/lib/planner/types";
import { toSvgX, toSvgY } from "@/lib/planner/canvas-projection";

interface StructureSpriteProps {
  structure: GardenStructure;
  scale: number;
  selected?: boolean;
  onSelect?: (structureId: string) => void;
  onPointerDragStart?: (structureId: string, event: PointerEvent<SVGGElement>) => void;
  onResizeStart?: (
    structureId: string,
    corner: "se",
    event: PointerEvent<SVGCircleElement>,
  ) => void;
}

export function StructureSprite({
  structure,
  scale,
  selected = false,
  onSelect,
  onPointerDragStart,
  onResizeStart,
}: StructureSpriteProps) {
  const x = toSvgX(structure.origin_x, scale);
  const y = toSvgY(structure.origin_y, scale);
  const width = structure.length * scale;
  const height = structure.width * scale;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const label = `${structure.structure_type.name}${selected ? ", selected" : ""}${structure.locked ? ", locked" : ""}`;
  const rotation = structure.rotation_degrees ?? 0;
  const rotateTransform =
    rotation !== 0 ? ` rotate(${rotation} ${centerX} ${centerY})` : "";

  return (
    <g
      role="img"
      aria-label={label}
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      className={`structure-sprite${selected ? " selected" : ""}${structure.locked ? " locked" : ""}`}
      transform={rotateTransform || undefined}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.(structure.id);
      }}
      onPointerDown={(event) => {
        if (structure.locked) {
          return;
        }
        onPointerDragStart?.(structure.id, event);
      }}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        className="structure-bounds"
        fill="var(--planner-panel-bg)"
        stroke="var(--planner-accent-green)"
        strokeWidth={selected ? 2 : 1}
        opacity={0.92}
      />
      <image
        href={structure.structure_type.illustration_url}
        x={x}
        y={y}
        width={width}
        height={height}
        preserveAspectRatio="xMidYMid meet"
        pointerEvents="none"
      />
      {structure.locked ? (
        <text x={x + 6} y={y + 16} className="structure-lock-label" pointerEvents="none">
          🔒
        </text>
      ) : null}
      {selected && !structure.locked && onResizeStart ? (
        <circle
          cx={x + width}
          cy={y + height}
          r={6}
          className="structure-resize-handle"
          onPointerDown={(event) => {
            event.stopPropagation();
            onResizeStart(structure.id, "se", event);
          }}
        />
      ) : null}
    </g>
  );
}
