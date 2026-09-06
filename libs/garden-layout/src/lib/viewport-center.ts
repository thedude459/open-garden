/** Plan-inch point at the center of the currently visible Overview. */
export function viewportCenterPlan(
  panX: number,
  panY: number,
  scale: number,
  viewportWidthPx: number,
  viewportHeightPx: number,
  pxPerInch: number,
): { x: number; y: number } {
  const inchesPerPx = 1 / (pxPerInch * scale);
  return {
    x: Math.round((-panX + viewportWidthPx / 2) * inchesPerPx),
    y: Math.round((-panY + viewportHeightPx / 2) * inchesPerPx),
  };
}
