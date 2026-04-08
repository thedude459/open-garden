import { useEffect, useMemo, useState } from "react";
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
  cropVisual: (cropName: string) => { imageUrl: string; rowSpacingIn: number; inRowSpacingIn: number };
  onNudgePlacement: (placementId: number, dx: number, dy: number) => void;
  onRequestRemovePlacement: (placementId: number, cropName: string) => void;
  requestRotatePreview: (bed: Bed) => void;
  onRenameBed: (bedId: number, nextName: string) => Promise<void> | void;
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
  onRenameBed,
  onDeleteBed,
  allPlacements,
}: PlannerBedSheetSingleProps) {
  const cols = Math.max(1, Math.ceil(bed.width_in / 3));
  const rows = Math.max(1, Math.ceil(bed.height_in / 3));
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(bed.name);
  const [isSavingRename, setIsSavingRename] = useState(false);

  useEffect(() => {
    setRenameDraft(bed.name);
  }, [bed.name]);

  const placementIndexes = useMemo(() => {
    const runningCounts = new Map<string, number>();
    const indexByPlacementId = new Map<number, number>();
    placements.forEach((placement) => {
      const next = (runningCounts.get(placement.crop_name) || 0) + 1;
      runningCounts.set(placement.crop_name, next);
      indexByPlacementId.set(placement.id, next);
    });
    return indexByPlacementId;
  }, [placements]);

  return (
    <section key={bed.id} className="space-y-4 border border-border rounded-lg p-4">
      <header>
        {isRenaming ? (
          <form
            className="flex items-center gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              if (isSavingRename) return;
              if (!renameDraft.trim()) {
                return;
              }
              setIsSavingRename(true);
              await onRenameBed(bed.id, renameDraft);
              setIsSavingRename(false);
              setIsRenaming(false);
            }}
          >
            <input
              type="text"
              value={renameDraft}
              maxLength={80}
              onChange={(event) => setRenameDraft(event.target.value)}
              aria-label={`Rename ${bed.name}`}
            />
            <button type="submit" className="secondary-btn" disabled={isSavingRename}>
              Save
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                setRenameDraft(bed.name);
                setIsRenaming(false);
              }}
              disabled={isSavingRename}
            >
              Cancel
            </button>
          </form>
        ) : (
          <h4>{bed.name}</h4>
        )}
        <small>
          {cols} x {rows} squares
        </small>
        <small className="bed-scale-legend">3 in / square · 4 squares = 1 ft</small>
        {!isRenaming && (
          <button className="secondary-btn" title="Rename bed" onClick={() => setIsRenaming(true)}>
            Rename
          </button>
        )}
        <button className="secondary-btn" title="Preview rotate bed 90 degrees" onClick={() => requestRotatePreview(bed)}>
          Rotate 90°
        </button>
        <button className="danger-sm" title="Delete bed" onClick={() => onDeleteBed(bed.id)}>
          Delete bed
        </button>
      </header>

      <div className="grid border border-border rounded" style={{ gridTemplateColumns: `repeat(${cols}, minmax(2.1rem, 1fr))` }}>
        {Array.from({ length: cols * rows }).map((_, index) => {
          const x = index % cols;
          const y = Math.floor(index / cols);
          const occupant = placements.find((item) => item.grid_x === x && item.grid_y === y);
          const blockedForSelected = isCellBlockedForSelectedCrop(bed.id, x, y, occupant);
          const inBuffer = isCellInBuffer(bed.id, x, y);

          return (
            <button
              key={`${bed.id}-${x}-${y}`}
              className={`aspect-square flex items-center justify-center border border-border/30 text-xs transition-colors p-0 ${occupant ? "bg-white" : blockedForSelected ? "bg-red-50 cursor-not-allowed" : inBuffer ? "bg-amber-50 cursor-not-allowed" : "hover:bg-green-50 cursor-pointer"}${occupant && selectedPlacementIds.includes(occupant.id) ? " ring-2 ring-inset ring-[var(--accent)]" : ""}`}
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
                    return <img className="plot-cell-photo w-full h-full object-cover" src={visual.imageUrl} alt="" title={occupant.crop_name} loading="lazy" />;
                  })()
                : ""}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-border" aria-label={`${bed.name} crop legend`}>
        {Array.from(
          new Map(placements.map((p) => [p.crop_name, placements.filter((item) => item.crop_name === p.crop_name).length])).entries()
        ).map(([cropName, count]) => {
          const visual = cropVisual(cropName);
          return (
            <span key={`${bed.id}-${cropName}`} className="flex items-center gap-1.5 text-sm">
              <img className="legend-photo w-6 h-6 rounded object-cover" src={visual.imageUrl} alt="" loading="lazy" />
              <span>{cropName} ({count})</span>
              <span className="hint">Row {visual.rowSpacingIn} in · In-row {visual.inRowSpacingIn} in</span>
            </span>
          );
        })}
        {placements.length === 0 && <span className="hint">No crops to show in legend yet.</span>}
      </div>

      <ul className="space-y-2 mt-4">
        {placements.map((placement) => (
          <li key={placement.id} className="flex flex-wrap items-center gap-2 py-2 border-b last:border-b-0">
            <button
              className={`rounded px-2 py-1 text-sm text-white font-medium cursor-pointer hover:opacity-90 transition-opacity${selectedPlacement && selectedPlacement.id === placement.id ? " ring-2 ring-offset-1 ring-white" : ""}`}
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
                : `${placement.crop_name}${(placementIndexes.get(placement.id) || 0) > 1 ? ` #${placementIndexes.get(placement.id)}` : ""}`}
            </button>
            <p className="hint text-xs w-full">
              Row {cropVisual(placement.crop_name).rowSpacingIn} in · In-row {cropVisual(placement.crop_name).inRowSpacingIn} in
            </p>
            <div className="flex gap-1 ml-auto">
              <button type="button" className="secondary-btn text-xs px-1.5 py-0.5" onClick={() => onNudgePlacement(placement.id, -1, 0)} aria-label={`Move ${placement.crop_name} left`}>←</button>
              <button type="button" className="secondary-btn text-xs px-1.5 py-0.5" onClick={() => onNudgePlacement(placement.id, 0, -1)} aria-label={`Move ${placement.crop_name} up`}>↑</button>
              <button type="button" className="secondary-btn text-xs px-1.5 py-0.5" onClick={() => onNudgePlacement(placement.id, 0, 1)} aria-label={`Move ${placement.crop_name} down`}>↓</button>
              <button type="button" className="secondary-btn text-xs px-1.5 py-0.5" onClick={() => onNudgePlacement(placement.id, 1, 0)} aria-label={`Move ${placement.crop_name} right`}>→</button>
              <button type="button" className="danger-sm text-xs px-1.5 py-0.5" onClick={() => onRequestRemovePlacement(placement.id, placement.crop_name)}>Remove</button>
            </div>
          </li>
        ))}
        {placements.length === 0 && <li>No crop placements yet.</li>}
      </ul>
    </section>
  );
}
