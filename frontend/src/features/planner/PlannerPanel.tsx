import { FormEvent, KeyboardEvent, MouseEvent, RefObject, useEffect, useMemo, useState } from "react";
import { Bed, ClimatePlantingWindow, CropTemplate, DragPayload, Garden, GardenSunPath, Placement } from "../types";
import { buildCanopyPreview } from "./growthSim";
import { buildShadeMap } from "./shadeMap";
import { buildSunExposureGrid, sampleSunVector } from "./sunModel";

type RotationPreview = {
  bedId: number;
  bedName: string;
  currentX: number;
  currentY: number;
  previewX: number;
  previewY: number;
  rotatedWidthFt: number;
  rotatedLengthFt: number;
  fitsCurrent: boolean;
  hasBedOverlap: boolean;
};

type PlannerPanelProps = {
  isLoadingGardenData: boolean;
  beds: Bed[];
  placements: Placement[];
  cropTemplates: CropTemplate[];
  bedName: string;
  bedWidthFt: number;
  bedLengthFt: number;
  yardWidthFt: number;
  yardLengthFt: number;
  yardWidthDraft: number;
  yardLengthDraft: number;
  onBedNameChange: (value: string) => void;
  onBedWidthFtChange: (value: number) => void;
  onBedLengthFtChange: (value: number) => void;
  onYardWidthDraftChange: (value: number) => void;
  onYardLengthDraftChange: (value: number) => void;
  bedErrors: { name: string; width_ft: string; length_ft: string };
  yardErrors: { yard_width_ft: string; yard_length_ft: string };
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
  selectedCropWindow?: ClimatePlantingWindow;
  isLoadingPlantingWindows: boolean;
  gardenSunPath: GardenSunPath | null;
  isLoadingSunPath: boolean;
  gardenOrientation: Garden["orientation"];
  onSelectCrop: (crop: CropTemplate) => void;
  cropBaseName: (crop: CropTemplate) => string;
  placementBedId: number | null;
  onPlacementBedIdChange: (value: number | null) => void;
  yardGridRef: RefObject<HTMLDivElement>;
  yardCellPx: number;
  toFeet: (inches: number) => string;
  onMoveBedInYard: (bedId: number, x: number, y: number) => Promise<void> | void;
  onNudgeBed: (bedId: number, dx: number, dy: number) => void;
  onRotateBed: (bedId: number, autoFit?: boolean) => Promise<void>;
  onDeleteBed: (bedId: number) => void;
  onAddPlacement: (bedId: number, x: number, y: number) => void;
  onMovePlacement: (placementId: number, bedId: number, x: number, y: number) => void;
  onNudgePlacement: (placementId: number, dx: number, dy: number) => void;
  onBulkMovePlacements: (placementIds: number[], dx: number, dy: number) => void;
  onBulkRemovePlacements: (placementIds: number[]) => void;
  canUndoPlanner: boolean;
  canRedoPlanner: boolean;
  onUndoPlanner: () => void;
  onRedoPlanner: () => void;
  onRequestRemovePlacement: (placementId: number, cropName: string) => void;
  onBlockedPlacementMove: (cropName: string) => void;
  placementSpacingConflict: (bedId: number, x: number, y: number, cropName: string, ignorePlacementId?: number) => string | null;
  isCellBlockedForSelectedCrop: (bedId: number, x: number, y: number, occupant: Placement | undefined) => boolean;
  isCellInBuffer: (bedId: number, x: number, y: number) => boolean;
  gardenSatelliteUrl?: string;
};

export function PlannerPanel({
  isLoadingGardenData,
  beds,
  placements,
  cropTemplates,
  bedName,
  bedWidthFt,
  bedLengthFt,
  yardWidthFt,
  yardLengthFt,
  yardWidthDraft,
  yardLengthDraft,
  onBedNameChange,
  onBedWidthFtChange,
  onBedLengthFtChange,
  onYardWidthDraftChange,
  onYardLengthDraftChange,
  bedErrors,
  yardErrors,
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
  selectedCropWindow,
  isLoadingPlantingWindows,
  gardenSunPath,
  isLoadingSunPath,
  gardenOrientation,
  onSelectCrop,
  cropBaseName,
  placementBedId,
  onPlacementBedIdChange,
  yardGridRef,
  yardCellPx,
  toFeet,
  onMoveBedInYard,
  onNudgeBed,
  onRotateBed,
  onDeleteBed,
  onAddPlacement,
  onMovePlacement,
  onNudgePlacement,
  onBulkMovePlacements,
  onBulkRemovePlacements,
  canUndoPlanner,
  canRedoPlanner,
  onUndoPlanner,
  onRedoPlanner,
  onRequestRemovePlacement,
  onBlockedPlacementMove,
  placementSpacingConflict,
  isCellBlockedForSelectedCrop,
  isCellInBuffer,
  gardenSatelliteUrl,
}: PlannerPanelProps) {
  const fallbackIcons = ["🌱", "🥕", "🍅", "🥬", "🫑", "🥦", "🧅", "🌿", "🍆", "🌶️", "🫘"];
  const hasPlannerCropOptions = filteredCropTemplates.length > 0;
  const [showSunOverlay, setShowSunOverlay] = useState(false);
  const [showShadeOverlay, setShowShadeOverlay] = useState(false);
  const [showGrowthPreview, setShowGrowthPreview] = useState(false);
  const [sunHour, setSunHour] = useState(12);
  const [growthDayOffset, setGrowthDayOffset] = useState(21);
  const [selectedPlacementId, setSelectedPlacementId] = useState<number | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedPlacementIds, setSelectedPlacementIds] = useState<number[]>([]);
  const [lassoStart, setLassoStart] = useState<{ bedId: number; x: number; y: number } | null>(null);
  const [lassoCurrent, setLassoCurrent] = useState<{ bedId: number; x: number; y: number } | null>(null);
  const [selectedBedId, setSelectedBedId] = useState<number | null>(null);
  const [pendingRotation, setPendingRotation] = useState<RotationPreview | null>(null);
  const [isApplyingRotation, setIsApplyingRotation] = useState(false);

  const defaultSunHour = useMemo(() => {
    if (!gardenSunPath) {
      return 12;
    }
    return Math.round((gardenSunPath.sunrise_hour + gardenSunPath.sunset_hour) / 2);
  }, [gardenSunPath]);

  useEffect(() => {
    setSunHour(defaultSunHour);
  }, [defaultSunHour]);

  useEffect(() => {
    if (bulkMode) {
      setSelectedPlacementId(null);
    }
  }, [bulkMode]);

  function setOverlayPreset(preset: "layout" | "sun" | "shade" | "growth") {
    setShowSunOverlay(preset === "sun");
    setShowShadeOverlay(preset === "shade");
    setShowGrowthPreview(preset === "growth");
  }

  const selectedPlacement = useMemo(
    () => placements.find((placement) => placement.id === selectedPlacementId) || null,
    [placements, selectedPlacementId],
  );
  const cropTemplateByName = useMemo(
    () => new Map(cropTemplates.map((crop) => [crop.name.toLowerCase(), crop])),
    [cropTemplates],
  );

  function pickCropIcon(cropName: string) {
    const lowerName = cropName.trim().toLowerCase();
    const crop = cropTemplateByName.get(lowerName);
    const family = crop?.family.trim().toLowerCase() || "";
    const lookup = `${lowerName} ${family}`;

    if (/(tomato)/.test(lookup)) return "🍅";
    if (/(pepper|chile|capsicum)/.test(lookup)) return "🫑";
    if (/(eggplant|aubergine)/.test(lookup)) return "🍆";
    if (/(carrot|parsnip|radish|beet|turnip)/.test(lookup)) return "🥕";
    if (/(onion|garlic|allium|shallot|leek|chive)/.test(lookup)) return "🧅";
    if (/(lettuce|spinach|chard|kale|collard|cabbage|brassica|greens)/.test(lookup)) return "🥬";
    if (/(broccoli|cauliflower|brussels)/.test(lookup)) return "🥦";
    if (/(bean|pea|legume)/.test(lookup)) return "🫘";
    if (/(corn|maize)/.test(lookup)) return "🌽";
    if (/(cucumber|zucchini|squash|pumpkin|melon)/.test(lookup)) return "🥒";
    if (/(herb|basil|cilantro|parsley|dill|oregano|thyme|rosemary|mint)/.test(lookup)) return "🌿";

    const hash = lowerName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return fallbackIcons[hash % fallbackIcons.length] || "🌱";
  }

  function cropVisual(cropName: string) {
    const template = cropTemplateByName.get(cropName.trim().toLowerCase());
    return {
      imageUrl: template?.image_url || "",
      icon: pickCropIcon(cropName),
    };
  }

  function togglePlacementSelection(placementId: number) {
    setSelectedPlacementIds((current) => current.includes(placementId) ? current.filter((id) => id !== placementId) : [...current, placementId]);
  }

  function selectPlacementsInRect(bedId: number, fromX: number, fromY: number, toX: number, toY: number, append: boolean) {
    const minX = Math.min(fromX, toX);
    const maxX = Math.max(fromX, toX);
    const minY = Math.min(fromY, toY);
    const maxY = Math.max(fromY, toY);
    const idsInRect = placements
      .filter((placement) => placement.bed_id === bedId)
      .filter((placement) => placement.grid_x >= minX && placement.grid_x <= maxX && placement.grid_y >= minY && placement.grid_y <= maxY)
      .map((placement) => placement.id);
    setSelectedPlacementIds((current) => {
      if (append) {
        return Array.from(new Set([...current, ...idsInRect]));
      }
      return idsInRect;
    });
  }

  function startLasso(bedId: number, x: number, y: number) {
    if (!bulkMode) {
      return;
    }
    setLassoStart({ bedId, x, y });
    setLassoCurrent({ bedId, x, y });
  }

  function updateLasso(bedId: number, x: number, y: number) {
    if (!lassoStart || lassoStart.bedId !== bedId) {
      return;
    }
    setLassoCurrent({ bedId, x, y });
  }

  function finishLasso(event: MouseEvent<HTMLButtonElement>) {
    if (!lassoStart || !lassoCurrent || lassoStart.bedId !== lassoCurrent.bedId) {
      setLassoStart(null);
      setLassoCurrent(null);
      return;
    }
    selectPlacementsInRect(lassoStart.bedId, lassoStart.x, lassoStart.y, lassoCurrent.x, lassoCurrent.y, event.shiftKey);
    setLassoStart(null);
    setLassoCurrent(null);
  }

  function requestRotatePreview(bed: Bed) {
    const rotatedWidthFt = Math.max(1, Math.ceil(bed.height_in / 12));
    const rotatedLengthFt = Math.max(1, Math.ceil(bed.width_in / 12));
    const fitsCurrent = bed.grid_x + rotatedWidthFt <= yardWidthFt && bed.grid_y + rotatedLengthFt <= yardLengthFt;
    const previewX = Math.min(Math.max(0, bed.grid_x), Math.max(0, yardWidthFt - rotatedWidthFt));
    const previewY = Math.min(Math.max(0, bed.grid_y), Math.max(0, yardLengthFt - rotatedLengthFt));
    const candidateX = fitsCurrent ? bed.grid_x : previewX;
    const candidateY = fitsCurrent ? bed.grid_y : previewY;
    const rotatedLeft = candidateX;
    const rotatedTop = candidateY;
    const rotatedRight = rotatedLeft + rotatedWidthFt;
    const rotatedBottom = rotatedTop + rotatedLengthFt;

    const hasBedOverlap = beds
      .filter((other) => other.id !== bed.id)
      .some((other) => {
        const otherWidthFt = Math.max(1, Math.ceil(other.width_in / 12));
        const otherLengthFt = Math.max(1, Math.ceil(other.height_in / 12));
        const otherLeft = other.grid_x;
        const otherTop = other.grid_y;
        const otherRight = otherLeft + otherWidthFt;
        const otherBottom = otherTop + otherLengthFt;
        return rotatedLeft < otherRight && rotatedRight > otherLeft && rotatedTop < otherBottom && rotatedBottom > otherTop;
      });

    setPendingRotation({
      bedId: bed.id,
      bedName: bed.name,
      currentX: bed.grid_x,
      currentY: bed.grid_y,
      previewX,
      previewY,
      rotatedWidthFt,
      rotatedLengthFt,
      fitsCurrent,
      hasBedOverlap,
    });
  }

  async function confirmRotate(useAutoFit: boolean) {
    if (!pendingRotation) {
      return;
    }
    setIsApplyingRotation(true);
    try {
      await onRotateBed(pendingRotation.bedId, useAutoFit);
      setPendingRotation(null);
    } finally {
      setIsApplyingRotation(false);
    }
  }

  function getBedGridPositionForPoint(bedId: number, clientX: number, clientY: number) {
    if (!yardGridRef.current) {
      return null;
    }
    const bed = beds.find((item) => item.id === bedId);
    if (!bed) {
      return null;
    }

    const rect = yardGridRef.current.getBoundingClientRect();
    const bedWidthFt = Math.max(1, Math.ceil(bed.width_in / 12));
    const bedLengthFt = Math.max(1, Math.ceil(bed.height_in / 12));
    const rawX = (clientX - rect.left) / yardCellPx - bedWidthFt / 2;
    const rawY = (clientY - rect.top) / yardCellPx - bedLengthFt / 2;
    const maxX = Math.max(0, yardWidthFt - bedWidthFt);
    const maxY = Math.max(0, yardLengthFt - bedLengthFt);
    const nextX = Math.min(maxX, Math.max(0, Math.round(rawX)));
    const nextY = Math.min(maxY, Math.max(0, Math.round(rawY)));
    return { nextX, nextY };
  }

  const sunSample = useMemo(() => sampleSunVector(gardenSunPath, sunHour), [gardenSunPath, sunHour]);
  const sunExposure = useMemo(
    () => buildSunExposureGrid(yardWidthFt, yardLengthFt, sunSample, gardenOrientation),
    [yardWidthFt, yardLengthFt, sunSample, gardenOrientation],
  );
  const shadeMap = useMemo(
    () => buildShadeMap(yardWidthFt, yardLengthFt, beds, sunSample),
    [yardWidthFt, yardLengthFt, beds, sunSample],
  );
  const canopyPreview = useMemo(
    () => buildCanopyPreview(beds, placements, cropTemplates, growthDayOffset),
    [beds, placements, cropTemplates, growthDayOffset],
  );

  return (
    <article className="card bed-planner-card">
      <h2>Garden Bed Planner Studio</h2>
      <p className="subhead">Build your layout map, then click inside each bed to place crops with proper spacing.</p>
      {isLoadingGardenData && <p className="hint">Refreshing layout data...</p>}

      <div className="planner-layout">
        <aside className="planner-sidebar">
          <form onSubmit={onCreateBed} className="stack compact planner-panel">
            <h3>Create Bed</h3>
            <label className="field-label" htmlFor="bed-name">Bed Name</label>
            <input id="bed-name" name="name" value={bedName} onChange={(e) => onBedNameChange(e.target.value)} placeholder="Backyard North Bed" aria-invalid={Boolean(bedErrors.name)} aria-describedby={bedErrors.name ? "bed-name-error" : undefined} required />
            {bedErrors.name && <p id="bed-name-error" className="field-error">{bedErrors.name}</p>}
            <div className="mini-row">
              <div className="stack compact">
                <label className="field-label" htmlFor="bed-width-ft">Width (ft)</label>
                <input id="bed-width-ft" name="width_ft" type="number" step="0.5" min="1" value={bedWidthFt} onChange={(e) => onBedWidthFtChange(Number(e.target.value))} placeholder="4" aria-invalid={Boolean(bedErrors.width_ft)} aria-describedby={bedErrors.width_ft ? "bed-width-error" : undefined} required />
                {bedErrors.width_ft && <p id="bed-width-error" className="field-error">{bedErrors.width_ft}</p>}
              </div>
              <div className="stack compact">
                <label className="field-label" htmlFor="bed-length-ft">Length (ft)</label>
                <input id="bed-length-ft" name="length_ft" type="number" step="0.5" min="1" value={bedLengthFt} onChange={(e) => onBedLengthFtChange(Number(e.target.value))} placeholder="8" aria-invalid={Boolean(bedErrors.length_ft)} aria-describedby={bedErrors.length_ft ? "bed-length-error" : undefined} required />
                {bedErrors.length_ft && <p id="bed-length-error" className="field-error">{bedErrors.length_ft}</p>}
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
                {filteredCropTemplates.slice(0, 15).map((crop, index) => (
                  (() => {
                    const isSelected = selectedCropName === crop.name;
                    const isFocused = cropSearchActiveIndex === index;
                    return (
                  <button
                    key={crop.id}
                    id={`planner-crop-option-${crop.id}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`crop-option${isSelected ? " active" : ""}${!isSelected && isFocused ? " focused" : ""}`}
                    onClick={() => onSelectCrop(crop)}
                  >
                    <strong>{cropBaseName(crop)}</strong>
                    <small>{crop.variety || crop.family || "Vegetable"}</small>
                  </button>
                    );
                  })()
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
                {isLoadingPlantingWindows && <p className="hint">Loading dynamic window...</p>}
                {selectedCropWindow && (
                  <>
                    <p className="hint">
                      <strong>Dynamic window:</strong> {selectedCropWindow.window_start} to {selectedCropWindow.window_end} {" "}
                      <span className={`status-pill ${selectedCropWindow.status}`}>{selectedCropWindow.status}</span>
                    </p>
                    {selectedCropWindow.indoor_seed_start && selectedCropWindow.indoor_seed_end && (
                      <p className="hint">
                        <strong>Indoor start:</strong> {selectedCropWindow.indoor_seed_start} to {selectedCropWindow.indoor_seed_end}
                      </p>
                    )}
                    <p className="hint">{selectedCropWindow.reason}</p>
                  </>
                )}
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
            <p className="hint">Touch move: tap a placement chip, then tap an empty square to move it without dragging.</p>
            <p className="hint">Keyboard move: focus a yard bed or placement chip, then use arrow keys to nudge by one grid cell.</p>
            <p className="hint">Placed crops now show picture markers for quick scanning. Hover or focus a marker to see the crop name.</p>
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

          <section className="planner-panel planner-bed-panel">
            <div className="planner-section-head">
              <div>
                <h3>Bed Sheets</h3>
                <p className="hint">Each square is 3 inches. Place crops directly on the grid or drag existing placements between beds.</p>
              </div>
              <div className="planner-history-actions">
                <button type="button" className="secondary-btn" onClick={onUndoPlanner} disabled={!canUndoPlanner}>Undo</button>
                <button type="button" className="secondary-btn" onClick={onRedoPlanner} disabled={!canRedoPlanner}>Redo</button>
              </div>
            </div>

            <div className="planner-bulk-controls" role="group" aria-label="Bulk placement tools">
              <button type="button" className={bulkMode ? "secondary-btn active" : "secondary-btn"} onClick={() => {
                setBulkMode((current) => !current);
                setSelectedPlacementIds([]);
              }}>
                {bulkMode ? "Exit Bulk Select" : "Bulk Select"}
              </button>
              <span className="hint">Selected: {selectedPlacementIds.length}</span>
              <button type="button" className="secondary-btn" onClick={() => setSelectedPlacementIds([])} disabled={selectedPlacementIds.length === 0}>Clear</button>
              <button type="button" className="secondary-btn" onClick={() => onBulkMovePlacements(selectedPlacementIds, -1, 0)} disabled={selectedPlacementIds.length === 0}>←</button>
              <button type="button" className="secondary-btn" onClick={() => onBulkMovePlacements(selectedPlacementIds, 0, -1)} disabled={selectedPlacementIds.length === 0}>↑</button>
              <button type="button" className="secondary-btn" onClick={() => onBulkMovePlacements(selectedPlacementIds, 0, 1)} disabled={selectedPlacementIds.length === 0}>↓</button>
              <button type="button" className="secondary-btn" onClick={() => onBulkMovePlacements(selectedPlacementIds, 1, 0)} disabled={selectedPlacementIds.length === 0}>→</button>
              <button
                type="button"
                className="danger-sm"
                onClick={() => {
                  if (window.confirm(`Remove ${selectedPlacementIds.length} selected placement${selectedPlacementIds.length === 1 ? "" : "s"}?`)) {
                    onBulkRemovePlacements(selectedPlacementIds);
                    setSelectedPlacementIds([]);
                  }
                }}
                disabled={selectedPlacementIds.length === 0}
              >
                Remove selected
              </button>
              {bulkMode && <p className="hint">Drag across a bed to lasso select placements. Shift+drag adds to selection.</p>}
            </div>

            {selectedPlacement && (
              <div className="planner-selection-banner" role="status" aria-live="polite">
                <span>
                  Moving <strong>{selectedPlacement.crop_name}</strong> from bed {selectedPlacement.bed_id}. Tap an empty square to place it.
                </span>
                <button type="button" className="secondary-btn" onClick={() => setSelectedPlacementId(null)}>Cancel move</button>
              </div>
            )}

            <div className="bed-detail-grid">
              {beds.map((bed) => {
                const cols = Math.max(1, Math.ceil(bed.width_in / 3));
                const rows = Math.max(1, Math.ceil(bed.height_in / 3));
                const bedPlacements = placements.filter((item) => item.bed_id === bed.id);

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
                        const occupant = bedPlacements.find((item) => item.grid_x === x && item.grid_y === y);
                        const blockedForSelected = isCellBlockedForSelectedCrop(bed.id, x, y, occupant);
                        const inBuffer = isCellInBuffer(bed.id, x, y);

                        return (
                          <button
                            key={`${bed.id}-${x}-${y}`}
                            className={`plot-cell${occupant ? " occupied" : ""}${blockedForSelected ? " blocked" : ""}${inBuffer ? " buffer" : ""}${occupant && selectedPlacementIds.includes(occupant.id) ? " selected" : ""}`}
                            style={occupant ? { borderColor: occupant.color } : undefined}
                            onMouseDown={() => startLasso(bed.id, x, y)}
                            onMouseEnter={() => updateLasso(bed.id, x, y)}
                            onMouseUp={finishLasso}
                            onClick={() => {
                              if (bulkMode) {
                                if (occupant) {
                                  togglePlacementSelection(occupant.id);
                                }
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
                            title={blockedForSelected ? `Blocked: too close for ${selectedCropName} spacing` : inBuffer ? "Buffer zone - cannot plant here" : undefined}
                            aria-label={
                              inBuffer
                                ? `Buffer zone at column ${x + 1}, row ${y + 1}`
                                : occupant
                                ? `${occupant.crop_name} at column ${x + 1}, row ${y + 1}`
                                : `Empty square column ${x + 1}, row ${y + 1}`
                            }
                          >
                            {occupant ? (
                              (() => {
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
                            ) : ""}
                          </button>
                        );
                      })}
                    </div>

                    <div className="bed-legend" aria-label={`${bed.name} crop legend`}>
                      {Array.from(new Map(bedPlacements.map((placement) => [placement.crop_name, (bedPlacements.filter((item) => item.crop_name === placement.crop_name).length)])).entries()).map(([cropName, count]) => {
                        const visual = cropVisual(cropName);
                        return (
                          <span key={`${bed.id}-${cropName}`} className="bed-legend-item">
                            {visual.imageUrl ? <img className="legend-photo" src={visual.imageUrl} alt="" loading="lazy" /> : <span className="legend-icon" aria-hidden="true">{visual.icon}</span>}
                            <span>{cropName} ({count})</span>
                          </span>
                        );
                      })}
                      {bedPlacements.length === 0 && <span className="hint">No crops to show in legend yet.</span>}
                    </div>

                    <ul className="chip-list">
                      {bedPlacements.map((placement) => (
                        <li key={placement.id} className="chip-row">
                          <button
                            className={selectedPlacementId === placement.id ? "chip selected" : "chip"}
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
                            onClick={() => {
                              if (bulkMode) {
                                togglePlacementSelection(placement.id);
                                return;
                              }
                              setSelectedPlacementId((current) => current === placement.id ? null : placement.id);
                            }}
                          >
                            {selectedPlacementId === placement.id ? `Tap a square for ${placement.crop_name}` : `${placement.crop_name} (${placement.grid_x + 1},${placement.grid_y + 1})`}
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
                      {bedPlacements.length === 0 && <li>No crop placements yet.</li>}
                    </ul>
                  </section>
                );
              })}
            </div>
          </section>

          <section className="planner-panel planner-yard-panel">
            <div className="planner-yard-header">
              <div>
                <div className="planner-yard-title-row">
                  <h3>Yard Layout</h3>
                  {gardenSatelliteUrl && (
                    <a href={gardenSatelliteUrl} target="_blank" rel="noopener noreferrer" className="map-ref-link">
                      Satellite view ↗
                    </a>
                  )}
                </div>
                <p className="hint">Drag beds into the yard and resize the yard as you refine the plan.</p>
                <p className="hint">Touch move beds: choose a bed below, then tap in the yard to place it, or use the arrow controls for one-cell nudges.</p>
                {isLoadingSunPath && <p className="hint">Loading sun-path model...</p>}
                {sunSample && (
                  <p className="hint">
                    Sun sample: {sunSample.hourLocal}:00 &middot; az {sunSample.azimuthDeg.toFixed(0)}&deg; &middot; alt {sunSample.altitudeDeg.toFixed(0)}&deg;
                  </p>
                )}
              </div>
              <form onSubmit={onUpdateYardSize} className="yard-size-form">
                <div className="mini-row">
                  <div className="stack compact">
                    <label className="field-label" htmlFor="yard-width-draft">Yard Width (ft)</label>
                    <input id="yard-width-draft" type="number" min="4" value={yardWidthDraft} onChange={(e) => onYardWidthDraftChange(Number(e.target.value))} aria-invalid={Boolean(yardErrors.yard_width_ft)} aria-describedby={yardErrors.yard_width_ft ? "yard-width-error" : undefined} required />
                    {yardErrors.yard_width_ft && <p id="yard-width-error" className="field-error">{yardErrors.yard_width_ft}</p>}
                  </div>
                  <div className="stack compact">
                    <label className="field-label" htmlFor="yard-length-draft">Yard Length (ft)</label>
                    <input id="yard-length-draft" type="number" min="4" value={yardLengthDraft} onChange={(e) => onYardLengthDraftChange(Number(e.target.value))} aria-invalid={Boolean(yardErrors.yard_length_ft)} aria-describedby={yardErrors.yard_length_ft ? "yard-length-error" : undefined} required />
                    {yardErrors.yard_length_ft && <p id="yard-length-error" className="field-error">{yardErrors.yard_length_ft}</p>}
                  </div>
                </div>
                <button type="submit">Save Yard Size</button>
              </form>
            </div>

            <div className="bed-move-controls" role="group" aria-label="Bed movement controls">
              {beds.map((bed) => (
                <div key={bed.id} className={`bed-move-row${selectedBedId === bed.id ? " active" : ""}`}>
                  <button type="button" className="secondary-btn" onClick={() => setSelectedBedId((current) => current === bed.id ? null : bed.id)}>
                    {selectedBedId === bed.id ? `Placing: ${bed.name}` : `Select ${bed.name}`}
                  </button>
                  <button type="button" className="secondary-btn bed-move-btn" onClick={() => onNudgeBed(bed.id, -1, 0)} aria-label={`Move ${bed.name} left`}>←</button>
                  <button type="button" className="secondary-btn bed-move-btn" onClick={() => onNudgeBed(bed.id, 0, -1)} aria-label={`Move ${bed.name} up`}>↑</button>
                  <button type="button" className="secondary-btn bed-move-btn" onClick={() => onNudgeBed(bed.id, 0, 1)} aria-label={`Move ${bed.name} down`}>↓</button>
                  <button type="button" className="secondary-btn bed-move-btn" onClick={() => onNudgeBed(bed.id, 1, 0)} aria-label={`Move ${bed.name} right`}>→</button>
                  <button type="button" className="secondary-btn bed-move-btn" onClick={() => requestRotatePreview(bed)} aria-label={`Rotate ${bed.name}`}>⟳</button>
                </div>
              ))}
            </div>

            {pendingRotation && (
              <div className={`planner-selection-banner${pendingRotation.hasBedOverlap ? " blocked" : ""}`} role="status" aria-live="polite">
                <span>
                  Rotate <strong>{pendingRotation.bedName}</strong> to {pendingRotation.rotatedWidthFt} x {pendingRotation.rotatedLengthFt} ft.
                  {!pendingRotation.fitsCurrent && " Current spot is out of bounds after rotate."}
                  {pendingRotation.hasBedOverlap && " Rotation would overlap another bed in the yard."}
                </span>
                <div className="panel-actions">
                  <button type="button" className="secondary-btn" onClick={() => setPendingRotation(null)} disabled={isApplyingRotation}>Cancel</button>
                  {!pendingRotation.fitsCurrent && !pendingRotation.hasBedOverlap && (
                    <button type="button" className="secondary-btn" onClick={() => confirmRotate(true)} disabled={isApplyingRotation}>Auto-fit rotate</button>
                  )}
                  <button type="button" onClick={() => confirmRotate(false)} disabled={isApplyingRotation || pendingRotation.hasBedOverlap || !pendingRotation.fitsCurrent}>
                    {isApplyingRotation ? "Rotating..." : "Rotate now"}
                  </button>
                </div>
              </div>
            )}

            <div className="spatial-controls">
              <div className="spatial-presets" role="group" aria-label="Planner overlay presets">
                <button type="button" className={!showSunOverlay && !showShadeOverlay && !showGrowthPreview ? "secondary-btn active" : "secondary-btn"} onClick={() => setOverlayPreset("layout")}>Layout only</button>
                <button type="button" className={showSunOverlay && !showShadeOverlay && !showGrowthPreview ? "secondary-btn active" : "secondary-btn"} onClick={() => setOverlayPreset("sun")}>Sun</button>
                <button type="button" className={showShadeOverlay && !showSunOverlay && !showGrowthPreview ? "secondary-btn active" : "secondary-btn"} onClick={() => setOverlayPreset("shade")}>Shade</button>
                <button type="button" className={showGrowthPreview && !showSunOverlay && !showShadeOverlay ? "secondary-btn active" : "secondary-btn"} onClick={() => setOverlayPreset("growth")}>Growth</button>
              </div>
              <div className="spatial-legend" aria-label="Planner overlay legend">
                <span className="spatial-legend-item"><span className="spatial-swatch bed" /> Beds</span>
                <span className="spatial-legend-item"><span className="spatial-swatch sun" /> Sun</span>
                <span className="spatial-legend-item"><span className="spatial-swatch shade" /> Shade</span>
                <span className="spatial-legend-item"><span className="spatial-swatch canopy" /> Canopy</span>
              </div>
              <label className="spatial-toggle">
                <input type="checkbox" checked={showSunOverlay} onChange={(event) => setShowSunOverlay(event.target.checked)} />
                Sun exposure overlay
              </label>
              <label className="spatial-toggle">
                <input type="checkbox" checked={showShadeOverlay} onChange={(event) => setShowShadeOverlay(event.target.checked)} />
                Shade simulation
              </label>
              <label className="spatial-toggle">
                <input type="checkbox" checked={showGrowthPreview} onChange={(event) => setShowGrowthPreview(event.target.checked)} />
                Plant canopy growth preview
              </label>
              <label className="field-label" htmlFor="planner-sun-hour">Sun Hour</label>
              <input
                id="planner-sun-hour"
                type="range"
                min={Math.max(5, Math.floor(gardenSunPath?.sunrise_hour || 6))}
                max={Math.min(20, Math.ceil(gardenSunPath?.sunset_hour || 19))}
                value={sunHour}
                disabled={!showSunOverlay && !showShadeOverlay}
                onChange={(event) => setSunHour(Number(event.target.value))}
              />
              <label className="field-label" htmlFor="planner-growth-offset">Growth Preview (days)</label>
              <input
                id="planner-growth-offset"
                type="range"
                min={0}
                max={90}
                value={growthDayOffset}
                disabled={!showGrowthPreview}
                onChange={(event) => setGrowthDayOffset(Number(event.target.value))}
              />
            </div>

            <div className="yard-grid-wrap">
              <div
                className="yard-grid"
                ref={yardGridRef}
                style={{ width: yardWidthFt * yardCellPx, height: yardLengthFt * yardCellPx, backgroundSize: `${yardCellPx}px ${yardCellPx}px` }}
                onClick={(event) => {
                  if (!selectedBedId) {
                    return;
                  }
                  if (event.target instanceof HTMLElement && event.target.closest(".yard-bed")) {
                    return;
                  }
                  const nextPosition = getBedGridPositionForPoint(selectedBedId, event.clientX, event.clientY);
                  if (!nextPosition) {
                    return;
                  }
                  onMoveBedInYard(selectedBedId, nextPosition.nextX, nextPosition.nextY);
                }}
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
                  const nextPosition = getBedGridPositionForPoint(payload.bedId, event.clientX, event.clientY);
                  if (!nextPosition) {
                    return;
                  }
                  onMoveBedInYard(payload.bedId, nextPosition.nextX, nextPosition.nextY);
                }}
              >
                {showSunOverlay && (
                  <div className="yard-overlay-layer" aria-hidden="true">
                    {sunExposure.map((cell) => (
                      <span
                        key={`sun-${cell.x}-${cell.y}`}
                        className="yard-overlay-cell sun"
                        style={{
                          left: cell.x * yardCellPx,
                          top: cell.y * yardCellPx,
                          width: yardCellPx,
                          height: yardCellPx,
                          opacity: Math.max(0.08, cell.exposure * 0.6),
                        }}
                      />
                    ))}
                  </div>
                )}
                {showShadeOverlay && (
                  <div className="yard-overlay-layer" aria-hidden="true">
                    {shadeMap.map((cell) => (
                      <span
                        key={`shade-${cell.x}-${cell.y}`}
                        className="yard-overlay-cell shade"
                        style={{
                          left: cell.x * yardCellPx,
                          top: cell.y * yardCellPx,
                          width: yardCellPx,
                          height: yardCellPx,
                          opacity: Math.max(0, cell.shade * 0.65),
                        }}
                      />
                    ))}
                  </div>
                )}
                {showGrowthPreview && (
                  <div className="yard-overlay-layer" aria-hidden="true">
                    {canopyPreview.map((canopy) => (
                      <span
                        key={`canopy-${canopy.placementId}`}
                        className="yard-canopy"
                        style={{
                          left: canopy.centerXFt * yardCellPx - canopy.radiusFt * yardCellPx,
                          top: canopy.centerYFt * yardCellPx - canopy.radiusFt * yardCellPx,
                          width: canopy.radiusFt * 2 * yardCellPx,
                          height: canopy.radiusFt * 2 * yardCellPx,
                          opacity: Math.max(0.2, canopy.progress * 0.5 + 0.2),
                        }}
                        title={`${canopy.cropName} canopy in ${growthDayOffset} days`}
                      />
                    ))}
                  </div>
                )}
                {pendingRotation && (
                  <div
                    className={`yard-bed ghost${pendingRotation.fitsCurrent && !pendingRotation.hasBedOverlap ? "" : " conflict"}`}
                    aria-hidden="true"
                    style={{
                      left: (pendingRotation.fitsCurrent ? pendingRotation.currentX : pendingRotation.previewX) * yardCellPx,
                      top: (pendingRotation.fitsCurrent ? pendingRotation.currentY : pendingRotation.previewY) * yardCellPx,
                      width: pendingRotation.rotatedWidthFt * yardCellPx,
                      height: pendingRotation.rotatedLengthFt * yardCellPx,
                    }}
                  />
                )}
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
                        } else if (event.key === "r" || event.key === "R") {
                          event.preventDefault();
                          requestRotatePreview(bed);
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
        </div>
      </div>
    </article>
  );
}
