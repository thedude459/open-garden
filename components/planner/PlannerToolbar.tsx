"use client";

import type { GardenZoneType } from "@/lib/garden/enums";
import { zoneTypeLabel } from "@/lib/planner/zone-plants";

interface PlannerToolbarProps {
  planName: string;
  zoneType: GardenZoneType;
  zoom: number;
  saving?: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSave: () => void;
}

export function PlannerToolbar({
  planName,
  zoneType,
  zoom,
  saving = false,
  onZoomIn,
  onZoomOut,
  onSave,
}: PlannerToolbarProps) {
  return (
    <header className="planner-toolbar row" style={{ background: "var(--planner-toolbar-bg)" }}>
      <div className="planner-toolbar-title stack">
        <h1 className="planner-plan-name">{planName}</h1>
        <span className="zone-badge planner-zone-badge">{zoneTypeLabel(zoneType)}</span>
      </div>
      <div className="row planner-toolbar-actions">
        <button type="button" className="btn secondary" aria-label="Zoom out" onClick={onZoomOut}>
          −
        </button>
        <span className="field-label" aria-live="polite">
          {Math.round(zoom * 100)}%
        </span>
        <button type="button" className="btn secondary" aria-label="Zoom in" onClick={onZoomIn}>
          +
        </button>
        <button type="button" className="btn" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save plan"}
        </button>
      </div>
    </header>
  );
}
