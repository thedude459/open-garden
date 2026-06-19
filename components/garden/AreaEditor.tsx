"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  BED_SUN_EXPOSURES,
  SOIL_TYPE_GROUPS,
  type BedSunExposure,
  type GardenAreaType,
  type SoilType,
} from "@/lib/garden/enums";
import type { GardenArea, GardenDetail } from "@/lib/garden/types";

export interface AreaDraft {
  area_type: GardenAreaType;
  name: string;
  origin_x: number;
  origin_y: number;
  length: number;
  width: number;
  soil_type: SoilType | "";
  sun_exposure: BedSunExposure | "";
}

const defaultDraft: AreaDraft = {
  area_type: "bed",
  name: "",
  origin_x: 1,
  origin_y: 1,
  length: 4,
  width: 2,
  soil_type: "",
  sun_exposure: "",
};

function areaToDraft(area: GardenArea): AreaDraft {
  return {
    area_type: area.area_type,
    name: area.name ?? "",
    origin_x: area.origin_x,
    origin_y: area.origin_y,
    length: area.length,
    width: area.width,
    soil_type: area.soil_type ?? "",
    sun_exposure: area.sun_exposure ?? "",
  };
}

interface AreaEditorProps {
  unit: string;
  gardenId: string;
  gardenVersion: number;
  areas: GardenArea[];
  onPreviewChange: (draft: AreaDraft | null) => void;
  onGardenUpdate: (garden: GardenDetail) => void;
  onConflict: (current: GardenDetail) => void;
  onShrinkConflict: (affectedPlacementIds: string[], retry: () => Promise<void>) => void;
}

export function AreaEditor({
  unit,
  gardenId,
  gardenVersion,
  areas,
  onPreviewChange,
  onGardenUpdate,
  onConflict,
  onShrinkConflict,
}: AreaEditorProps) {
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingAreaId, setEditingAreaId] = useState<string>("");
  const [draft, setDraft] = useState<AreaDraft>(defaultDraft);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    onPreviewChange(mode === "create" ? draft : null);
  }, [draft, mode, onPreviewChange]);

  function updateDraft(partial: Partial<AreaDraft>) {
    setDraft((current) => {
      const next = { ...current, ...partial };
      if (partial.area_type === "path") {
        next.soil_type = "";
        next.sun_exposure = "";
      }
      return next;
    });
  }

  function startEdit(areaId: string) {
    const area = areas.find((item) => item.id === areaId);
    if (!area) {
      return;
    }
    setMode("edit");
    setEditingAreaId(areaId);
    setDraft(areaToDraft(area));
    setError(null);
  }

  function startCreate() {
    setMode("create");
    setEditingAreaId("");
    setDraft(defaultDraft);
    setError(null);
  }

  async function submitArea(evictAffected = false) {
    setError(null);
    setSubmitting(true);

    const payload = {
      expected_version: gardenVersion,
      area_type: draft.area_type,
      name: draft.name || null,
      origin_x: draft.origin_x,
      origin_y: draft.origin_y,
      length: draft.length,
      width: draft.width,
      rotation_degrees: 0,
      soil_type: draft.soil_type || null,
      sun_exposure: draft.sun_exposure || null,
      evict_affected_placements: evictAffected || undefined,
    };

    const response = await fetch(
      mode === "create"
        ? `/api/gardens/${gardenId}/areas`
        : `/api/gardens/${gardenId}/areas/${editingAreaId}`,
      {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    setSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      if (body?.error === "conflict" && body.current) {
        onConflict(body.current);
        return;
      }
      if (body?.error === "placement_eviction_required" && body.affected_placement_ids?.length) {
        onShrinkConflict(body.affected_placement_ids, () => submitArea(true));
        return;
      }
      if (body?.violations?.length) {
        setError(body.violations.map((v: { message: string }) => v.message).join("; "));
      } else {
        setError(body?.error ?? "Failed to save area");
      }
      return;
    }

    onGardenUpdate((await response.json()) as GardenDetail);
    if (mode === "create") {
      setDraft(defaultDraft);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitArea(false);
  }

  async function handleDelete() {
    if (!editingAreaId) {
      return;
    }
    const area = areas.find((item) => item.id === editingAreaId);
    if (
      !window.confirm(
        `Delete ${area?.name ?? area?.area_type ?? "this area"}? Plant placements in this bed will be removed.`,
      )
    ) {
      return;
    }

    setError(null);
    setSubmitting(true);

    const response = await fetch(`/api/gardens/${gardenId}/areas/${editingAreaId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expected_version: gardenVersion, confirm: true }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      if (body?.error === "conflict" && body.current) {
        onConflict(body.current);
        return;
      }
      setError(body?.error ?? "Failed to delete area");
      return;
    }

    onGardenUpdate((await response.json()) as GardenDetail);
    startCreate();
  }

  return (
    <div className="stack card">
      <div className="row">
        <h2>{mode === "create" ? "Add area" : "Edit area"}</h2>
        {mode === "edit" ? (
          <button className="btn secondary" type="button" onClick={startCreate}>
            New area
          </button>
        ) : null}
      </div>
      {areas.length > 0 ? (
        <label className="stack">
          Edit existing
          <select
            className="input"
            value={mode === "edit" ? editingAreaId : ""}
            onChange={(event) => {
              if (event.target.value) {
                startEdit(event.target.value);
              } else {
                startCreate();
              }
            }}
          >
            <option value="">Create new…</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name ?? (area.area_type === "bed" ? "Bed" : "Path")} ({area.area_type})
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <form className="stack" onSubmit={handleSubmit}>
        <div className="row">
          <label className="stack">
            Type
            <select
              className="input"
              value={draft.area_type}
              onChange={(event) => updateDraft({ area_type: event.target.value as GardenAreaType })}
            >
              <option value="bed">Plantable bed</option>
              <option value="path">Walking path</option>
            </select>
          </label>
          <label className="stack">
            Name (optional)
            <input
              className="input"
              value={draft.name}
              onChange={(event) => updateDraft({ name: event.target.value })}
              maxLength={128}
            />
          </label>
        </div>
        <div className="row">
          <label className="stack">
            Origin X ({unit})
            <input
              className="input"
              type="number"
              min="0"
              step="0.1"
              value={draft.origin_x}
              onChange={(event) => updateDraft({ origin_x: Number(event.target.value) })}
              required
            />
          </label>
          <label className="stack">
            Origin Y ({unit})
            <input
              className="input"
              type="number"
              min="0"
              step="0.1"
              value={draft.origin_y}
              onChange={(event) => updateDraft({ origin_y: Number(event.target.value) })}
              required
            />
          </label>
        </div>
        <div className="row">
          <label className="stack">
            Length ({unit})
            <input
              className="input"
              type="number"
              min="0.1"
              step="0.1"
              value={draft.length}
              onChange={(event) => updateDraft({ length: Number(event.target.value) })}
              required
            />
          </label>
          <label className="stack">
            Width ({unit})
            <input
              className="input"
              type="number"
              min="0.1"
              step="0.1"
              value={draft.width}
              onChange={(event) => updateDraft({ width: Number(event.target.value) })}
              required
            />
          </label>
        </div>
        {draft.area_type === "bed" ? (
          <>
            <label className="stack">
              Soil type (optional)
              <select
                className="input"
                value={draft.soil_type}
                onChange={(event) =>
                  updateDraft({ soil_type: event.target.value as SoilType | "" })
                }
              >
                <option value="">Not set</option>
                {Object.entries(SOIL_TYPE_GROUPS).map(([group, types]) => (
                  <optgroup key={group} label={group.replace("-", " ")}>
                    {types.map((soilType) => (
                      <option key={soilType} value={soilType}>
                        {soilType.replaceAll("_", " ")}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="stack">
              Sun exposure (optional)
              <select
                className="input"
                value={draft.sun_exposure}
                onChange={(event) =>
                  updateDraft({ sun_exposure: event.target.value as BedSunExposure | "" })
                }
              >
                <option value="">Not set</option>
                {BED_SUN_EXPOSURES.map((exposure) => (
                  <option key={exposure} value={exposure}>
                    {exposure.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
        {error ? <p role="alert">{error}</p> : null}
        <div className="row">
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? "Saving…" : mode === "create" ? `Add ${draft.area_type}` : "Save changes"}
          </button>
          {mode === "edit" ? (
            <button className="btn secondary" type="button" disabled={submitting} onClick={() => void handleDelete()}>
              Delete area
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
