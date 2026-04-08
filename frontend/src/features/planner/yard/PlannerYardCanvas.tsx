import { RefObject } from "react";
import { Bed } from "../../types";
import { RotationPreview } from "../hooks/usePlannerRotationPreview";
import { toFeet } from "../../app/utils/appUtils";

type SunExposureCell = { x: number; y: number; exposure: number };
type ShadeCell = { x: number; y: number; shade: number };
type CanopyPreview = {
  placementId: number;
  cropName: string;
  centerXFt: number;
  centerYFt: number;
  radiusFt: number;
  progress: number;
};

type PlannerYardCanvasProps = {
  yardGridRef: RefObject<HTMLDivElement>;
  yardWidthFt: number;
  yardLengthFt: number;
  yardCellPx: number;
  selectedBedId: number | null;
  beds: Bed[];
  placementBedId: number | null;
  resolveBedGridPosition: (bedId: number, clientX: number, clientY: number) => { nextX: number; nextY: number } | null;
  onMoveBedInYard: (bedId: number, x: number, y: number) => void | Promise<void>;
  onNudgeBed: (bedId: number, dx: number, dy: number) => void;
  requestRotatePreview: (bed: Bed) => void;
  showSunOverlay: boolean;
  showShadeOverlay: boolean;
  showGrowthPreview: boolean;
  sunExposure: SunExposureCell[];
  shadeMap: ShadeCell[];
  canopyPreview: CanopyPreview[];
  growthDayOffset: number;
  pendingRotation: RotationPreview | null;
};

export function PlannerYardCanvas({
  yardGridRef,
  yardWidthFt,
  yardLengthFt,
  yardCellPx,
  selectedBedId,
  beds,
  placementBedId,
  resolveBedGridPosition,
  onMoveBedInYard,
  onNudgeBed,
  requestRotatePreview,
  showSunOverlay,
  showShadeOverlay,
  showGrowthPreview,
  sunExposure,
  shadeMap,
  canopyPreview,
  growthDayOffset,
  pendingRotation,
}: PlannerYardCanvasProps) {
  return (
    <div className="yard-grid-wrap">
      <div
        className="yard-grid"
        ref={yardGridRef}
        style={{ width: yardWidthFt * yardCellPx, height: yardLengthFt * yardCellPx, backgroundSize: `${yardCellPx}px ${yardCellPx}px` }}
        onClick={(event) => {
          if (!selectedBedId) return;
          if (event.target instanceof HTMLElement && event.target.closest(".yard-bed")) return;
          const nextPosition = resolveBedGridPosition(selectedBedId, event.clientX, event.clientY);
          if (!nextPosition) return;
          onMoveBedInYard(selectedBedId, nextPosition.nextX, nextPosition.nextY);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const payloadRaw = event.dataTransfer.getData("application/json");
          if (!payloadRaw || !yardGridRef.current) return;
          const payload = JSON.parse(payloadRaw) as { bedId?: number };
          if (!payload.bedId) return;
          const bed = beds.find((item) => item.id === payload.bedId);
          if (!bed) return;
          const nextPosition = resolveBedGridPosition(payload.bedId, event.clientX, event.clientY);
          if (!nextPosition) return;
          onMoveBedInYard(payload.bedId, nextPosition.nextX, nextPosition.nextY);
        }}
      >
        {beds.length === 0 && (
          <div className="yard-empty-state" aria-hidden="true">
            <strong>No beds in the yard yet</strong>
            <span>Create a bed from the left panel, then drag or tap to place it here.</span>
          </div>
        )}
        {showSunOverlay && (
          <div className="yard-overlay-layer" aria-hidden="true">
            {sunExposure.map((cell) => (
              <span
                key={`sun-${cell.x}-${cell.y}`}
                className="yard-overlay-cell sun"
                style={{
                  left: cell.x * yardCellPx,
                  top: cell.y * yardCellPx,
                  width: yardCellPx,
                  height: yardCellPx,
                  opacity: Math.max(0.08, cell.exposure * 0.6),
                }}
              />
            ))}
          </div>
        )}
        {showShadeOverlay && (
          <div className="yard-overlay-layer" aria-hidden="true">
            {shadeMap.map((cell) => (
              <span
                key={`shade-${cell.x}-${cell.y}`}
                className="yard-overlay-cell shade"
                style={{
                  left: cell.x * yardCellPx,
                  top: cell.y * yardCellPx,
                  width: yardCellPx,
                  height: yardCellPx,
                  opacity: Math.max(0, cell.shade * 0.65),
                }}
              />
            ))}
          </div>
        )}
        {showGrowthPreview && (
          <div className="yard-overlay-layer" aria-hidden="true">
            {canopyPreview.map((canopy) => (
              <span
                key={`canopy-${canopy.placementId}`}
                className="yard-canopy"
                style={{
                  left: canopy.centerXFt * yardCellPx - canopy.radiusFt * yardCellPx,
                  top: canopy.centerYFt * yardCellPx - canopy.radiusFt * yardCellPx,
                  width: canopy.radiusFt * 2 * yardCellPx,
                  height: canopy.radiusFt * 2 * yardCellPx,
                  opacity: Math.max(0.2, canopy.progress * 0.5 + 0.2),
                }}
                title={`${canopy.cropName} canopy in ${growthDayOffset} days`}
              />
            ))}
          </div>
        )}
        {pendingRotation && (
          <div
            className={`yard-bed ghost${pendingRotation.fitsCurrent && !pendingRotation.hasBedOverlap ? "" : " conflict"}`}
            aria-hidden="true"
            style={{
              left: (pendingRotation.fitsCurrent ? pendingRotation.currentX : pendingRotation.previewX) * yardCellPx,
              top: (pendingRotation.fitsCurrent ? pendingRotation.currentY : pendingRotation.previewY) * yardCellPx,
              width: pendingRotation.rotatedWidthFt * yardCellPx,
              height: pendingRotation.rotatedLengthFt * yardCellPx,
            }}
          />
        )}
        {beds.map((bed) => {
          const bedWidthFt = Math.max(1, Math.ceil(bed.width_in / 12));
          const bedLengthFt = Math.max(1, Math.ceil(bed.height_in / 12));
          return (
            <div
              key={bed.id}
              className={`yard-bed${placementBedId && placementBedId !== bed.id ? " muted" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`${bed.name}, ${toFeet(bed.width_in)} by ${toFeet(bed.height_in)}. Use arrow keys to move.`}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("application/json", JSON.stringify({ bedId: bed.id }));
                event.dataTransfer.effectAllowed = "move";
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") { event.preventDefault(); onNudgeBed(bed.id, -1, 0); }
                else if (event.key === "ArrowRight") { event.preventDefault(); onNudgeBed(bed.id, 1, 0); }
                else if (event.key === "ArrowUp") { event.preventDefault(); onNudgeBed(bed.id, 0, -1); }
                else if (event.key === "ArrowDown") { event.preventDefault(); onNudgeBed(bed.id, 0, 1); }
                else if (event.key === "r" || event.key === "R") { event.preventDefault(); requestRotatePreview(bed); }
              }}
              style={{
                left: bed.grid_x * yardCellPx,
                top: bed.grid_y * yardCellPx,
                width: bedWidthFt * yardCellPx,
                height: bedLengthFt * yardCellPx,
              }}
            >
              <strong>{bed.name}</strong>
              <small>
                {toFeet(bed.width_in)} x {toFeet(bed.height_in)}
              </small>
            </div>
          );
        })}
      </div>
    </div>
  );
}
