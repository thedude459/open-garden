import { FormEvent, KeyboardEvent, RefObject } from "react";
import { Bed, CropTemplate, DragPayload, Placement } from "../types";

type PlannerPanelProps = {
  isLoadingGardenData: boolean;
  beds: Bed[];
  placements: Placement[];
  cropTemplates: CropTemplate[];
  yardWidthFt: number;
  yardLengthFt: number;
  yardWidthDraft: number;
  yardLengthDraft: number;
  onYardWidthDraftChange: (value: number) => void;
  onYardLengthDraftChange: (value: number) => void;
  onCreateBed: (e: FormEvent<HTMLFormElement>) => void;
  onUpdateYardSize: (e: FormEvent<HTMLFormElement>) => void;
  onGoToCrops: () => void;
  cropSearchQuery: string;
  onCropSearchQueryChange: (value: string) => void;
  onCropSearchKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  filteredCropTemplates: CropTemplate[];
  cropSearchActiveIndex: number;
  selectedCropName: string;
  selectedCrop?: CropTemplate;
  onSelectCrop: (crop: CropTemplate) => void;
  cropBaseName: (crop: CropTemplate) => string;
  placementBedId: number | null;
  onPlacementBedIdChange: (value: number | null) => void;
  yardGridRef: RefObject<HTMLDivElement>;
  yardCellPx: number;
  toFeet: (inches: number) => string;
  onMoveBedInYard: (bedId: number, x: number, y: number) => void;
  onNudgeBed: (bedId: number, dx: number, dy: number) => void;
  onDeleteBed: (bedId: number) => void;
  onAddPlacement: (bedId: number, x: number, y: number) => void;
  onMovePlacement: (placementId: number, bedId: number, x: number, y: number) => void;
  onNudgePlacement: (placementId: number, dx: number, dy: number) => void;
  onRequestRemovePlacement: (placementId: number, cropName: string) => void;
  onBlockedPlacementMove: (cropName: string) => void;
  placementSpacingConflict: (bedId: number, x: number, y: number, cropName: string, ignorePlacementId?: number) => string | null;
  isCellBlockedForSelectedCrop: (bedId: number, x: number, y: number, occupant: Placement | undefined) => boolean;
};

export function PlannerPanel({
  isLoadingGardenData,
  beds,
  placements,
  cropTemplates,
  yardWidthFt,
  yardLengthFt,
  yardWidthDraft,
  yardLengthDraft,
  onYardWidthDraftChange,
  onYardLengthDraftChange,
  onCreateBed,
  onUpdateYardSize,
  onGoToCrops,
  cropSearchQuery,
  onCropSearchQueryChange,
  onCropSearchKeyDown,
  filteredCropTemplates,
  cropSearchActiveIndex,
  selectedCropName,
  selectedCrop,
  onSelectCrop,
  cropBaseName,
  placementBedId,
  onPlacementBedIdChange,
  yardGridRef,
  yardCellPx,
  toFeet,
  onMoveBedInYard,
  onNudgeBed,
  onDeleteBed,
  onAddPlacement,
  onMovePlacement,
  onNudgePlacement,
  onRequestRemovePlacement,
  onBlockedPlacementMove,
  placementSpacingConflict,
  isCellBlockedForSelectedCrop,
}: PlannerPanelProps) {
  const hasPlannerCropOptions = filteredCropTemplates.length > 0;

  return (
    <article className="card bed-planner-card">
      <h2>Garden Bed Planner Studio</h2>
      <p className="subhead">Build your layout map, then click inside each bed to assign crops by square foot.</p>
      {isLoadingGardenData && <p className="hint">Refreshing layout data...</p>}

      <div className="planner-layout">
        <aside className="planner-sidebar">
          <form onSubmit={onCreateBed} className="stack compact planner-panel">
            <h3>Create Bed</h3>
            <label className="field-label" htmlFor="bed-name">Bed Name</label>
            <input id="bed-name" name="name" placeholder="Backyard North Bed" required />
            <div className="mini-row">
              <div className="stack compact">
                <label className="field-label" htmlFor="bed-width-ft">Width (ft)</label>
                <input id="bed-width-ft" name="width_ft" type="number" step="0.5" min="1" placeholder="4" required />
              </div>
              <div className="stack compact">
                <label className="field-label" htmlFor="bed-length-ft">Length (ft)</label>
                <input id="bed-length-ft" name="length_ft" type="number" step="0.5" min="1" placeholder="8" required />
              </div>
            </div>
            <p className="hint">Beds start in the top-left corner. Drag each bed in Yard Layout to place it.</p>
            <button type="submit">Add bed</button>
          </form>

          <div className="stack compact planner-panel">
            <h3>Placement Tools</h3>
            <div className="crop-picker">
              <label className="field-label" htmlFor="planner-crop-search">Search Vegetable</label>
              <input
                id="planner-crop-search"
                value={cropSearchQuery}
                onChange={(e) => onCropSearchQueryChange(e.target.value)}
                onKeyDown={onCropSearchKeyDown}
                placeholder="Search by vegetable, variety, or family"
                role="combobox"
                aria-autocomplete="list"
                aria-haspopup="listbox"
                aria-controls="planner-crop-list"
                aria-expanded={hasPlannerCropOptions}
                aria-activedescendant={hasPlannerCropOptions && filteredCropTemplates[cropSearchActiveIndex] ? `planner-crop-option-${filteredCropTemplates[cropSearchActiveIndex].id}` : undefined}
              />
              <div id="planner-crop-list" className="crop-picker-list" role="listbox" aria-label="Planner vegetable search results">
                {filteredCropTemplates.slice(0, 10).map((crop, index) => (
                  <button
                    key={crop.id}
                    id={`planner-crop-option-${crop.id}`}
                    type="button"
                    role="option"
                    aria-selected={selectedCropName === crop.name || cropSearchActiveIndex === index}
                    className={selectedCropName === crop.name || cropSearchActiveIndex === index ? "crop-option active" : "crop-option"}
                    onClick={() => onSelectCrop(crop)}
                  >
                    <strong>{cropBaseName(crop)}</strong>
                    <small>{crop.variety || crop.family || "Vegetable"}</small>
                  </button>
                ))}
                {filteredCropTemplates.length === 0 && <p className="hint">No vegetables match that search.</p>}
              </div>
            </div>
            {selectedCrop && (
              <div className="crop-card">
                <div className="crop-card-row">
                  <span>
                    <strong>{cropBaseName(selectedCrop)}</strong>
                    {selectedCrop.variety && <span className="crop-tag variety">{selectedCrop.variety}</span>}
                    {selectedCrop.family && <span className="crop-tag family">{selectedCrop.family}</span>}
                  </span>
                  <span>
                    {selectedCrop.frost_hardy ? <span className="crop-tag frost">Frost hardy</span> : <span className="crop-tag warm">Warm season</span>}
                    {selectedCrop.direct_sow ? <span className="crop-tag sow">Direct sow</span> : <span className="crop-tag transplant">Start indoors {selectedCrop.weeks_to_transplant} wks ahead</span>}
                  </span>
                </div>
                <p className="hint"><strong>When to plant:</strong> {selectedCrop.planting_window}</p>
                <p className="hint">Spacing {selectedCrop.spacing_in} in &middot; Harvest in ~{selectedCrop.days_to_harvest} days</p>
                {selectedCrop.notes && <p className="hint crop-notes">{selectedCrop.notes}</p>}
              </div>
            )}
            <select value={placementBedId || ""} onChange={(e) => onPlacementBedIdChange(Number(e.target.value) || null)}>
              <option value="">Apply to any bed</option>
              {beds.map((bed) => (
                <option key={bed.id} value={bed.id}>
                  {bed.name}
                </option>
              ))}
            </select>
            <p className="hint">Use arrow keys and Enter in the crop search. Click any square in a bed to place {selectedCropName || "a crop"}.</p>
            <p className="hint">Keyboard move: focus a yard bed or placement chip, then use arrow keys to nudge by one grid cell.</p>
            <button type="button" className="secondary-btn" onClick={onGoToCrops}>Manage Crop Library →</button>
          </div>
        </aside>

        <div className="planner-main">
          <div className="planner-summary">
            <div className="planner-stat">
              <strong>{beds.length}</strong>
              <span>Beds</span>
            </div>
            <div className="planner-stat">
              <strong>{placements.length}</strong>
              <span>Placements</span>
            </div>
            <div className="planner-stat">
              <strong>{cropTemplates.length}</strong>
              <span>Vegetables</span>
            </div>
            <div className="planner-stat">
              <strong>{yardWidthFt} x {yardLengthFt}</strong>
              <span>Yard (ft)</span>
            </div>
          </div>

          <section className="planner-panel planner-yard-panel">
            <div className="planner-yard-header">
              <div>
                <h3>Yard Layout</h3>
                <p className="hint">Drag beds into the yard and resize the yard as you refine the plan.</p>
              </div>
              <form onSubmit={onUpdateYardSize} className="yard-size-form">
                <div className="mini-row">
                  <div className="stack compact">
                    <label className="field-label" htmlFor="yard-width-draft">Yard Width (ft)</label>
                    <input id="yard-width-draft" type="number" min="4" value={yardWidthDraft} onChange={(e) => onYardWidthDraftChange(Number(e.target.value))} required />
                  </div>
                  <div className="stack compact">
                    <label className="field-label" htmlFor="yard-length-draft">Yard Length (ft)</label>
                    <input id="yard-length-draft" type="number" min="4" value={yardLengthDraft} onChange={(e) => onYardLengthDraftChange(Number(e.target.value))} required />
                  </div>
                </div>
                <button type="submit">Save Yard Size</button>
              </form>
            </div>

            <div className="yard-grid-wrap">
              <div
                className="yard-grid"
                ref={yardGridRef}
                style={{ width: yardWidthFt * yardCellPx, height: yardLengthFt * yardCellPx, backgroundSize: `${yardCellPx}px ${yardCellPx}px` }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const payloadRaw = event.dataTransfer.getData("application/json");
                  if (!payloadRaw || !yardGridRef.current) {
                    return;
                  }

                  const payload = JSON.parse(payloadRaw) as { bedId?: number };
                  if (!payload.bedId) {
                    return;
                  }

                  const bed = beds.find((item) => item.id === payload.bedId);
                  if (!bed) {
                    return;
                  }

                  const rect = yardGridRef.current.getBoundingClientRect();
                  const bedWidthFt = Math.max(1, Math.ceil(bed.width_in / 12));
                  const bedLengthFt = Math.max(1, Math.ceil(bed.height_in / 12));
                  const rawX = (event.clientX - rect.left) / yardCellPx - bedWidthFt / 2;
                  const rawY = (event.clientY - rect.top) / yardCellPx - bedLengthFt / 2;
                  const maxX = Math.max(0, yardWidthFt - bedWidthFt);
                  const maxY = Math.max(0, yardLengthFt - bedLengthFt);
                  const nextX = Math.min(maxX, Math.max(0, Math.round(rawX)));
                  const nextY = Math.min(maxY, Math.max(0, Math.round(rawY)));
                  onMoveBedInYard(payload.bedId, nextX, nextY);
                }}
              >
                {beds.map((bed) => {
                  const bedWidthFt = Math.max(1, Math.ceil(bed.width_in / 12));
                  const bedLengthFt = Math.max(1, Math.ceil(bed.height_in / 12));
                  return (
                    <div
                      key={bed.id}
                      className={`yard-bed${placementBedId && placementBedId !== bed.id ? " muted" : ""}`}
                      role="button"
                      tabIndex={0}
                      aria-label={`${bed.name}, ${toFeet(bed.width_in)} by ${toFeet(bed.height_in)}. Use arrow keys to move.`}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("application/json", JSON.stringify({ bedId: bed.id }));
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowLeft") {
                          event.preventDefault();
                          onNudgeBed(bed.id, -1, 0);
                        } else if (event.key === "ArrowRight") {
                          event.preventDefault();
                          onNudgeBed(bed.id, 1, 0);
                        } else if (event.key === "ArrowUp") {
                          event.preventDefault();
                          onNudgeBed(bed.id, 0, -1);
                        } else if (event.key === "ArrowDown") {
                          event.preventDefault();
                          onNudgeBed(bed.id, 0, 1);
                        }
                      }}
                      style={{
                        left: bed.grid_x * yardCellPx,
                        top: bed.grid_y * yardCellPx,
                        width: bedWidthFt * yardCellPx,
                        height: bedLengthFt * yardCellPx,
                      }}
                    >
                      <strong>{bed.name}</strong>
                      <small>
                        {toFeet(bed.width_in)} x {toFeet(bed.height_in)}
                      </small>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="planner-panel">
            <div className="planner-section-head">
              <div>
                <h3>Bed Sheets</h3>
                <p className="hint">Each square is one foot. Place crops directly on the grid or drag existing placements between beds.</p>
              </div>
            </div>

            <div className="bed-detail-grid">
              {beds.map((bed) => {
                const cols = Math.max(1, Math.ceil(bed.width_in / 12));
                const rows = Math.max(1, Math.ceil(bed.height_in / 12));
                const bedPlacements = placements.filter((item) => item.bed_id === bed.id);

                return (
                  <section key={bed.id} className="bed-sheet">
                    <header>
                      <h4>{bed.name}</h4>
                      <small>
                        {cols} x {rows} squares
                      </small>
                      <button className="danger-sm" title="Delete bed" onClick={() => onDeleteBed(bed.id)}>
                        Delete bed
                      </button>
                    </header>

                    <div className="bed-board" style={{ gridTemplateColumns: `repeat(${cols}, minmax(2.1rem, 1fr))` }}>
                      {Array.from({ length: cols * rows }).map((_, index) => {
                        const x = index % cols;
                        const y = Math.floor(index / cols);
                        const occupant = bedPlacements.find((item) => item.grid_x === x && item.grid_y === y);
                        const blockedForSelected = isCellBlockedForSelectedCrop(bed.id, x, y, occupant);

                        return (
                          <button
                            key={`${bed.id}-${x}-${y}`}
                            className={`plot-cell${occupant ? " occupied" : ""}${blockedForSelected ? " blocked" : ""}`}
                            style={occupant ? { borderColor: occupant.color } : undefined}
                            onClick={() => {
                              if (!occupant && !blockedForSelected) {
                                onAddPlacement(bed.id, x, y);
                              }
                            }}
                            onDragOver={(event) => {
                              event.preventDefault();
                            }}
                            onDrop={(event) => {
                              event.preventDefault();
                              if (occupant) {
                                return;
                              }
                              const raw = event.dataTransfer.getData("application/json");
                              if (!raw) {
                                return;
                              }
                              const payload: DragPayload = JSON.parse(raw);
                              const moving = placements.find((placement) => placement.id === payload.placementId);
                              if (!moving) {
                                return;
                              }
                              const blockedForMove = Boolean(placementSpacingConflict(bed.id, x, y, moving.crop_name, moving.id));
                              if (blockedForMove) {
                                onBlockedPlacementMove(moving.crop_name);
                                return;
                              }
                              onMovePlacement(payload.placementId, bed.id, x, y);
                            }}
                            title={blockedForSelected ? `Blocked: too close for ${selectedCropName} spacing` : undefined}
                          >
                            {occupant ? occupant.crop_name.slice(0, 2).toUpperCase() : ""}
                          </button>
                        );
                      })}
                    </div>

                    <ul className="chip-list">
                      {bedPlacements.map((placement) => (
                        <li key={placement.id}>
                          <button
                            className="chip"
                            style={{ background: placement.color }}
                            draggable
                            aria-label={`${placement.crop_name} at column ${placement.grid_x + 1}, row ${placement.grid_y + 1}. Arrow keys move; Enter removes.`}
                            onDragStart={(event) => {
                              event.dataTransfer.setData("application/json", JSON.stringify({ placementId: placement.id }));
                              event.dataTransfer.effectAllowed = "move";
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "ArrowLeft") {
                                event.preventDefault();
                                onNudgePlacement(placement.id, -1, 0);
                              } else if (event.key === "ArrowRight") {
                                event.preventDefault();
                                onNudgePlacement(placement.id, 1, 0);
                              } else if (event.key === "ArrowUp") {
                                event.preventDefault();
                                onNudgePlacement(placement.id, 0, -1);
                              } else if (event.key === "ArrowDown") {
                                event.preventDefault();
                                onNudgePlacement(placement.id, 0, 1);
                              }
                            }}
                            onClick={() => onRequestRemovePlacement(placement.id, placement.crop_name)}
                          >
                            {placement.crop_name} ({placement.grid_x + 1},{placement.grid_y + 1})
                          </button>
                        </li>
                      ))}
                      {bedPlacements.length === 0 && <li>No crop placements yet.</li>}
                    </ul>
                  </section>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </article>
  );
}
