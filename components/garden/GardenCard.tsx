"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { GardenSummary } from "@/lib/garden/types";
import { zoneTypeLabel } from "@/lib/planner/zone-plants";

interface GardenCardProps {
  garden: GardenSummary;
}

export function GardenCard({ garden }: GardenCardProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError(body?.error ?? "Failed to delete garden");
      return;
    }

    router.refresh();
  }

  return (
    <article className="card stack garden-card">
      {garden.thumbnail_url ? (
        <img
          className="garden-card-thumbnail"
          src={garden.thumbnail_url}
          alt=""
          width={320}
          height={180}
        />
      ) : (
        <div className="garden-card-thumbnail garden-card-thumbnail-placeholder" aria-hidden>
          No preview yet
        </div>
      )}
      <h2>
        <Link href={`/gardens/${garden.id}`}>{garden.name}</Link>
      </h2>
      <p className="field-label">
        {garden.zone_type ? (
          <span className="zone-badge">{zoneTypeLabel(garden.zone_type)}</span>
        ) : null}{" "}
        {garden.length} × {garden.width} {garden.unit} · {garden.bed_count} beds ·{" "}
        {garden.placement_count} plants
      </p>
      <p className="field-label">Updated {new Date(garden.updated_at).toLocaleString()}</p>
      <div className="row">
        <Link className="btn secondary" href={`/gardens/${garden.id}`}>
          Open
        </Link>
        <button className="btn secondary" type="button" disabled={deleting} onClick={() => void handleDelete()}>
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </article>
  );
}
