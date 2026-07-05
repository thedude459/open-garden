"use client";

import type { PointerEvent } from "react";
import type { VisualPlantPlacement } from "@/lib/planner/types";
import { toSvgX, toSvgY } from "@/lib/planner/canvas-projection";

interface PlantSpriteProps {
  placement: VisualPlantPlacement;
  scale: number;
  selected?: boolean;
  invalid?: boolean;
  onSelect?: (placementId: string) => void;
  onPointerDragStart?: (placementId: string, event: PointerEvent<SVGGElement>) => void;
}

export function PlantSprite({
  placement,
  scale,
  selected = false,
  invalid = false,
  onSelect,
  onPointerDragStart,
}: PlantSpriteProps) {
  const cx = toSvgX(placement.position_x, scale);
  const cy = toSvgY(placement.position_y, scale);
  const radius = placement.spacing_radius * scale;
  const size = Math.max(radius * 1.6, 24);
  const isTreeCanopy = placement.spacing_radius > 2;
  const label = `${placement.plant.common_name}${selected ? ", selected" : ""}${placement.locked ? ", locked" : ""}`;

  return (
    <g
      role="img"
      aria-label={label}
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      className={`plant-sprite${selected ? " selected" : ""}${invalid ? " invalid" : ""}${isTreeCanopy ? " tree-canopy" : ""}${placement.locked ? " locked" : ""}`}
      transform={`translate(${cx - size / 2}, ${cy - size})`}
      onClick={() => onSelect?.(placement.id)}
      onPointerDown={(event) => {
        if (!placement.locked) {
          onPointerDragStart?.(placement.id, event);
        }
      }}
    >
      <image
        href={placement.illustration_url}
        width={size}
        height={size}
        preserveAspectRatio="xMidYMax meet"
      />
      <circle
        cx={size / 2}
        cy={size}
        r={radius}
        className="plant-footprint"
        fill="none"
      />
      {selected ? <circle cx={size / 2} cy={size / 2} r={size / 2 + 4} className="plant-halo" /> : null}
    </g>
  );
}
