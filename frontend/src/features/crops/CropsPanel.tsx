import { FormEvent } from "react";
import { CropTemplate, CropTemplateSyncStatus } from "../types";

type CropsPanelProps = {
  cropTemplates: CropTemplate[];
  isRefreshingLibrary: boolean;
  isCleaningLegacyLibrary: boolean;
  syncStatus: CropTemplateSyncStatus | null;
  onRefreshLibrary: () => void;
  onCleanupLegacyLibrary: () => void;
  editingCropId: number | null;
  newCropName: string;
  onNewCropNameChange: (value: string) => void;
  newCropVariety: string;
  onNewCropVarietyChange: (value: string) => void;
  newCropFamily: string;
  onNewCropFamilyChange: (value: string) => void;
  newCropSpacing: number;
  onNewCropSpacingChange: (value: number) => void;
  newCropDays: number;
  onNewCropDaysChange: (value: number) => void;
  newCropPlantingWindow: string;
  onNewCropPlantingWindowChange: (value: string) => void;
  newCropDirectSow: boolean;
  onNewCropDirectSowChange: (value: boolean) => void;
  newCropFrostHardy: boolean;
  onNewCropFrostHardyChange: (value: boolean) => void;
  newCropWeeksToTransplant: number;
  onNewCropWeeksToTransplantChange: (value: number) => void;
  newCropNotes: string;
  onNewCropNotesChange: (value: string) => void;
  onUpsertCropTemplate: (e: FormEvent<HTMLFormElement>) => void;
  onResetCropForm: () => void;
  onPopulateCropForm: (crop: CropTemplate) => void;
  cropBaseName: (crop: CropTemplate) => string;
};

export function CropsPanel({
  cropTemplates,
  isRefreshingLibrary,
  isCleaningLegacyLibrary,
  syncStatus,
  onRefreshLibrary,
  onCleanupLegacyLibrary,
  editingCropId,
  newCropName,
  onNewCropNameChange,
  newCropVariety,
  onNewCropVarietyChange,
  newCropFamily,
  onNewCropFamilyChange,
  newCropSpacing,
  onNewCropSpacingChange,
  newCropDays,
  onNewCropDaysChange,
  newCropPlantingWindow,
  onNewCropPlantingWindowChange,
  newCropDirectSow,
  onNewCropDirectSowChange,
  newCropFrostHardy,
  onNewCropFrostHardyChange,
  newCropWeeksToTransplant,
  onNewCropWeeksToTransplantChange,
  newCropNotes,
  onNewCropNotesChange,
  onUpsertCropTemplate,
  onResetCropForm,
  onPopulateCropForm,
  cropBaseName,
}: CropsPanelProps) {
  const importedCount = cropTemplates.filter((crop) => crop.source === "johnnys-selected-seeds").length;
  const manualCount = cropTemplates.length - importedCount;
  const isSyncRunning = Boolean(syncStatus?.is_running);

  return (
    <div className="crops-layout">
      <section className="card">
        <h2>Crop Library</h2>
        <p className="subhead">
          {cropTemplates.length} crop template{cropTemplates.length !== 1 ? "s" : ""} available.
          {` ${importedCount} imported from Johnny's, ${manualCount} manual.`}
        </p>
        {syncStatus && (
          <div className="hint crop-notes">
            <strong>Catalog sync:</strong> {syncStatus.message}
            {syncStatus.is_running ? " This runs in the background and may take about a minute." : ""}
            {!syncStatus.is_running && syncStatus.last_finished_at && ` Last finished ${new Date(syncStatus.last_finished_at).toLocaleString()}.`}
            {!syncStatus.is_running && syncStatus.status === "succeeded" && ` Added ${syncStatus.added}, updated ${syncStatus.updated}, failed ${syncStatus.failed}.`}
            {!syncStatus.is_running && syncStatus.cleaned_legacy_count > 0 && ` Removed ${syncStatus.cleaned_legacy_count} legacy starter template${syncStatus.cleaned_legacy_count !== 1 ? "s" : ""}.`}
            {syncStatus.error && ` Error: ${syncStatus.error}`}
          </div>
        )}
        <div className="panel-actions">
          <button type="button" className="secondary-btn" onClick={onRefreshLibrary} disabled={isRefreshingLibrary || isSyncRunning || isCleaningLegacyLibrary}>
            {isRefreshingLibrary || isSyncRunning ? "Syncing crop database..." : "Update Crop Database"}
          </button>
          <button type="button" className="secondary-btn" onClick={onCleanupLegacyLibrary} disabled={isRefreshingLibrary || isSyncRunning || isCleaningLegacyLibrary}>
            {isCleaningLegacyLibrary ? "Removing legacy starter crops..." : "Remove Legacy Starter Crops"}
          </button>
        </div>
        <div className="crops-grid">
          {cropTemplates.map((crop) => (
            <div key={crop.id} className="crop-card">
              <div className="crop-card-row">
                <span>
                  <strong>{cropBaseName(crop)}</strong>
                  {crop.variety && <span className="crop-tag variety">{crop.variety}</span>}
                  {crop.family && <span className="crop-tag family">{crop.family}</span>}
                  <span className="crop-tag family">{crop.source === "johnnys-selected-seeds" ? "Johnny's" : "Manual"}</span>
                </span>
                <span>
                  {crop.frost_hardy
                    ? <span className="crop-tag frost">Frost hardy</span>
                    : <span className="crop-tag warm">Warm season</span>}
                  {crop.direct_sow
                    ? <span className="crop-tag sow">Direct sow</span>
                    : <span className="crop-tag transplant">Start indoors {crop.weeks_to_transplant}wk</span>}
                </span>
              </div>
              <p className="hint"><strong>When to plant:</strong> {crop.planting_window}</p>
              <p className="hint">Spacing {crop.spacing_in} in &middot; Harvest ~{crop.days_to_harvest} days</p>
              {crop.notes && <p className="hint crop-notes">{crop.notes}</p>}
              <button type="button" className="secondary-btn" onClick={() => onPopulateCropForm(crop)}>
                Edit
              </button>
            </div>
          ))}
          {cropTemplates.length === 0 && (
            <p className="hint">No crops yet. Add your first crop using the form.</p>
          )}
        </div>
      </section>

      <form onSubmit={onUpsertCropTemplate} className="card stack compact">
        <h2>{editingCropId ? "Edit Crop" : "Add Crop"}</h2>
        <label className="field-label" htmlFor="crop-name">Crop Name</label>
        <input id="crop-name" value={newCropName} onChange={(e) => onNewCropNameChange(e.target.value)} placeholder="Broccoli" required />
        <div className="mini-row">
          <div className="stack compact">
            <label className="field-label" htmlFor="crop-variety">Variety</label>
            <input id="crop-variety" value={newCropVariety} onChange={(e) => onNewCropVarietyChange(e.target.value)} placeholder="Calabrese" />
          </div>
          <div className="stack compact">
            <label className="field-label" htmlFor="crop-family">Family</label>
            <input id="crop-family" value={newCropFamily} onChange={(e) => onNewCropFamilyChange(e.target.value)} placeholder="Brassicaceae" />
          </div>
        </div>
        <div className="mini-row">
          <div className="stack compact">
            <label className="field-label" htmlFor="crop-spacing">Spacing (in)</label>
            <input id="crop-spacing" value={newCropSpacing} onChange={(e) => onNewCropSpacingChange(Number(e.target.value))} type="number" min="1" placeholder="18" required />
          </div>
          <div className="stack compact">
            <label className="field-label" htmlFor="crop-days">Days to Harvest</label>
            <input id="crop-days" value={newCropDays} onChange={(e) => onNewCropDaysChange(Number(e.target.value))} type="number" min="1" placeholder="70" required />
          </div>
        </div>
        <label className="field-label" htmlFor="crop-window">When to Plant</label>
        <input id="crop-window" value={newCropPlantingWindow} onChange={(e) => onNewCropPlantingWindowChange(e.target.value)} placeholder="Early spring" required />
        <div className="inline-checks">
          <label className="inline">
            <input type="checkbox" checked={newCropDirectSow} onChange={(e) => onNewCropDirectSowChange(e.target.checked)} />
            Direct sow
          </label>
          <label className="inline">
            <input type="checkbox" checked={newCropFrostHardy} onChange={(e) => onNewCropFrostHardyChange(e.target.checked)} />
            Frost hardy
          </label>
        </div>
        {!newCropDirectSow && (
          <>
            <label className="field-label" htmlFor="crop-wtt">Weeks to start indoors before transplant</label>
            <input id="crop-wtt" value={newCropWeeksToTransplant} onChange={(e) => onNewCropWeeksToTransplantChange(Number(e.target.value))} type="number" min="1" max="16" />
          </>
        )}
        <label className="field-label" htmlFor="crop-notes">Care notes (optional)</label>
        <textarea id="crop-notes" className="notes-area" value={newCropNotes} onChange={(e) => onNewCropNotesChange(e.target.value)} placeholder="Watering, pest tips, harvest hints..." rows={3} />
        <div className="panel-actions">
          <button type="submit">{editingCropId ? "Save crop" : "Add to crop list"}</button>
          {editingCropId && (
            <button type="button" className="secondary-btn" onClick={onResetCropForm}>Cancel edit</button>
          )}
        </div>
      </form>
    </div>
  );
}
