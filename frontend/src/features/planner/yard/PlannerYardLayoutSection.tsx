import { Dispatch, RefObject, SetStateAction } from "react";
import { Bed, GardenSunPath } from "../../types";
import { RotationPreview } from "../hooks/usePlannerRotationPreview";
import { PlannerYardSizeForm } from "./PlannerYardSizeForm";
import { PlannerYardBedMoveControls } from "./PlannerYardBedMoveControls";
import { PlannerYardOverlayControls } from "./PlannerYardOverlayControls";
import { PlannerYardCanvas } from "./PlannerYardCanvas";

type SunSample = {
  hourLocal: number;
  azimuthDeg: number;
  altitudeDeg: number;
};

type SunExposureCell = {
  x: number;
  y: number;
  exposure: number;
};

type ShadeCell = {
  x: number;
  y: number;
  shade: number;
};

type CanopyPreview = {
  placementId: number;
  cropName: string;
  centerXFt: number;
  centerYFt: number;
  radiusFt: number;
  progress: number;
};

type PlannerYardLayoutSectionProps = {
  gardenSatelliteUrl?: string;
  isLoadingSunPath: boolean;
  sunSample: SunSample | null;
  yardWidthDraft: number;
  yardLengthDraft: number;
  yardErrors: { yard_width_ft: string; yard_length_ft: string };
  onYardWidthDraftChange: (value: number) => void;
  onYardLengthDraftChange: (value: number) => void;
  onUpdateYardSize: (event: React.FormEvent<HTMLFormElement>) => void;
  beds: Bed[];
  selectedBedId: number | null;
  setSelectedBedId: Dispatch<SetStateAction<number | null>>;
  onNudgeBed: (bedId: number, dx: number, dy: number) => void;
  requestRotatePreview: (bed: Bed) => void;
  pendingRotation: RotationPreview | null;
  setPendingRotation: Dispatch<SetStateAction<RotationPreview | null>>;
  confirmRotate: (autoFit: boolean) => Promise<void>;
  isApplyingRotation: boolean;
  showSunOverlay: boolean;
  showShadeOverlay: boolean;
  showGrowthPreview: boolean;
  setShowSunOverlay: Dispatch<SetStateAction<boolean>>;
  setShowShadeOverlay: Dispatch<SetStateAction<boolean>>;
  setShowGrowthPreview: Dispatch<SetStateAction<boolean>>;
  setOverlayPreset: (preset: "layout" | "sun" | "shade" | "growth") => void;
  gardenSunPath: GardenSunPath | null;
  sunHour: number;
  setSunHour: Dispatch<SetStateAction<number>>;
  growthDayOffset: number;
  setGrowthDayOffset: Dispatch<SetStateAction<number>>;
  sunExposure: SunExposureCell[];
  shadeMap: ShadeCell[];
  canopyPreview: CanopyPreview[];
  yardGridRef: RefObject<HTMLDivElement>;
  yardWidthFt: number;
  yardLengthFt: number;
  yardCellPx: number;
  resolveBedGridPosition: (bedId: number, clientX: number, clientY: number) => { nextX: number; nextY: number } | null;
  onMoveBedInYard: (bedId: number, x: number, y: number) => void | Promise<void>;
  placementBedId: number | null;
};

export function PlannerYardLayoutSection({
  gardenSatelliteUrl,
  isLoadingSunPath,
  sunSample,
  yardWidthDraft,
  yardLengthDraft,
  yardErrors,
  onYardWidthDraftChange,
  onYardLengthDraftChange,
  onUpdateYardSize,
  beds,
  selectedBedId,
  setSelectedBedId,
  onNudgeBed,
  requestRotatePreview,
  pendingRotation,
  setPendingRotation,
  confirmRotate,
  isApplyingRotation,
  showSunOverlay,
  showShadeOverlay,
  showGrowthPreview,
  setShowSunOverlay,
  setShowShadeOverlay,
  setShowGrowthPreview,
  setOverlayPreset,
  gardenSunPath,
  sunHour,
  setSunHour,
  growthDayOffset,
  setGrowthDayOffset,
  sunExposure,
  shadeMap,
  canopyPreview,
  yardGridRef,
  yardWidthFt,
  yardLengthFt,
  yardCellPx,
  resolveBedGridPosition,
  onMoveBedInYard,
  placementBedId,
}: PlannerYardLayoutSectionProps) {
  return (
    <section className="planner-panel planner-yard-panel">
      <div className="planner-yard-header">
        <div>
          <div className="planner-yard-title-row">
            <h3>Yard Layout</h3>
            {gardenSatelliteUrl && (
              <a href={gardenSatelliteUrl} target="_blank" rel="noopener noreferrer" className="map-ref-link">
                Satellite view ↗
              </a>
            )}
          </div>
          <p className="hint">Drag beds into the yard and resize the yard as you refine the plan.</p>
          <p className="hint">Touch move beds: choose a bed below, then tap in the yard to place it, or use the arrow controls for one-cell nudges.</p>
          {isLoadingSunPath && <p className="hint">Loading sun-path model...</p>}
          {sunSample && (
            <p className="hint">
              Sun sample: {sunSample.hourLocal}:00 &middot; az {sunSample.azimuthDeg.toFixed(0)}&deg; &middot; alt {sunSample.altitudeDeg.toFixed(0)}&deg;
            </p>
          )}
        </div>
        <PlannerYardSizeForm
          yardWidthDraft={yardWidthDraft}
          yardLengthDraft={yardLengthDraft}
          yardErrors={yardErrors}
          onYardWidthDraftChange={onYardWidthDraftChange}
          onYardLengthDraftChange={onYardLengthDraftChange}
          onUpdateYardSize={onUpdateYardSize}
        />
      </div>

      <PlannerYardBedMoveControls
        beds={beds}
        selectedBedId={selectedBedId}
        setSelectedBedId={setSelectedBedId}
        onNudgeBed={onNudgeBed}
        requestRotatePreview={requestRotatePreview}
        pendingRotation={pendingRotation}
      />

      {pendingRotation && (
        <div className={`planner-selection-banner${pendingRotation.hasBedOverlap ? " blocked" : ""}`} role="status" aria-live="polite">
          <span>
            Rotate <strong>{pendingRotation.bedName}</strong> to {pendingRotation.rotatedWidthFt} x {pendingRotation.rotatedLengthFt} ft.
            {!pendingRotation.fitsCurrent && " Current spot is out of bounds after rotate."}
            {pendingRotation.hasBedOverlap && " Rotation would overlap another bed in the yard."}
          </span>
          <div className="panel-actions">
            <button type="button" className="secondary-btn" onClick={() => setPendingRotation(null)} disabled={isApplyingRotation}>Cancel</button>
            {!pendingRotation.fitsCurrent && !pendingRotation.hasBedOverlap && (
              <button type="button" className="secondary-btn" onClick={() => confirmRotate(true)} disabled={isApplyingRotation}>Auto-fit rotate</button>
            )}
            <button type="button" onClick={() => confirmRotate(false)} disabled={isApplyingRotation || pendingRotation.hasBedOverlap || !pendingRotation.fitsCurrent}>
              {isApplyingRotation ? "Rotating..." : "Rotate now"}
            </button>
          </div>
        </div>
      )}

      <PlannerYardOverlayControls
        showSunOverlay={showSunOverlay}
        showShadeOverlay={showShadeOverlay}
        showGrowthPreview={showGrowthPreview}
        setShowSunOverlay={setShowSunOverlay}
        setShowShadeOverlay={setShowShadeOverlay}
        setShowGrowthPreview={setShowGrowthPreview}
        setOverlayPreset={setOverlayPreset}
        gardenSunPath={gardenSunPath}
        sunHour={sunHour}
        setSunHour={setSunHour}
        growthDayOffset={growthDayOffset}
        setGrowthDayOffset={setGrowthDayOffset}
      />

      <PlannerYardCanvas
        yardGridRef={yardGridRef}
        yardWidthFt={yardWidthFt}
        yardLengthFt={yardLengthFt}
        yardCellPx={yardCellPx}
        selectedBedId={selectedBedId}
        beds={beds}
        placementBedId={placementBedId}
        resolveBedGridPosition={resolveBedGridPosition}
        onMoveBedInYard={onMoveBedInYard}
        onNudgeBed={onNudgeBed}
        requestRotatePreview={requestRotatePreview}
        showSunOverlay={showSunOverlay}
        showShadeOverlay={showShadeOverlay}
        showGrowthPreview={showGrowthPreview}
        sunExposure={sunExposure}
        shadeMap={shadeMap}
        canopyPreview={canopyPreview}
        growthDayOffset={growthDayOffset}
        pendingRotation={pendingRotation}
      />
    </section>
  );
}
