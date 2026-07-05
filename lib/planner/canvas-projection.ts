export const CANVAS_PADDING = 16;
export const MAX_CANVAS_WIDTH = 840;
export const MAX_CANVAS_HEIGHT = 520;

export function layoutScale(gardenLength: number, gardenWidth: number): number {
  const innerWidth = MAX_CANVAS_WIDTH - CANVAS_PADDING * 2;
  const innerHeight = MAX_CANVAS_HEIGHT - CANVAS_PADDING * 2;
  return Math.min(innerWidth / gardenLength, innerHeight / gardenWidth);
}

export function toSvgX(value: number, scale: number): number {
  return CANVAS_PADDING + value * scale;
}

export function toSvgY(value: number, scale: number): number {
  return CANVAS_PADDING + value * scale;
}

export function gardenPointFromSvg(svgX: number, svgY: number, scale: number): { x: number; y: number } {
  return {
    x: (svgX - CANVAS_PADDING) / scale,
    y: (svgY - CANVAS_PADDING) / scale,
  };
}

export function gardenPointFromClient(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
  scale: number,
): { x: number; y: number } {
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const transformed = point.matrixTransform(svg.getScreenCTM()?.inverse());
  return gardenPointFromSvg(transformed.x, transformed.y, scale);
}

export function svgDimensions(gardenLength: number, gardenWidth: number, scale: number) {
  return {
    width: gardenLength * scale + CANVAS_PADDING * 2,
    height: gardenWidth * scale + CANVAS_PADDING * 2,
  };
}
