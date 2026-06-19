"use client";

import type { PlantPlacement } from "@/lib/garden/types";
import { toSvgX, toSvgY } from "./LayoutCanvas";

interface PlacementLayerProps {
  placements: PlantPlacement[];
  scale: number;
  candidate?: {
    position_x: number;
    position_y: number;
    spacing_radius: number;
    label?: string;
  } | null;
}

export function PlacementLayer({ placements, scale, candidate }: PlacementLayerProps) {
  return (
    <>
      {placements.map((placement) => (
        <g key={placement.id}>
          <circle
            className="plant-footprint"
            cx={toSvgX(placement.position_x, scale)}
            cy={toSvgY(placement.position_y, scale)}
            r={Math.max(placement.spacing_radius * scale, 4)}
          />
          <text
            className="plant-footprint-label"
            x={toSvgX(placement.position_x, scale)}
            y={toSvgY(placement.position_y, scale)}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {placement.plant.common_name}
          </text>
        </g>
      ))}
      {candidate ? (
        <g>
          <circle
            className="plant-footprint candidate"
            cx={toSvgX(candidate.position_x, scale)}
            cy={toSvgY(candidate.position_y, scale)}
            r={Math.max(candidate.spacing_radius * scale, 4)}
          />
          {candidate.label ? (
            <text
              className="plant-footprint-label candidate"
              x={toSvgX(candidate.position_x, scale)}
              y={toSvgY(candidate.position_y, scale)}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {candidate.label}
            </text>
          ) : null}
        </g>
      ) : null}
    </>
  );
}
