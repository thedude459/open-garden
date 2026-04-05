import { Bed } from "../../types";

type BedGridPositionParams = {
  bedId: number;
  clientX: number;
  clientY: number;
  beds: Bed[];
  yardRect: DOMRect;
  yardCellPx: number;
  yardWidthFt: number;
  yardLengthFt: number;
};

export function getBedGridPositionForPoint({
  bedId,
  clientX,
  clientY,
  beds,
  yardRect,
  yardCellPx,
  yardWidthFt,
  yardLengthFt,
}: BedGridPositionParams) {
  const bed = beds.find((item) => item.id === bedId);
  if (!bed) {
    return null;
  }

  const bedWidthFt = Math.max(1, Math.ceil(bed.width_in / 12));
  const bedLengthFt = Math.max(1, Math.ceil(bed.height_in / 12));
  const rawX = (clientX - yardRect.left) / yardCellPx - bedWidthFt / 2;
  const rawY = (clientY - yardRect.top) / yardCellPx - bedLengthFt / 2;
  const maxX = Math.max(0, yardWidthFt - bedWidthFt);
  const maxY = Math.max(0, yardLengthFt - bedLengthFt);

  return {
    nextX: Math.min(maxX, Math.max(0, Math.round(rawX))),
    nextY: Math.min(maxY, Math.max(0, Math.round(rawY))),
  };
}
