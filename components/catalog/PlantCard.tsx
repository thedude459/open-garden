import Link from "next/link";
import type { PlantSummary } from "@/lib/catalog/types";

export function PlantCard({ plant }: { plant: PlantSummary }) {
  return (
    <Link className="card stack" href={`/plants/${plant.id}`}>
      <div className="row">
        <strong>{plant.common_name}</strong>
        <span className={`badge ${plant.provenance === "provisional" ? "provisional" : ""}`}>
          {plant.provenance}
        </span>
      </div>
      <span className="field-label">
        {plant.botanical_name ?? "Botanical name unavailable"} · {plant.plant_category}
      </span>
    </Link>
  );
}
