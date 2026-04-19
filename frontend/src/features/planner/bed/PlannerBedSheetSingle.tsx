import { CSSProperties, useEffect, useMemo, useState } from "react";
import { Bed, DragPayload, Placement, PlantingLocation } from "../../types";

function getCropInitials(cropName: string) {
  const parts = cropName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "PL";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

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
  cropVisual: (cropName: string) => { imageUrl: string; rowSpacingIn: number; inRowSpacingIn: number; emoji: string };
  onNudgePlacement: (placementId: number, dx: number, dy: number) => void;
  onRequestRemovePlacement: (placementId: number, cropName: string) => void;
  onRelocatePlanting: (placementId: number, location: PlantingLocation) => void;
  onUpdatePlantingDates: (
    placementId: number,
    changes: { planted_on?: string; moved_on?: string | null },
  ) => void;
  onRenameBed: (bedId: number, nextName: string) => Promise<void> | void;
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
  onRelocatePlanting,
  onUpdatePlantingDates,
  onRenameBed,
  allPlacements,
}: PlannerBedSheetSingleProps) {
  const cols = Math.max(1, Math.ceil(bed.width_in / 3));
  const rows = Math.max(1, Math.ceil(bed.height_in / 3));
  const isWideBed = cols >= 24 || cols >= rows * 2;
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(bed.name);
  const [isSavingRename, setIsSavingRename] = useState(false);
  // Track which placement row currently has its inline date editor open.
  const [editingDatesId, setEditingDatesId] = useState<number | null>(null);

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

  const groupedPlacements = useMemo(() => {
    const groups = new Map<string, Placement[]>();
    placements.forEach((placement) => {
      const existing = groups.get(placement.crop_name);
      if (existing) {
        existing.push(placement);
      } else {
        groups.set(placement.crop_name, [placement]);
      }
    });
    return Array.from(groups.entries());
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
      </header>

      <div
        className={`planner-bed-sheet-workspace${isWideBed ? " is-wide-bed" : ""}`}
      >
        <div className="bed-sheet-grid-scroll">
          <div
            className="bed-sheet-grid"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(${
                isWideBed ? "1.1rem" : "1.85rem"
              }, 1fr))`,
            }}
          >
          {Array.from({ length: cols * rows }).map((_, index) => {
          const x = index % cols;
          const y = Math.floor(index / cols);
          const occupant = placements.find((item) => item.grid_x === x && item.grid_y === y);
          const blockedForSelected = isCellBlockedForSelectedCrop(bed.id, x, y, occupant);
          const inBuffer = isCellInBuffer(bed.id, x, y);
          const cellClassName = [
            "bed-sheet-cell",
            occupant ? "occupied" : blockedForSelected ? "spacing-blocked" : inBuffer ? "buffer-blocked" : "empty",
            occupant && selectedPlacementIds.includes(occupant.id) ? "selected" : "",
            occupant && occupant.location === "indoor" ? "indoor" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={`${bed.id}-${x}-${y}`}
              className={cellClassName}
              style={occupant ? ({ borderColor: occupant.color } as CSSProperties) : undefined}
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
                    const markerStyle = { "--placement-accent": occupant.color } as CSSProperties;

                    return (
                      <span className="plot-cell-marker" style={markerStyle} title={occupant.crop_name}>
                        <span
                          className="plot-cell-marker__photo"
                          style={{ backgroundImage: `url("${visual.imageUrl}")` }}
                          aria-hidden="true"
                        />
                        <span className="plot-cell-marker__emoji" aria-hidden="true">
                          {visual.emoji}
                        </span>
                        <span className="plot-cell-marker__label">{getCropInitials(occupant.crop_name)}</span>
                      </span>
                    );
                  })()
                : ""}
            </button>
          );
          })}
          </div>
        </div>
        <aside className="bed-placements-panel" aria-label={`${bed.name} placement controls`}>
          <header className="bed-placements-panel__header">
            <h5 className="bed-placements-panel__title">Plants</h5>
            <span className="bed-placements-panel__count">
              {placements.length} {placements.length === 1 ? "plant" : "plants"}
            </span>
          </header>

          {placements.length === 0 ? (
            <p className="bed-placements-panel__empty">No crop placements yet.</p>
          ) : (
            <ul className="bed-placements-groups" aria-label={`${bed.name} crop legend`}>
              {groupedPlacements.map(([cropName, cropPlacements]) => {
                const visual = cropVisual(cropName);
                return (
                  <li key={`${bed.id}-${cropName}`} className="bed-placement-group">
                    <div className="bed-placement-group__header">
                      <span className="bed-placement-group__avatar">
                        <img
                          className="bed-placement-group__photo legend-photo"
                          src={visual.imageUrl}
                          alt=""
                          loading="lazy"
                        />
                        <span className="bed-placement-group__emoji" aria-hidden="true">
                          {visual.emoji}
                        </span>
                      </span>
                      <div className="bed-placement-group__meta">
                        <span className="bed-placement-group__name" title={cropName}>
                          {cropName} ({cropPlacements.length})
                        </span>
                        <span className="bed-placement-group__spacing">
                          Row {visual.rowSpacingIn} in · In-row {visual.inRowSpacingIn} in
                        </span>
                      </div>
                    </div>

                    <ul className="bed-placement-rows">
                      {cropPlacements.map((placement) => {
                        const placementIndex = placementIndexes.get(placement.id) || 0;
                        const isSelected = selectedPlacement?.id === placement.id;
                        const isMultiple = cropPlacements.length > 1;
                        return (
                          <li
                            key={placement.id}
                            className={`bed-placement-row${isSelected ? " is-selected" : ""}`}
                          >
                            <div className="bed-placement-row__top">
                              <button
                                type="button"
                                className="bed-placement-row__chip"
                                style={{ "--placement-color": placement.color } as CSSProperties}
                                draggable
                                aria-label={`${placement.crop_name} at column ${placement.grid_x + 1}, row ${placement.grid_y + 1}. Arrow keys move; Enter removes.`}
                                aria-pressed={isSelected}
                                onDragStart={(event) => {
                                  event.dataTransfer.setData(
                                    "application/json",
                                    JSON.stringify({ placementId: placement.id }),
                                  );
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
                                <span className="bed-placement-row__dot" aria-hidden="true" />
                                <span className="bed-placement-row__label">
                                  {isSelected
                                    ? "Tap a square"
                                    : isMultiple
                                    ? `#${placementIndex} · Col ${placement.grid_x + 1}, Row ${placement.grid_y + 1}`
                                    : `Col ${placement.grid_x + 1}, Row ${placement.grid_y + 1}`}
                                </span>
                                {placement.location === "indoor" && (
                                  <span className="bed-placement-row__badge" aria-label="Started indoors">
                                    Indoor
                                  </span>
                                )}
                              </button>
                              <button
                                type="button"
                                className="bed-placement-row__remove"
                                onClick={() => onRequestRemovePlacement(placement.id, placement.crop_name)}
                                title={`Remove ${placement.crop_name} at column ${placement.grid_x + 1}, row ${placement.grid_y + 1}`}
                              >
                                Remove
                              </button>
                            </div>

                            <div className="bed-placement-row__bottom">
                              <div
                                className="bed-placement-row__nudge-pad"
                                role="group"
                                aria-label={`Nudge ${placement.crop_name}`}
                              >
                                <button
                                  type="button"
                                  className="bed-placement-row__nudge"
                                  onClick={() => onNudgePlacement(placement.id, -1, 0)}
                                  aria-label={`Move ${placement.crop_name} left`}
                                >
                                  ←
                                </button>
                                <button
                                  type="button"
                                  className="bed-placement-row__nudge"
                                  onClick={() => onNudgePlacement(placement.id, 0, -1)}
                                  aria-label={`Move ${placement.crop_name} up`}
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  className="bed-placement-row__nudge"
                                  onClick={() => onNudgePlacement(placement.id, 0, 1)}
                                  aria-label={`Move ${placement.crop_name} down`}
                                >
                                  ↓
                                </button>
                                <button
                                  type="button"
                                  className="bed-placement-row__nudge"
                                  onClick={() => onNudgePlacement(placement.id, 1, 0)}
                                  aria-label={`Move ${placement.crop_name} right`}
                                >
                                  →
                                </button>
                              </div>
                              <button
                                type="button"
                                className="bed-placement-row__relocate"
                                onClick={() =>
                                  onRelocatePlanting(
                                    placement.id,
                                    placement.location === "indoor" ? "in_bed" : "indoor",
                                  )
                                }
                                aria-label={
                                  placement.location === "indoor"
                                    ? `Move ${placement.crop_name} into bed`
                                    : `Move ${placement.crop_name} indoors`
                                }
                              >
                                {placement.location === "indoor" ? "Move to bed" : "Move indoors"}
                              </button>
                              <button
                                type="button"
                                className="bed-placement-row__edit-dates"
                                aria-expanded={editingDatesId === placement.id}
                                aria-controls={`bed-placement-dates-${placement.id}`}
                                onClick={() =>
                                  setEditingDatesId((current) =>
                                    current === placement.id ? null : placement.id,
                                  )
                                }
                              >
                                {editingDatesId === placement.id ? "Hide dates" : "Edit dates"}
                              </button>
                            </div>

                            {editingDatesId === placement.id && (
                              <div
                                id={`bed-placement-dates-${placement.id}`}
                                className="bed-placement-row__dates"
                                role="group"
                                aria-label={`Edit dates for ${placement.crop_name}`}
                              >
                                <label className="bed-placement-row__date-field">
                                  <span>
                                    {placement.location === "indoor"
                                      ? "Seed start (indoors)"
                                      : placement.method === "transplant"
                                      ? "Transplant date"
                                      : "Direct sow date"}
                                  </span>
                                  <input
                                    type="date"
                                    defaultValue={placement.planted_on}
                                    onBlur={(event) => {
                                      const value = event.target.value;
                                      if (value && value !== placement.planted_on) {
                                        onUpdatePlantingDates(placement.id, { planted_on: value });
                                      }
                                    }}
                                  />
                                </label>
                                {placement.location === "indoor" && (
                                  <label className="bed-placement-row__date-field">
                                    <span>Planned move-to-bed</span>
                                    <div className="bed-placement-row__date-inline">
                                      <input
                                        type="date"
                                        defaultValue={placement.moved_on ?? ""}
                                        min={placement.planted_on}
                                        onBlur={(event) => {
                                          const value = event.target.value;
                                          if (value && value !== placement.moved_on) {
                                            onUpdatePlantingDates(placement.id, { moved_on: value });
                                          } else if (!value && placement.moved_on) {
                                            onUpdatePlantingDates(placement.id, { moved_on: null });
                                          }
                                        }}
                                      />
                                      {placement.moved_on && (
                                        <button
                                          type="button"
                                          className="secondary-btn"
                                          onClick={() =>
                                            onUpdatePlantingDates(placement.id, { moved_on: null })
                                          }
                                        >
                                          Clear
                                        </button>
                                      )}
                                    </div>
                                  </label>
                                )}
                                <p className="bed-placement-row__dates-hint">
                                  Changes update the harvest estimate. Existing tasks aren't touched.
                                </p>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </section>
  );
}
