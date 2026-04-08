import { Garden } from "../types";
import { Badge } from "@/components/ui/badge";

type GardenListSidebarProps = {
  gardens: Garden[];
  publicGardens: Garden[];
  selectedGarden: number | null;
  onSelectGarden: (id: number) => void;
  onDeleteGarden: (id: number) => void;
};

export function GardenListSidebar({
  gardens,
  publicGardens,
  selectedGarden,
  onSelectGarden,
  onDeleteGarden,
}: GardenListSidebarProps) {
  return (
    <>
      <article className="card">
        <h2>Your Gardens</h2>
        <p className="hint">Pick an active garden to unlock planning, calendar, and weather workflows.</p>
        {gardens.length === 0 && (
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground mt-2">
            <li>Create a garden with your ZIP &amp; yard size below</li>
            <li>Use <strong>Bed Planner</strong> to add beds and drag them into your yard</li>
            <li>Use <strong>Calendar</strong> to add plantings — tasks generate automatically</li>
          </ol>
        )}
        <ul className="space-y-2 mt-3">
          {gardens.map((garden) => {
            const isSelected = selectedGarden === garden.id;
            return (
              <li key={garden.id} className={`border rounded-md overflow-hidden ${isSelected ? "border-[var(--accent)]" : "border-border"}`}>
                <button
                  className={`w-full text-left px-3 py-2 transition-colors ${isSelected ? "bg-accent/10" : "hover:bg-muted"}`}
                  aria-pressed={isSelected}
                  aria-current={isSelected ? "true" : undefined}
                  aria-label={`Select garden ${garden.name}`}
                  onClick={() => onSelectGarden(garden.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{garden.name}</span>
                    {isSelected && <Badge variant="default" className="text-xs">Active</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded">Zone {garden.growing_zone}</span>
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{garden.yard_width_ft}&times;{garden.yard_length_ft} ft</span>
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded">ZIP {garden.zip_code}</span>
                    {garden.is_shared && <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">Shared</span>}
                  </div>
                </button>
                <button
                  className="secondary-btn w-full text-sm"
                  title="Delete garden"
                  aria-label={`Delete ${garden.name}`}
                  onClick={() => onDeleteGarden(garden.id)}
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      </article>

      <article className="card">
        <div className="crop-card-row">
          <h3>Community Shared Gardens</h3>
          <Badge variant="outline">{publicGardens.length} shared</Badge>
        </div>
        {publicGardens.length > 0 ? (
          <ul className="space-y-2 mt-2">
            {publicGardens.slice(0, 6).map((garden) => (
              <li key={garden.id} className="flex flex-col py-1 border-b last:border-b-0">
                <strong>{garden.name}</strong>
                <span className="hint">Zone {garden.growing_zone}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">No shared gardens yet.</p>
        )}
      </article>
    </>
  );
}
