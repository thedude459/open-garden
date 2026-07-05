"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { GardenDetail } from "@/lib/garden/types";
import type { GardenZoneType } from "@/lib/garden/enums";
import { GARDEN_ZONE_TYPES } from "@/lib/garden/enums";
import { zoneTypeLabel } from "@/lib/planner/zone-plants";

interface GardenSettingsPanelProps {
  garden: GardenDetail;
  onGardenUpdate: (garden: GardenDetail) => void;
  onConflict: (current: GardenDetail) => void;
  onShrinkConflict: (affectedPlacementIds: string[], retry: () => Promise<void>) => void;
  onZoneChangeConflict?: (
    conflicts: Array<{ placement_id: string; message: string }>,
    retry: () => Promise<void>,
  ) => void;
}

export function GardenSettingsPanel({
  garden,
  onGardenUpdate,
  onConflict,
  onShrinkConflict,
  onZoneChangeConflict,
}: GardenSettingsPanelProps) {
  const router = useRouter();
  const [name, setName] = useState(garden.name);
  const [length, setLength] = useState(garden.length);
  const [width, setWidth] = useState(garden.width);
  const [description, setDescription] = useState(garden.description ?? "");
  const [zoneType, setZoneType] = useState<GardenZoneType>(garden.zone_type ?? "vegetable_garden");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setName(garden.name);
    setLength(garden.length);
    setWidth(garden.width);
    setDescription(garden.description ?? "");
    setZoneType(garden.zone_type ?? "vegetable_garden");
  }, [garden.id, garden.version, garden.name, garden.length, garden.width, garden.description, garden.zone_type]);

  async function saveGarden(evictAffected = false, confirmZoneChange = false) {
    setError(null);
    setSubmitting(true);

    const response = await fetch(`/api/gardens/${garden.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expected_version: garden.version,
        name,
        length,
        width,
        description: description || null,
        zone_type: zoneType,
        evict_affected_placements: evictAffected || undefined,
        confirm_zone_change: confirmZoneChange || undefined,
      }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      if (body?.error === "conflict" && body.current) {
        onConflict(body.current);
        return;
      }
      if (body?.error === "placement_eviction_required" && body.affected_placement_ids?.length) {
        onShrinkConflict(body.affected_placement_ids, () => saveGarden(true));
        return;
      }
      if (body?.error === "zone_change_conflicts" && body.conflicts?.length) {
        if (onZoneChangeConflict) {
          onZoneChangeConflict(body.conflicts, () => saveGarden(evictAffected, true));
        } else if (
          window.confirm(
            `${body.conflicts.length} placement(s) are incompatible with the new zone type. Remove them and continue?`,
          )
        ) {
          await saveGarden(evictAffected, true);
        }
        return;
      }
      if (body?.violations?.length) {
        setError(body.violations.map((v: { message: string }) => v.message).join("; "));
      } else {
        setError(body?.error ?? "Failed to update garden");
      }
      return;
    }

    onGardenUpdate((await response.json()) as GardenDetail);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveGarden(false);
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete "${garden.name}"? All beds, paths, and plant placements will be removed.`,
      )
    ) {
      return;
    }

    setDeleting(true);
    setError(null);

    const response = await fetch(`/api/gardens/${garden.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expected_version: garden.version }),
    });

    setDeleting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      if (body?.error === "conflict" && body.current) {
        onConflict(body.current);
        return;
      }
      setError(body?.error ?? "Failed to delete garden");
      return;
    }

    router.push("/gardens");
    router.refresh();
  }

  return (
    <form className="stack card" onSubmit={handleSubmit}>
      <h2>Garden settings</h2>
      <label className="stack">
        Name
        <input className="input" value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <div className="row">
        <label className="stack">
          Length ({garden.unit})
          <input
            className="input"
            type="number"
            min="0.01"
            step="0.1"
            value={length}
            onChange={(event) => setLength(Number(event.target.value))}
            required
          />
        </label>
        <label className="stack">
          Width ({garden.unit})
          <input
            className="input"
            type="number"
            min="0.01"
            step="0.1"
            value={width}
            onChange={(event) => setWidth(Number(event.target.value))}
            required
          />
        </label>
      </div>
      <label className="stack">
        Growing area type
        <select
          className="input"
          value={zoneType}
          onChange={(event) => setZoneType(event.target.value as GardenZoneType)}
        >
          {GARDEN_ZONE_TYPES.map((option) => (
            <option key={option} value={option}>
              {zoneTypeLabel(option)}
            </option>
          ))}
        </select>
      </label>
      <label className="stack">
        Description
        <textarea
          className="input"
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <div className="row">
        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save garden"}
        </button>
        <button className="btn secondary" type="button" disabled={deleting} onClick={() => void handleDelete()}>
          {deleting ? "Deleting…" : "Delete garden"}
        </button>
      </div>
    </form>
  );
}
