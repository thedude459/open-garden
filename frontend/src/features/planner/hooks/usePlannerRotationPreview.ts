import { useState } from "react";
import { Bed } from "../../types";

export type RotationPreview = {
  bedId: number;
  bedName: string;
  currentX: number;
  currentY: number;
  previewX: number;
  previewY: number;
  rotatedWidthFt: number;
  rotatedLengthFt: number;
  fitsCurrent: boolean;
  hasBedOverlap: boolean;
};

type UsePlannerRotationPreviewParams = {
  beds: Bed[];
  yardWidthFt: number;
  yardLengthFt: number;
  onRotateBed: (bedId: number, autoFit?: boolean) => Promise<void>;
};

export function usePlannerRotationPreview({
  beds,
  yardWidthFt,
  yardLengthFt,
  onRotateBed,
}: UsePlannerRotationPreviewParams) {
  const [pendingRotation, setPendingRotation] = useState<RotationPreview | null>(null);
  const [isApplyingRotation, setIsApplyingRotation] = useState(false);

  const requestRotatePreview = (bed: Bed) => {
    const rotatedWidthFt = Math.max(1, Math.ceil(bed.height_in / 12));
    const rotatedLengthFt = Math.max(1, Math.ceil(bed.width_in / 12));
    const fitsCurrent = bed.grid_x + rotatedWidthFt <= yardWidthFt && bed.grid_y + rotatedLengthFt <= yardLengthFt;
    const previewX = Math.min(Math.max(0, bed.grid_x), Math.max(0, yardWidthFt - rotatedWidthFt));
    const previewY = Math.min(Math.max(0, bed.grid_y), Math.max(0, yardLengthFt - rotatedLengthFt));
    const candidateX = fitsCurrent ? bed.grid_x : previewX;
    const candidateY = fitsCurrent ? bed.grid_y : previewY;
    const rotatedLeft = candidateX;
    const rotatedTop = candidateY;
    const rotatedRight = rotatedLeft + rotatedWidthFt;
    const rotatedBottom = rotatedTop + rotatedLengthFt;

    const hasBedOverlap = beds
      .filter((other) => other.id !== bed.id)
      .some((other) => {
        const otherWidthFt = Math.max(1, Math.ceil(other.width_in / 12));
        const otherLengthFt = Math.max(1, Math.ceil(other.height_in / 12));
        const otherLeft = other.grid_x;
        const otherTop = other.grid_y;
        const otherRight = otherLeft + otherWidthFt;
        const otherBottom = otherTop + otherLengthFt;
        return rotatedLeft < otherRight && rotatedRight > otherLeft && rotatedTop < otherBottom && rotatedBottom > otherTop;
      });

    setPendingRotation({
      bedId: bed.id,
      bedName: bed.name,
      currentX: bed.grid_x,
      currentY: bed.grid_y,
      previewX,
      previewY,
      rotatedWidthFt,
      rotatedLengthFt,
      fitsCurrent,
      hasBedOverlap,
    });
  };

  const confirmRotate = async (useAutoFit: boolean) => {
    if (!pendingRotation) {
      return;
    }
    setIsApplyingRotation(true);
    try {
      await onRotateBed(pendingRotation.bedId, useAutoFit);
      setPendingRotation(null);
    } finally {
      setIsApplyingRotation(false);
    }
  };

  return {
    pendingRotation,
    setPendingRotation,
    isApplyingRotation,
    requestRotatePreview,
    confirmRotate,
  };
}
