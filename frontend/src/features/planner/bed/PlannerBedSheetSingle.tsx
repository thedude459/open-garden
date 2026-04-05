import { Bed, DragPayload, Placement } from "../../types";

type PlannerBedSheetSingleProps = {
  bed: Bed;
  placements: Placement[];
  selectedCropName: string;
  selectedPlacement: Placement | null;
  setSelectedPlacementId: (value: number | null | ((current: number | null) => number | null)) => void;
  bulkMode: boolean;
  selectedPlacementIds: number[];
  togglePlacementSelection: (placementId: number) => void;
  startLasso: (bedId: number, x: number, y: number) => void;
  updateLasso: (bedId: number, x: number, y: number) => void;
  finishLasso: (append: boolean) => void;
  onBlockedPlacementMove: (cropName: string) => void;
  placementSpacingConflict: (bedId: number, x: number, y: number, cropName: string, ignorePlacementId?: number) => string | null;
  onMovePlacement: (placementId: number, bedId: number, x: number, y: number) => void;
  onAddPlacement: (bedId: number, x: number, y: number) => void;
  isCellBlockedForSelectedCrop: (bedId: number, x: number, y: number, occupant: Placement | undefined) => boolean;
  isCellInBuffer: (bedId: number, x: number, y: number) => boolean;
  cropVisual: (cropName: string) => { imageUrl: string; icon: string };
  onNudgePlacement: (placementId: number, dx: number, dy: number) => void;
  onRequestRemovePlacement: (placementId: number, cropName: string) => void;
  requestRotatePreview: (bed: Bed) => void;
  onDeleteBed: (bedId: number) => void;
  allPlacements: Placement[];
};

export function PlannerBedSheetSingle({
  bed,
  placements,
  selectedCropName,
  selectedPlacement,
  setSelectedPlacementId,
  bulkMode,
  selectedPlacementIds,
  togglePlacementSelection,
  startLasso,
  updateLasso,
  finishLasso,
  onBlockedPlacementMove,
  placementSpacingConflict,
  onMovePlacement,
  onAddPlacement,
  isCellBlockedForSelectedCrop,
  isCellInBuffer,
  cropVisual,
  onNudgePlacement,
  onRequestRemovePlacement,
  requestRotatePreview,
  onDeleteBed,
  allPlacements,
}: PlannerBedSheetSingleProps) {
  const cols = Math.max(1, Math.ceil(bed.width_in / 3));
  const rows = Math.max(1, Math.ceil(bed.height_in / 3));

  return (
    <section key={bed.id} className="bed-sheet">
      <header>
        <h4>{bed.name}</h4>
        <small>
          {cols} x {rows} squares
        </small>
        <small className="bed-scale-legend">3 in / square · 4 squares = 1 ft</small>
        <button className="secondary-btn" title="Preview rotate bed 90 degrees" onClick={() => requestRotatePreview(bed)}>
          Rotate 90°
        </button>
        <button className="danger-sm" title="Delete bed" onClick={() => onDeleteBed(bed.id)}>
          Delete bed
        </button>
      </header>

      <div className="bed-board" style={{ gridTemplateColumns: `repeat(${cols}, minmax(2.1rem, 1fr))` }}>
        {Array.from({ length: cols * rows }).map((_, index) => {
          const x = index % cols;
          const y = Math.floor(index / cols);
          const occupant = placements.find((item) => item.grid_x === x && item.grid_y === y);
          const blockedForSelected = isCellBlockedForSelectedCrop(bed.id, x, y, occupant);
          const inBuffer = isCellInBuffer(bed.id, x, y);

          return (
            <button
              key={`${bed.id}-${x}-${y}`}
              className={`plot-cell${occupant ? " occupied" : ""}${blockedForSelected ? " blocked" : ""}${inBuffer ? " buffer" : ""}${occupant && selectedPlacementIds.includes(occupant.id) ? " selected" : ""}`}
              style={occupant ? { borderColor: occupant.color } : undefined}
              onMouseDown={() => startLasso(bed.id, x, y)}
              onMouseEnter={() => updateLasso(bed.id, x, y)}
              onMouseUp={(event) => finishLasso(event.shiftKey)}
              onClick={() => {
                if (bulkMode) {
                  if (occupant) togglePlacementSelection(occupant.id);
                  return;
                }
                if (!occupant && selectedPlacement) {
                  const blockedForMove = Boolean(placementSpacingConflict(bed.id, x, y, selectedPlacement.crop_name, selectedPlacement.id));
                  if (blockedForMove) {
                    onBlockedPlacementMove(selectedPlacement.crop_name);
                    return;
                  }
                  onMovePlacement(selectedPlacement.id, bed.id, x, y);
                  setSelectedPlacementId(null);
                  return;
                }
                if (!occupant && !blockedForSelected) {
                  onAddPlacement(bed.id, x, y);
                }
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (occupant) return;
                const raw = event.dataTransfer.getData("application/json");
                if (!raw) return;
                const payload: DragPayload = JSON.parse(raw);
                const moving = allPlacements.find((p) => p.id === payload.placementId);
                if (!moving) return;
                const blockedForMove = Boolean(placementSpacingConflict(bed.id, x, y, moving.crop_name, moving.id));
                if (blockedForMove) {
                  onBlockedPlacementMove(moving.crop_name);
                  return;
                }
                onMovePlacement(payload.placementId, bed.id, x, y);
              }}
              title={blockedForSelected ? `Blocked: too close for ${selectedCropName} spacing` : inBuffer ? "Buffer zone - cannot plant here" : undefined}
              aria-label={
                inBuffer
                  ? `Buffer zone at column ${x + 1}, row ${y + 1}`
                  : occupant
                  ? `${occupant.crop_name} at column ${x + 1}, row ${y + 1}`
                  : `Empty square column ${x + 1}, row ${y + 1}`
              }
            >
              {occupant
                ? (() => {
                    const visual = cropVisual(occupant.crop_name);
                    if (visual.imageUrl) {
                      return <img className="plot-cell-photo" src={visual.imageUrl} alt="" title={occupant.crop_name} loading="lazy" />;
                    }
                    return (
                      <span className="plot-cell-icon" role="img" aria-hidden="true" title={occupant.crop_name}>
                        {visual.icon}
                      </span>
                    );
                  })()
                : ""}
            </button>
          );
        })}
      </div>

      <div className="bed-legend" aria-label={`${bed.name} crop legend`}>
        {Array.from(
          new Map(placements.map((p) => [p.crop_name, placements.filter((item) => item.crop_name === p.crop_name).length])).entries()
        ).map(([cropName, count]) => {
          const visual = cropVisual(cropName);
          return (
            <span key={`${bed.id}-${cropName}`} className="bed-legend-item">
              {visual.imageUrl ? <img className="legend-photo" src={visual.imageUrl} alt="" loading="lazy" /> : <span className="legend-icon" aria-hidden="true">{visual.icon}</span>}
              <span>{cropName} ({count})</span>
            </span>
          );
        })}
        {placements.length === 0 && <span className="hint">No crops to show in legend yet.</span>}
      </div>

      <ul className="chip-list">
        {placements.map((placement) => (
          <li key={placement.id} className="chip-row">
            <button
              className={selectedPlacement ? (selectedPlacement.id === placement.id ? "chip selected" : "chip") : "chip"}
              style={{ background: placement.color }}
              draggable
              aria-label={`${placement.crop_name} at column ${placement.grid_x + 1}, row ${placement.grid_y + 1}. Arrow keys move; Enter removes.`}
              onDragStart={(event) => {
                event.dataTransfer.setData("application/json", JSON.stringify({ placementId: placement.id }));
                event.dataTransfer.effectAllowed = "move";
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") { event.preventDefault(); onNudgePlacement(placement.id, -1, 0); }
                else if (event.key === "ArrowRight") { event.preventDefault(); onNudgePlacement(placement.id, 1, 0); }
                else if (event.key === "ArrowUp") { event.preventDefault(); onNudgePlacement(placement.id, 0, -1); }
                else if (event.key === "ArrowDown") { event.preventDefault(); onNudgePlacement(placement.id, 0, 1); }
              }}
              onClick={() => {
                if (bulkMode) { togglePlacementSelection(placement.id); return; }
                setSelectedPlacementId((current) => current === placement.id ? null : placement.id);
              }}
            >
              {selectedPlacement && selectedPlacement.id === placement.id
                ? `Tap a square for ${placement.crop_name}`
                : `${placement.crop_name} (${placement.grid_x + 1},${placement.grid_y + 1})`}
            </button>
            <div className="chip-actions">
              <button type="button" className="secondary-btn chip-action-btn" onClick={() => onNudgePlacement(placement.id, -1, 0)} aria-label={`Move ${placement.crop_name} left`}>←</button>
              <button type="button" className="secondary-btn chip-action-btn" onClick={() => onNudgePlacement(placement.id, 0, -1)} aria-label={`Move ${placement.crop_name} up`}>↑</button>
              <button type="button" className="secondary-btn chip-action-btn" onClick={() => onNudgePlacement(placement.id, 0, 1)} aria-label={`Move ${placement.crop_name} down`}>↓</button>
              <button type="button" className="secondary-btn chip-action-btn" onClick={() => onNudgePlacement(placement.id, 1, 0)} aria-label={`Move ${placement.crop_name} right`}>→</button>
              <button type="button" className="danger-sm chip-action-btn" onClick={() => onRequestRemovePlacement(placement.id, placement.crop_name)}>Remove</button>
            </div>
          </li>
        ))}
        {placements.length === 0 && <li>No crop placements yet.</li>}
      </ul>
    </section>
  );
}
