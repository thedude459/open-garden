import Link from "next/link";
import type { GardenSummary } from "@/lib/garden/types";
import { GardenCard } from "./GardenCard";

interface GardenListProps {
  gardens: GardenSummary[];
}

export function GardenList({ gardens }: GardenListProps) {
  if (gardens.length === 0) {
    return (
      <div className="card stack">
        <p>No gardens yet.</p>
        <Link className="btn" href="/gardens/new">
          Create your first garden
        </Link>
      </div>
    );
  }

  return (
    <div className="grid">
      {gardens.map((garden) => (
        <GardenCard key={garden.id} garden={garden} />
      ))}
    </div>
  );
}
