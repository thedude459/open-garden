"use client";

import type { GardenDetail } from "@/lib/garden/types";

interface ConflictDialogProps {
  open: boolean;
  current: GardenDetail | null;
  onUseRemote: () => void;
  onDismiss: () => void;
}

export function ConflictDialog({ open, current, onUseRemote, onDismiss }: ConflictDialogProps) {
  if (!open || !current) {
    return null;
  }

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="conflict-title">
      <div className="card stack dialog-panel">
        <h2 id="conflict-title">Garden changed elsewhere</h2>
        <p>
          Another session saved changes to <strong>{current.name}</strong> (version{" "}
          {current.version}). Review the latest version before saving again.
        </p>
        <p className="field-label">
          {current.areas.length} areas · {current.placements.length} plants · updated just now
        </p>
        <div className="row">
          <button className="btn" type="button" onClick={onUseRemote}>
            Use latest version
          </button>
          <button className="btn secondary" type="button" onClick={onDismiss}>
            Keep editing
          </button>
        </div>
      </div>
    </div>
  );
}
