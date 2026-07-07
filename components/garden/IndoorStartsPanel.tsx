"use client";

import { useState } from "react";
import type { GardenDetail } from "@/lib/garden/types";

interface IndoorStartsPanelProps {
  garden: GardenDetail;
  transplantStartId: string | null;
  onTransplantStartSelect: (startId: string | null) => void;
  transplantDate: string;
  onTransplantDateChange: (date: string) => void;
  onGardenUpdate: (garden: GardenDetail) => void;
  onConflict: (garden: GardenDetail) => void;
}

export function IndoorStartsPanel({
  garden,
  transplantStartId,
  onTransplantStartSelect,
  transplantDate,
  onTransplantDateChange,
  onGardenUpdate,
  onConflict,
}: IndoorStartsPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const activeStarts = garden.indoor_starts.filter((start) => start.status === "active");
  const beds = garden.areas.filter((area) => area.area_type === "bed");
  const transplantStart = activeStarts.find((start) => start.id === transplantStartId) ?? null;

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
                  {transplantStartId === start.id ? "Click bed to transplant" : "Transplant"}
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
            on the canvas to place it.
          </p>
          <label className="stack">
            <span className="field-label">Transplant date</span>
            <input
              className="input"
              type="date"
              value={transplantDate}
              onChange={(event) => onTransplantDateChange(event.target.value)}
            />
          </label>
        </div>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
