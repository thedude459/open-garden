"use client";

import Link from "next/link";
import type { PlantDetail } from "@/lib/catalog/types";

const FIELD_LABELS: Array<[keyof PlantDetail, string]> = [
  ["botanical_name", "Botanical name"],
  ["variety", "Variety"],
  ["plant_category", "Category"],
  ["days_to_maturity", "Days to maturity"],
  ["sun_exposure", "Sun exposure"],
  ["spacing_cm", "Spacing (cm)"],
  ["watering_needs", "Watering"],
  ["fertilizer_needs", "Fertilizer"],
  ["pest_disease_notes", "Pest / disease notes"],
  ["harvest_window", "Harvest window"],
  ["hardiness_min_zone", "Hardiness min zone"],
  ["hardiness_max_zone", "Hardiness max zone"],
];

function formatValue(value: unknown) {
  if (value == null) return null;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function PlantDetailView({ plant }: { plant: PlantDetail }) {
  return (
    <div className="stack">
      <div className="row">
        <h1>{plant.common_name}</h1>
        <span className={`badge ${plant.provenance === "provisional" ? "provisional" : ""}`}>
          {plant.provenance}
        </span>
      </div>

      <div className="card stack">
        {FIELD_LABELS.map(([key, label]) => {
          const value = formatValue(plant[key]);
          const isGap = plant.field_gaps.includes(String(key)) || value == null;
          return (
            <div className="field-row" key={String(key)}>
              <div className="field-label">{label}</div>
              <div>
                {isGap ? <span className="badge gap">data gap</span> : value}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card stack">
        <h2>Companions</h2>
        <div className="row">
          {plant.companions.length === 0 ? (
            <span className="field-label">None listed</span>
          ) : (
            plant.companions.map((companion) => (
              <Link key={companion.id} href={`/plants/${companion.id}`}>
                {companion.common_name}
              </Link>
            ))
          )}
        </div>
        <h2>Incompatibles</h2>
        <div className="row">
          {plant.incompatibles.length === 0 ? (
            <span className="field-label">None listed</span>
          ) : (
            plant.incompatibles.map((item) => (
              <Link key={item.id} href={`/plants/${item.id}`}>
                {item.common_name}
              </Link>
            ))
          )}
        </div>
      </div>

      {plant.rootstocks.length > 0 ? (
        <div className="card stack">
          <h2>Rootstocks</h2>
          {plant.rootstocks.map((rootstock) => (
            <div key={rootstock.id}>
              {rootstock.name} · {rootstock.vigor} · spacing {rootstock.spacing_cm} cm
            </div>
          ))}
        </div>
      ) : null}

      {plant.location_context ? (
        <div className="card">
          <strong>Location context:</strong> seed start {plant.location_context.recommended_seed_start},
          transplant {plant.location_context.recommended_transplant}
        </div>
      ) : null}
    </div>
  );
}
