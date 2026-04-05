import { Garden, GardenSunPath } from "../../types";

export type SunVectorSample = {
  hourLocal: number;
  azimuthDeg: number;
  altitudeDeg: number;
  intensity: number;
  vectorX: number;
  vectorY: number;
};

export type SunExposureCell = {
  x: number;
  y: number;
  exposure: number;
};

const ORIENTATION_BIAS: Record<Garden["orientation"], { x: number; y: number }> = {
  north: { x: 0, y: 0.08 },
  east: { x: -0.08, y: 0 },
  south: { x: 0, y: -0.08 },
  west: { x: 0.08, y: 0 },
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function sampleSunVector(sunPath: GardenSunPath | null, hourLocal: number): SunVectorSample | null {
  if (!sunPath || sunPath.points.length === 0) {
    return null;
  }

  const sorted = [...sunPath.points].sort((a, b) => a.hour_local - b.hour_local);
  const left = sorted.reduce((best, point) => (point.hour_local <= hourLocal ? point : best), sorted[0]);
  const right = sorted.find((point) => point.hour_local >= hourLocal) || sorted[sorted.length - 1];

  const span = Math.max(1, right.hour_local - left.hour_local);
  const blend = clamp01((hourLocal - left.hour_local) / span);
  const azimuthDeg = left.azimuth_deg + (right.azimuth_deg - left.azimuth_deg) * blend;
  const altitudeDeg = left.altitude_deg + (right.altitude_deg - left.altitude_deg) * blend;
  const intensity = left.intensity + (right.intensity - left.intensity) * blend;

  const azimuthRad = (azimuthDeg * Math.PI) / 180;
  const vectorX = Math.sin(azimuthRad);
  const vectorY = -Math.cos(azimuthRad);

  return {
    hourLocal,
    azimuthDeg,
    altitudeDeg,
    intensity: clamp01(intensity),
    vectorX,
    vectorY,
  };
}

export function buildSunExposureGrid(
  yardWidthFt: number,
  yardLengthFt: number,
  sun: SunVectorSample | null,
  orientation: Garden["orientation"],
): SunExposureCell[] {
  const cells: SunExposureCell[] = [];
  const width = Math.max(1, Math.floor(yardWidthFt));
  const length = Math.max(1, Math.floor(yardLengthFt));
  const bias = ORIENTATION_BIAS[orientation];

  for (let y = 0; y < length; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = width <= 1 ? 0.5 : x / (width - 1);
      const ny = length <= 1 ? 0.5 : y / (length - 1);
      const centerX = nx - 0.5;
      const centerY = ny - 0.5;
      const directional = sun ? centerX * sun.vectorX * 0.32 + centerY * sun.vectorY * 0.32 : 0;
      const orientInfluence = centerX * bias.x + centerY * bias.y;
      const base = sun ? 0.35 + sun.intensity * 0.55 : 0.2;
      cells.push({
        x,
        y,
        exposure: clamp01(base + directional + orientInfluence),
      });
    }
  }

  return cells;
}
