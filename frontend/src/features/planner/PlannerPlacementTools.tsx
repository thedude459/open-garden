import { KeyboardEvent } from "react";
import { Bed, ClimatePlantingWindow, CropTemplate, PlantingLocation, PlantingMethod } from "../types";
import { Badge } from "@/components/ui/badge";

type PlannerPlacementToolsProps = {
  cropSearchQuery: string;
  onCropSearchQueryChange: (value: string) => void;
  onCropSearchKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  filteredCropTemplates: CropTemplate[];
  cropSearchActiveIndex: number;
  selectedCropName: string;
  selectedCrop?: CropTemplate;
  selectedCropWindow?: ClimatePlantingWindow;
  isLoadingPlantingWindows: boolean;
  onSelectCrop: (crop: CropTemplate) => void;
  cropBaseName: (crop: CropTemplate) => string;
  beds: Bed[];
  placementBedId: number | null;
  onPlacementBedIdChange: (value: number | null) => void;
  onGoToCrops: () => void;
  plantingMethod: PlantingMethod;
  setPlantingMethod: (value: PlantingMethod) => void;
  plantingLocation: PlantingLocation;
  setPlantingLocation: (value: PlantingLocation) => void;
  plantingDate: string;
  setPlantingDate: (value: string) => void;
  plantingMovedOn: string | null;
  setPlantingMovedOn: (value: string | null) => void;
};

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map((part) => Number(part));
  const date = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function PlannerPlacementTools({
  cropSearchQuery,
  onCropSearchQueryChange,
  onCropSearchKeyDown,
  filteredCropTemplates,
  cropSearchActiveIndex,
  selectedCropName,
  selectedCrop,
  selectedCropWindow,
  isLoadingPlantingWindows,
  onSelectCrop,
  cropBaseName,
  beds,
  placementBedId,
  onPlacementBedIdChange,
  onGoToCrops,
  plantingMethod,
  setPlantingMethod,
  plantingLocation,
  setPlantingLocation,
  plantingDate,
  setPlantingDate,
  plantingMovedOn,
  setPlantingMovedOn,
}: PlannerPlacementToolsProps) {
  const hasPlannerCropOptions = filteredCropTemplates.length > 0;

  // Choose a friendly label that matches what the date actually represents
  // for the chosen method+location combination. This keeps the workflow
  // legible during winter planning, where users are setting future dates
  // for seed-starts, direct sows, and transplants.
  const dateLabel =
    plantingLocation === "indoor"
      ? "Seed start date (indoors)"
      : plantingMethod === "direct_seed"
      ? "Direct sow date (in bed)"
      : "Transplant date (in bed)";

  const dateHint =
    plantingLocation === "indoor"
      ? "When you'll start the seeds under lights or in a greenhouse."
      : plantingMethod === "direct_seed"
      ? "When you'll sow seeds straight into this bed."
      : "When you'll set the seedlings into this bed.";

  const weeksToTransplant =
    selectedCrop?.weeks_to_transplant && selectedCrop.weeks_to_transplant > 0
      ? selectedCrop.weeks_to_transplant
      : 6;
  const defaultMovedOn =
    plantingDate && plantingLocation === "indoor"
      ? addDays(plantingDate, weeksToTransplant * 7)
      : "";

  return (
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
          {filteredCropTemplates.slice(0, 15).map((crop, index) => {
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
          })}
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
                <strong>Dynamic window:</strong> {selectedCropWindow.window_start} to {selectedCropWindow.window_end}{" "}
                <Badge variant="outline">{selectedCropWindow.status}</Badge>
              </p>
              {selectedCropWindow.indoor_seed_start && selectedCropWindow.indoor_seed_end && (
                <p className="hint">
                  <strong>Indoor start:</strong> {selectedCropWindow.indoor_seed_start} to {selectedCropWindow.indoor_seed_end}{" "}
                  (typical sow range so seedlings are ready when this outdoor window opens—not a rule about your exact seed-start date.)
                </p>
              )}
              <p className="hint">{selectedCropWindow.reason}</p>
              {plantingLocation === "indoor" && selectedCropWindow.method === "transplant" && (
                <p className="hint">
                  <strong>Your plan:</strong> use <strong>Planned move-to-bed</strong> for the real transplant date—usually about{" "}
                  {weeksToTransplant} weeks after your seed-start date, or whenever seedlings are sturdy enough, even if the outdoor window
                  above is already “open.”
                </p>
              )}
            </>
          )}
          <p className="hint">Spacing {selectedCrop.spacing_in} in &middot; Harvest in ~{selectedCrop.days_to_harvest} days</p>
          {selectedCrop.notes && <p className="hint crop-notes">{selectedCrop.notes}</p>}
        </div>
      )}
      <fieldset className="planner-planting-settings" aria-label="Planting method and location">
        <legend className="field-label">Plant as</legend>
        <div className="planner-segmented" role="group" aria-label="Planting method">
          <button
            type="button"
            className={`planner-segmented__btn${plantingMethod === "direct_seed" ? " is-active" : ""}`}
            aria-pressed={plantingMethod === "direct_seed"}
            onClick={() => setPlantingMethod("direct_seed")}
          >
            Direct seed
          </button>
          <button
            type="button"
            className={`planner-segmented__btn${plantingMethod === "transplant" ? " is-active" : ""}`}
            aria-pressed={plantingMethod === "transplant"}
            onClick={() => setPlantingMethod("transplant")}
          >
            Transplant
          </button>
        </div>
        <legend className="field-label">Start in</legend>
        <div className="planner-segmented" role="group" aria-label="Planting location">
          <button
            type="button"
            className={`planner-segmented__btn${plantingLocation === "in_bed" ? " is-active" : ""}`}
            aria-pressed={plantingLocation === "in_bed"}
            onClick={() => setPlantingLocation("in_bed")}
          >
            Bed
          </button>
          <button
            type="button"
            className={`planner-segmented__btn${plantingLocation === "indoor" ? " is-active" : ""}`}
            aria-pressed={plantingLocation === "indoor"}
            onClick={() => setPlantingLocation("indoor")}
          >
            Indoor
          </button>
        </div>
      </fieldset>
      <fieldset className="planner-planting-dates" aria-label="Planting dates">
        <legend className="field-label">{dateLabel}</legend>
        <input
          type="date"
          value={plantingDate}
          onChange={(event) => setPlantingDate(event.target.value)}
          aria-label={dateLabel}
        />
        <p className="hint">{dateHint} Pick any date — future dates work for season planning.</p>
        {plantingLocation === "indoor" && (
          <>
            <label className="field-label" htmlFor="planner-planned-move">
              Planned move-to-bed date (optional)
            </label>
            <div className="planner-planting-dates__row">
              <input
                id="planner-planned-move"
                type="date"
                value={plantingMovedOn ?? ""}
                placeholder={defaultMovedOn}
                min={plantingDate || undefined}
                onChange={(event) =>
                  setPlantingMovedOn(event.target.value ? event.target.value : null)
                }
                aria-label="Planned move-to-bed date"
              />
              {plantingMovedOn && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setPlantingMovedOn(null)}
                  aria-label="Clear planned move-to-bed date"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="hint">
              {plantingMovedOn
                ? "Tasks (harden-off, transplant, harvest) anchor on this date."
                : selectedCrop
                ? `Defaults to seed start + ${weeksToTransplant} week${weeksToTransplant === 1 ? "" : "s"} (${defaultMovedOn || "—"}).`
                : "Pick a crop to see the suggested transplant date."}
            </p>
          </>
        )}
      </fieldset>
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
  );
}
