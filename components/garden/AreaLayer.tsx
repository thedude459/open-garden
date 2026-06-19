"use client";

import { SOIL_CANVAS_ABBREV, SUN_CANVAS_ABBREV } from "@/lib/garden/enums";
import type { GardenArea } from "@/lib/garden/types";
import { toSvgX, toSvgY } from "./LayoutCanvas";

interface AreaShapesProps {
  areas: GardenArea[];
  scale: number;
}

export function AreaShapes({ areas, scale }: AreaShapesProps) {
  return (
    <>
      {areas.map((area) => {
        const x = toSvgX(area.origin_x, scale);
        const y = toSvgY(area.origin_y, scale);
        const width = area.length * scale;
        const height = area.width * scale;
        const labelParts: string[] = [];

        if (area.name) {
          labelParts.push(area.name);
        }
        if (area.soil_type) {
          labelParts.push(SOIL_CANVAS_ABBREV[area.soil_type]);
        }
        if (area.sun_exposure) {
          labelParts.push(SUN_CANVAS_ABBREV[area.sun_exposure]);
        }

        return (
          <g key={area.id}>
            <rect
              className={area.area_type === "bed" ? "garden-area-bed" : "garden-area-path"}
              x={x}
              y={y}
              width={width}
              height={height}
            />
            {(labelParts.length > 0 || area.area_type === "path") && (
              <text
                className={`garden-area-label${area.area_type === "path" ? " path-label" : ""}`}
                x={x + width / 2}
                y={y + height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {labelParts.join(" · ") || "Path"}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}
