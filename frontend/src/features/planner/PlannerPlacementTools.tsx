import { KeyboardEvent } from "react";
import { Bed, ClimatePlantingWindow, CropTemplate } from "../types";

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
};

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
}: PlannerPlacementToolsProps) {
  const hasPlannerCropOptions = filteredCropTemplates.length > 0;

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
  );
}
