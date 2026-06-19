"use client";

import { useEffect, useState } from "react";
import type { GardenDetail, ValidationViolation, ValidationWarning } from "@/lib/garden/types";

interface IndoorStartsPanelProps {
  garden: GardenDetail;
  transplantStartId: string | null;
  onTransplantStartSelect: (startId: string | null) => void;
  transplantPosition: { x: number; y: number } | null;
  onViolationsChange: (violations: ValidationViolation[]) => void;
  onWarningsChange: (warnings: ValidationWarning[]) => void;
  onGardenUpdate: (garden: GardenDetail) => void;
  onConflict: (garden: GardenDetail) => void;
}

export function IndoorStartsPanel({
  garden,
  transplantStartId,
  onTransplantStartSelect,
  transplantPosition,
  onViolationsChange,
  onWarningsChange,
  onGardenUpdate,
  onConflict,
}: IndoorStartsPanelProps) {
  const [transplantDate, setTransplantDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [transplanting, setTransplanting] = useState(false);

  const activeStarts = garden.indoor_starts.filter((start) => start.status === "active");
  const beds = garden.areas.filter((area) => area.area_type === "bed");
  const transplantStart = activeStarts.find((start) => start.id === transplantStartId) ?? null;

  useEffect(() => {
    async function preview() {
      if (!transplantStart || !transplantPosition || !transplantStart.target_bed_area_id) {
        onViolationsChange([]);
        onWarningsChange([]);
        return;
      }

      const response = await fetch(`/api/gardens/${garden.id}/validate-placement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bed_area_id: transplantStart.target_bed_area_id,
          plant_id: transplantStart.plant.id,
          plant_provenance: transplantStart.plant.provenance,
          position_x: transplantPosition.x,
          position_y: transplantPosition.y,
          planted_on: transplantDate,
          planting_context: "transplant",
        }),
      });

      if (!response.ok) {
        onViolationsChange([]);
        onWarningsChange([]);
        return;
      }

      const body = await response.json();
      onViolationsChange(body.violations ?? []);
      onWarningsChange(body.warnings ?? []);
    }

    void preview();
  }, [
    garden.id,
    transplantStart,
    transplantPosition,
    transplantDate,
    onViolationsChange,
    onWarningsChange,
  ]);

  async function handleReassign(startId: string, targetBedAreaId: string) {
    setError(null);
    setBusyId(startId);

    const response = await fetch(`/api/gardens/${garden.id}/indoor-starts/${startId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expected_version: garden.version,
        target_bed_area_id: targetBedAreaId || null,
      }),
    });

    setBusyId(null);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      if (body?.error === "conflict" && body.current) {
        onConflict(body.current);
        setError("Garden changed elsewhere — review the conflict dialog.");
      } else {
        setError(body?.error ?? "Failed to reassign target bed");
      }
      return;
    }

    onGardenUpdate((await response.json()) as GardenDetail);
  }

  async function handleCancel(startId: string) {
    if (!window.confirm("Cancel this indoor start?")) {
      return;
    }

    setError(null);
    setBusyId(startId);

    const response = await fetch(`/api/gardens/${garden.id}/indoor-starts/${startId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expected_version: garden.version }),
    });

    setBusyId(null);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      if (body?.error === "conflict" && body.current) {
        onConflict(body.current);
      } else {
        setError(body?.error ?? "Failed to cancel indoor start");
      }
      return;
    }

    if (transplantStartId === startId) {
      onTransplantStartSelect(null);
    }
    onGardenUpdate((await response.json()) as GardenDetail);
  }

  async function handleTransplant() {
    if (!transplantStartId || !transplantPosition) {
      setError("Select an indoor start and click the canvas to set transplant position.");
      return;
    }

    setError(null);
    setTransplanting(true);

    const response = await fetch(
      `/api/gardens/${garden.id}/indoor-starts/${transplantStartId}/transplant`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expected_version: garden.version,
          position_x: transplantPosition.x,
          position_y: transplantPosition.y,
          planted_on: transplantDate,
        }),
      },
    );

    setTransplanting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      if (body?.violations?.length) {
        onViolationsChange(body.violations);
      } else if (body?.error === "conflict" && body.current) {
        onConflict(body.current);
        setError("Garden changed elsewhere — review the conflict dialog.");
      } else {
        setError(body?.error ?? "Failed to transplant");
      }
      return;
    }

    const body = await response.json();
    onGardenUpdate(body.garden);
    onWarningsChange(body.warnings ?? []);
    onViolationsChange([]);
    onTransplantStartSelect(null);
  }

  return (
    <div className="stack card">
      <h2>Indoor starts</h2>
      <p className="field-label">
        Active starts appear here until transplanted. They do not occupy bed space until transplant.
      </p>
      {activeStarts.length === 0 ? (
        <p className="field-label">No active indoor starts.</p>
      ) : (
        <ul className="stack">
          {activeStarts.map((start) => (
            <li key={start.id} className="stack">
              <div className="row">
                <strong>{start.plant.common_name}</strong>
                <span className="field-label">Started {start.started_on}</span>
              </div>
              <label className="stack">
                Target bed
                <select
                  className="input"
                  value={start.target_bed_area_id ?? ""}
                  disabled={busyId === start.id}
                  onChange={(event) => void handleReassign(start.id, event.target.value)}
                >
                  <option value="">Unassigned</option>
                  {beds.map((bed) => (
                    <option key={bed.id} value={bed.id}>
                      {bed.name ?? "Bed"}
                    </option>
                  ))}
                </select>
              </label>
              <div className="row">
                <button
                  type="button"
                  className={`btn secondary${transplantStartId === start.id ? " selected" : ""}`}
                  disabled={!start.target_bed_area_id}
                  onClick={() =>
                    onTransplantStartSelect(transplantStartId === start.id ? null : start.id)
                  }
                >
                  {transplantStartId === start.id ? "Transplanting…" : "Transplant"}
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={busyId === start.id}
                  onClick={() => void handleCancel(start.id)}
                >
                  Cancel
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {transplantStart ? (
        <div className="stack">
          <p>
            Transplanting <strong>{transplantStart.plant.common_name}</strong> — click its target bed
            on the canvas to set position.
          </p>
          <label className="stack">
            Transplant date
            <input
              className="input"
              type="date"
              value={transplantDate}
              onChange={(event) => setTransplantDate(event.target.value)}
            />
          </label>
          {transplantPosition ? (
            <p className="field-label">
              Position: ({transplantPosition.x.toFixed(1)}, {transplantPosition.y.toFixed(1)}){" "}
              {garden.unit}
            </p>
          ) : (
            <p className="field-label">Click the target bed on the canvas.</p>
          )}
          <button
            type="button"
            className="btn"
            disabled={transplanting || !transplantPosition}
            onClick={() => void handleTransplant()}
          >
            {transplanting ? "Transplanting…" : "Confirm transplant"}
          </button>
        </div>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
