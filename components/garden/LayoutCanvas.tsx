"use client";

import type { MouseEvent, RefObject } from "react";
import type { GardenArea, PlantPlacement } from "@/lib/garden/types";
import { AreaShapes } from "./AreaLayer";
import { PlacementLayer } from "./PlacementLayer";

const CANVAS_PADDING = 16;
const MAX_CANVAS_WIDTH = 840;
const MAX_CANVAS_HEIGHT = 520;

export interface LayoutCanvasProps {
  gardenLength: number;
  gardenWidth: number;
  unit: string;
  areas: GardenArea[];
  placements?: PlantPlacement[];
  previewArea?: Pick<GardenArea, "origin_x" | "origin_y" | "length" | "width" | "area_type"> | null;
  candidatePlacement?: {
    position_x: number;
    position_y: number;
    spacing_radius: number;
    label?: string;
  } | null;
  placementMode?: boolean;
  onCanvasClick?: (position: { x: number; y: number }) => void;
  svgRef?: RefObject<SVGSVGElement | null>;
}

export function layoutScale(gardenLength: number, gardenWidth: number) {
  const innerWidth = MAX_CANVAS_WIDTH - CANVAS_PADDING * 2;
  const innerHeight = MAX_CANVAS_HEIGHT - CANVAS_PADDING * 2;
  return Math.min(innerWidth / gardenLength, innerHeight / gardenWidth);
}

export function toSvgX(value: number, scale: number) {
  return CANVAS_PADDING + value * scale;
}

export function toSvgY(value: number, scale: number) {
  return CANVAS_PADDING + value * scale;
}

function gardenPointFromEvent(
  event: MouseEvent<SVGSVGElement>,
  scale: number,
): { x: number; y: number } {
  const svg = event.currentTarget;
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const transformed = point.matrixTransform(svg.getScreenCTM()?.inverse());
  return {
    x: (transformed.x - CANVAS_PADDING) / scale,
    y: (transformed.y - CANVAS_PADDING) / scale,
  };
}

export function LayoutCanvas({
  gardenLength,
  gardenWidth,
  unit,
  areas,
  placements = [],
  previewArea,
  candidatePlacement,
  placementMode = false,
  onCanvasClick,
  svgRef,
}: LayoutCanvasProps) {
  const scale = layoutScale(gardenLength, gardenWidth);
  const svgWidth = gardenLength * scale + CANVAS_PADDING * 2;
  const svgHeight = gardenWidth * scale + CANVAS_PADDING * 2;

  function handleClick(event: MouseEvent<SVGSVGElement>) {
    if (!placementMode || !onCanvasClick) {
      return;
    }
    onCanvasClick(gardenPointFromEvent(event, scale));
  }

  return (
    <div className="layout-canvas-wrap card">
      <svg
        ref={svgRef}
        className={`layout-canvas${placementMode ? " interactive" : ""}`}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        width="100%"
        height={svgHeight}
        role="img"
        aria-label={`Garden layout ${gardenLength} by ${gardenWidth} ${unit}`}
        onClick={handleClick}
      >
        <rect
          className="garden-boundary"
          x={CANVAS_PADDING}
          y={CANVAS_PADDING}
          width={gardenLength * scale}
          height={gardenWidth * scale}
        />
        <AreaShapes areas={areas} scale={scale} />
        <PlacementLayer
          placements={placements}
          scale={scale}
          candidate={candidatePlacement}
        />
        {previewArea ? (
          <rect
            className={
              previewArea.area_type === "bed" ? "garden-area-preview-bed" : "garden-area-preview-path"
            }
            x={toSvgX(previewArea.origin_x, scale)}
            y={toSvgY(previewArea.origin_y, scale)}
            width={previewArea.length * scale}
            height={previewArea.width * scale}
          />
        ) : null}
      </svg>
    </div>
  );
}
