/** Origin so the rectangle center sits at the mapped plan point (Create / first-place). */
export function originFromCenter(
  centerX: number,
  centerY: number,
  length: number,
  width: number,
): { originXInches: number; originYInches: number } {
  return {
    originXInches: Math.round(centerX - length / 2),
    originYInches: Math.round(centerY - width / 2),
  };
}

/** Origin so the grabbed plan point stays under the pointer (move, no center-snap). */
export function originFromGrabOffset(
  originX: number,
  originY: number,
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
): { originXInches: number; originYInches: number } {
  return {
    originXInches: Math.round(originX + (currentX - startX)),
    originYInches: Math.round(originY + (currentY - startY)),
  };
}
