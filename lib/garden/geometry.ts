import type { GardenBounds, RectAreaInput } from "./types";

export interface Point {
  x: number;
  y: number;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function getCenter(area: RectAreaInput): Point {
  return {
    x: area.origin_x + area.length / 2,
    y: area.origin_y + area.width / 2,
  };
}

/** Corners of an axis-aligned rectangle before rotation. */
function getLocalCorners(area: RectAreaInput): Point[] {
  const { origin_x, origin_y, length, width } = area;
  return [
    { x: origin_x, y: origin_y },
    { x: origin_x + length, y: origin_y },
    { x: origin_x + length, y: origin_y + width },
    { x: origin_x, y: origin_y + width },
  ];
}

export function getRotatedCorners(area: RectAreaInput): Point[] {
  if (area.rotation_degrees === 0) {
    return getLocalCorners(area);
  }

  const center = getCenter(area);
  const angle = toRadians(area.rotation_degrees);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return getLocalCorners(area).map((corner) => {
    const dx = corner.x - center.x;
    const dy = corner.y - center.y;
    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos,
    };
  });
}

function aabbFromCorners(corners: Point[]) {
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function aabbOverlap(aMinX: number, aMaxX: number, aMinY: number, aMaxY: number, bMinX: number, bMaxX: number, bMinY: number, bMaxY: number): boolean {
  return aMinX < bMaxX && aMaxX > bMinX && aMinY < bMaxY && aMaxY > bMinY;
}

function projectPolygon(corners: Point[], axis: Point): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const corner of corners) {
    const projection = corner.x * axis.x + corner.y * axis.y;
    min = Math.min(min, projection);
    max = Math.max(max, projection);
  }
  return { min, max };
}

function getAxes(corners: Point[]): Point[] {
  const axes: Point[] = [];
  for (let i = 0; i < corners.length; i++) {
    const p1 = corners[i];
    const p2 = corners[(i + 1) % corners.length];
    const edge = { x: p2.x - p1.x, y: p2.y - p1.y };
    const normal = { x: -edge.y, y: edge.x };
    const length = Math.hypot(normal.x, normal.y);
    if (length > 0) {
      axes.push({ x: normal.x / length, y: normal.y / length });
    }
  }
  return axes;
}

export function obbOverlaps(a: RectAreaInput, b: RectAreaInput): boolean {
  const cornersA = getRotatedCorners(a);
  const cornersB = getRotatedCorners(b);
  const axes = [...getAxes(cornersA), ...getAxes(cornersB)];

  for (const axis of axes) {
    const projA = projectPolygon(cornersA, axis);
    const projB = projectPolygon(cornersB, axis);
    if (projA.max < projB.min || projB.max < projA.min) {
      return false;
    }
  }

  return true;
}

export function areasOverlap(a: RectAreaInput, b: RectAreaInput): boolean {
  if (a.rotation_degrees === 0 && b.rotation_degrees === 0) {
    const aabbA = aabbFromCorners(getLocalCorners(a));
    const aabbB = aabbFromCorners(getLocalCorners(b));
    return aabbOverlap(
      aabbA.minX,
      aabbA.maxX,
      aabbA.minY,
      aabbA.maxY,
      aabbB.minX,
      aabbB.maxX,
      aabbB.minY,
      aabbB.maxY,
    );
  }

  return obbOverlaps(a, b);
}

export function isWithinBounds(area: RectAreaInput, garden: GardenBounds): boolean {
  const corners = getRotatedCorners(area);
  return corners.every(
    (corner) =>
      corner.x >= 0 &&
      corner.x <= garden.length &&
      corner.y >= 0 &&
      corner.y <= garden.width,
  );
}

export function isPointInBed(x: number, y: number, bed: RectAreaInput): boolean {
  if (bed.rotation_degrees === 0) {
    return (
      x >= bed.origin_x &&
      x <= bed.origin_x + bed.length &&
      y >= bed.origin_y &&
      y <= bed.origin_y + bed.width
    );
  }

  const center = getCenter(bed);
  const angle = -toRadians(bed.rotation_degrees);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = x - center.x;
  const dy = y - center.y;
  const localX = center.x + dx * cos - dy * sin;
  const localY = center.y + dx * sin + dy * cos;

  return (
    localX >= bed.origin_x &&
    localX <= bed.origin_x + bed.length &&
    localY >= bed.origin_y &&
    localY <= bed.origin_y + bed.width
  );
}
