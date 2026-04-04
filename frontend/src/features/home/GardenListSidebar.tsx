import { Garden } from "../types";

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
        {gardens.length === 0 && (
          <ol className="workflow-guide">
            <li>Create a garden with your ZIP &amp; yard size below</li>
            <li>Use <strong>Bed Planner</strong> to add beds and drag them into your yard</li>
            <li>Use <strong>Calendar</strong> to add plantings — tasks generate automatically</li>
          </ol>
        )}
        <ul className="garden-card-list">
          {gardens.map((garden) => (
            <li key={garden.id} className={`garden-card-item${selectedGarden === garden.id ? " selected" : ""}`}>
              <button className="garden-card-select" onClick={() => onSelectGarden(garden.id)}>
                <span className="garden-card-name">{garden.name}</span>
                <span className="garden-card-meta">Zone {garden.growing_zone} &middot; {garden.zip_code} &middot; {garden.yard_width_ft}&times;{garden.yard_length_ft} ft {garden.is_shared ? "· shared" : ""}</span>
              </button>
              <button
                className="danger-sm"
                title="Delete garden"
                onClick={() => onDeleteGarden(garden.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </article>

      <article className="card home-community-card">
        <div className="crop-card-row">
          <h3>Community Shared Gardens</h3>
          <span className="status-pill upcoming">{publicGardens.length} shared</span>
        </div>
        {publicGardens.length > 0 ? (
          <ul className="home-dashboard-list compact-list">
            {publicGardens.slice(0, 6).map((garden) => (
              <li key={garden.id} className="home-dashboard-list-item">
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
