import { FormEvent, KeyboardEvent } from "react";
import { Bed, CropTemplate } from "../types";
import { cropBaseName } from "../app/utils/cropUtils";

type CalendarPlantingFormProps = {
  beds: Bed[];
  selectedDate: string;
  selectedCropName: string;
  filteredCropTemplates: CropTemplate[];
  cropSearchQuery: string;
  setCropSearchQuery: (value: string) => void;
  handleCropSearchKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  cropSearchActiveIndex: number;
  selectCrop: (crop: CropTemplate) => void;
  setPlantingCropCleared: () => void;
  plantingFormErrors: { bed_id: string; crop_name: string; planted_on: string };
  handlePlantingFieldBlur: (field: "bed_id" | "crop_name" | "planted_on", value: string) => void;
  handlePlantingSubmit: (event: FormEvent<HTMLFormElement>) => void;
  selectedCrop?: CropTemplate;
  selectedCropWindow?: {
    window_start: string;
    window_end: string;
    status: string;
    reason: string;
    indoor_seed_start: string | null;
    indoor_seed_end: string | null;
  };
  isLoadingPlantingWindows: boolean;
};

export function CalendarPlantingForm({
  beds,
  selectedDate,
  selectedCropName,
  filteredCropTemplates,
  cropSearchQuery,
  setCropSearchQuery,
  handleCropSearchKeyDown,
  cropSearchActiveIndex,
  selectCrop,
  setPlantingCropCleared,
  plantingFormErrors,
  handlePlantingFieldBlur,
  handlePlantingSubmit,
  selectedCrop,
  selectedCropWindow,
  isLoadingPlantingWindows,
}: CalendarPlantingFormProps) {
  const hasCalendarCropOptions = filteredCropTemplates.length > 0;

  return (
    <>
      <h4>Add Planting</h4>
      <form onSubmit={handlePlantingSubmit} className="stack compact">
        <div className="stack compact">
          <label className="field-label" htmlFor="planting-bed">Bed</label>
          <select id="planting-bed" name="bed_id" defaultValue={beds[0]?.id || ""} aria-invalid={Boolean(plantingFormErrors.bed_id)} aria-describedby={plantingFormErrors.bed_id ? "planting-bed-error" : undefined} onBlur={(event) => handlePlantingFieldBlur("bed_id", event.currentTarget.value)} required>
            {beds.map((bed) => (
              <option key={bed.id} value={bed.id}>
                {bed.name}
              </option>
            ))}
          </select>
          {plantingFormErrors.bed_id && <p id="planting-bed-error" className="field-error">{plantingFormErrors.bed_id}</p>}
        </div>
        <input type="hidden" name="crop_name" value={selectedCropName} />
        <div className="crop-picker">
          <label className="field-label" htmlFor="calendar-crop-search">Search Vegetable</label>
          <input
            id="calendar-crop-search"
            value={cropSearchQuery}
            onChange={(event) => setCropSearchQuery(event.target.value)}
            onKeyDown={handleCropSearchKeyDown}
            onBlur={() => handlePlantingFieldBlur("crop_name", selectedCropName)}
            placeholder="Search by vegetable, variety, or family"
            role="combobox"
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-controls="calendar-crop-list"
            aria-expanded={hasCalendarCropOptions}
            aria-activedescendant={hasCalendarCropOptions && filteredCropTemplates[cropSearchActiveIndex] ? `calendar-crop-option-${filteredCropTemplates[cropSearchActiveIndex].id}` : undefined}
          />
          <div id="calendar-crop-list" className="crop-picker-list" role="listbox" aria-label="Vegetable search results">
            {filteredCropTemplates.slice(0, 15).map((crop, index) => {
              const isSelected = selectedCropName === crop.name;
              const isFocused = cropSearchActiveIndex === index;
              return (
                <button
                  key={crop.id}
                  id={`calendar-crop-option-${crop.id}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`crop-option${isSelected ? " active" : ""}${!isSelected && isFocused ? " focused" : ""}`}
                  onClick={() => {
                    selectCrop(crop);
                    setPlantingCropCleared();
                  }}
                >
                  <strong>{cropBaseName(crop)}</strong>
                  <small>{crop.variety || crop.family || "Vegetable"}</small>
                </button>
              );
            })}
            {filteredCropTemplates.length === 0 && <p className="hint">No vegetables match that search.</p>}
          </div>
          {plantingFormErrors.crop_name && <p className="field-error">{plantingFormErrors.crop_name}</p>}
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
        <div className="stack compact">
          <label className="field-label" htmlFor="planting-date">Planting Date</label>
          <input id="planting-date" name="planted_on" type="date" defaultValue={selectedDate} aria-invalid={Boolean(plantingFormErrors.planted_on)} aria-describedby={plantingFormErrors.planted_on ? "planting-date-error" : undefined} onBlur={(event) => handlePlantingFieldBlur("planted_on", event.currentTarget.value)} required />
          {plantingFormErrors.planted_on && <p id="planting-date-error" className="field-error">{plantingFormErrors.planted_on}</p>}
        </div>
        <div className="stack compact">
          <label className="field-label" htmlFor="planting-source">Source</label>
          <input id="planting-source" name="source" placeholder="Source (seed, transplant...)" />
        </div>
        <button type="submit" disabled={filteredCropTemplates.length === 0 || !selectedCropName}>Add planting</button>
      </form>
    </>
  );
}
