import { Dispatch, SetStateAction } from "react";
import { Bed } from "../../types";
import { RotationPreview } from "../hooks/usePlannerRotationPreview";

type PlannerYardBedMoveControlsProps = {
  beds: Bed[];
  selectedBedId: number | null;
  setSelectedBedId: Dispatch<SetStateAction<number | null>>;
  onNudgeBed: (bedId: number, dx: number, dy: number) => void;
  requestRotatePreview: (bed: Bed) => void;
  pendingRotation: RotationPreview | null;
};

export function PlannerYardBedMoveControls({
  beds,
  selectedBedId,
  setSelectedBedId,
  onNudgeBed,
  requestRotatePreview,
  pendingRotation,
}: PlannerYardBedMoveControlsProps) {
  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Bed movement controls">
      {beds.map((bed) => (
        <div key={bed.id} className={`flex items-center gap-1.5${selectedBedId === bed.id ? " bg-muted rounded p-1" : ""}`}>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setSelectedBedId((current) => current === bed.id ? null : bed.id)}
          >
            {selectedBedId === bed.id ? `Placing: ${bed.name}` : `Select ${bed.name}`}
          </button>
          <button type="button" className="secondary-btn" onClick={() => onNudgeBed(bed.id, -1, 0)} aria-label={`Move ${bed.name} left`}>←</button>
          <button type="button" className="secondary-btn" onClick={() => onNudgeBed(bed.id, 0, -1)} aria-label={`Move ${bed.name} up`}>↑</button>
          <button type="button" className="secondary-btn" onClick={() => onNudgeBed(bed.id, 0, 1)} aria-label={`Move ${bed.name} down`}>↓</button>
          <button type="button" className="secondary-btn" onClick={() => onNudgeBed(bed.id, 1, 0)} aria-label={`Move ${bed.name} right`}>→</button>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => requestRotatePreview(bed)}
            aria-label={`Rotate ${bed.name}`}
            disabled={pendingRotation !== null}
          >
            ⟳
          </button>
        </div>
      ))}
    </div>
  );
}
