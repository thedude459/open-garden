import { Placement, Bed } from "../../types";
import { PlannerBedSheetSingle } from "./PlannerBedSheetSingle";

type PlannerBedSheetsSectionProps = {
  beds: Bed[];
  placements: Placement[];
  selectedCropName: string;
  selectedPlacement: Placement | null;
  setSelectedPlacementId: (value: number | null | ((current: number | null) => number | null)) => void;
  bulkMode: boolean;
  selectedPlacementIds: number[];
  toggleBulkMode: () => void;
  clearSelection: () => void;
  togglePlacementSelection: (placementId: number) => void;
  startLasso: (bedId: number, x: number, y: number) => void;
  updateLasso: (bedId: number, x: number, y: number) => void;
  finishLasso: (append: boolean) => void;
  onBulkMovePlacements: (placementIds: number[], dx: number, dy: number) => void;
  onBulkRemovePlacements: (placementIds: number[]) => void;
  canUndoPlanner: boolean;
  canRedoPlanner: boolean;
  onUndoPlanner: () => void;
  onRedoPlanner: () => void;
  requestRotatePreview: (bed: Bed) => void;
  onRenameBed: (bedId: number, nextName: string) => Promise<void> | void;
  onDeleteBed: (bedId: number) => void;
  onBlockedPlacementMove: (cropName: string) => void;
  placementSpacingConflict: (bedId: number, x: number, y: number, cropName: string, ignorePlacementId?: number) => string | null;
  onMovePlacement: (placementId: number, bedId: number, x: number, y: number) => void;
  onAddPlacement: (bedId: number, x: number, y: number) => void;
  isCellBlockedForSelectedCrop: (bedId: number, x: number, y: number, occupant: Placement | undefined) => boolean;
  isCellInBuffer: (bedId: number, x: number, y: number) => boolean;
  cropVisual: (cropName: string) => { imageUrl: string; rowSpacingIn: number; inRowSpacingIn: number };
  onNudgePlacement: (placementId: number, dx: number, dy: number) => void;
  onRequestRemovePlacement: (placementId: number, cropName: string) => void;
};

export function PlannerBedSheetsSection({
  beds,
  placements,
  selectedCropName,
  selectedPlacement,
  setSelectedPlacementId,
  bulkMode,
  selectedPlacementIds,
  toggleBulkMode,
  clearSelection,
  togglePlacementSelection,
  startLasso,
  updateLasso,
  finishLasso,
  onBulkMovePlacements,
  onBulkRemovePlacements,
  canUndoPlanner,
  canRedoPlanner,
  onUndoPlanner,
  onRedoPlanner,
  requestRotatePreview,
  onRenameBed,
  onDeleteBed,
  onBlockedPlacementMove,
  placementSpacingConflict,
  onMovePlacement,
  onAddPlacement,
  isCellBlockedForSelectedCrop,
  isCellInBuffer,
  cropVisual,
  onNudgePlacement,
  onRequestRemovePlacement,
}: PlannerBedSheetsSectionProps) {
  return (
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

      {beds.length === 0 && (
        <div className="planner-empty-state" role="status" aria-live="polite">
          <strong>Create your first bed to unlock sheet placement.</strong>
          <p className="hint">Once a bed exists, you can place crops square-by-square here and move plantings between beds.</p>
        </div>
      )}

      {beds.length > 0 && (
      <div className="planner-bulk-controls" role="group" aria-label="Bulk placement tools">
        <button type="button" className={bulkMode ? "secondary-btn active" : "secondary-btn"} onClick={toggleBulkMode}>
          {bulkMode ? "Exit Bulk Select" : "Bulk Select"}
        </button>
        <span className="hint">Selected: {selectedPlacementIds.length}</span>
        <button type="button" className="secondary-btn" onClick={clearSelection} disabled={selectedPlacementIds.length === 0}>Clear</button>
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
              clearSelection();
            }
          }}
          disabled={selectedPlacementIds.length === 0}
        >
          Remove selected
        </button>
        {bulkMode && <p className="hint">Drag across a bed to lasso select placements. Shift+drag adds to selection.</p>}
      </div>
      )}

      {beds.length > 0 && selectedPlacement && (
        <div className="planner-selection-banner" role="status" aria-live="polite">
          <span>
            Moving <strong>{selectedPlacement.crop_name}</strong> from bed {selectedPlacement.bed_id}. Tap an empty square to place it.
          </span>
          <button type="button" className="secondary-btn" onClick={() => setSelectedPlacementId(null)}>Cancel move</button>
        </div>
      )}

      <div className="bed-detail-grid">
        {beds.map((bed) => {
          const bedPlacements = placements.filter((item) => item.bed_id === bed.id);
          return (
            <PlannerBedSheetSingle
              key={bed.id}
              bed={bed}
              placements={bedPlacements}
              allPlacements={placements}
              selectedCropName={selectedCropName}
              selectedPlacement={selectedPlacement}
              setSelectedPlacementId={setSelectedPlacementId}
              bulkMode={bulkMode}
              selectedPlacementIds={selectedPlacementIds}
              togglePlacementSelection={togglePlacementSelection}
              startLasso={startLasso}
              updateLasso={updateLasso}
              finishLasso={finishLasso}
              onBlockedPlacementMove={onBlockedPlacementMove}
              placementSpacingConflict={placementSpacingConflict}
              onMovePlacement={onMovePlacement}
              onAddPlacement={onAddPlacement}
              isCellBlockedForSelectedCrop={isCellBlockedForSelectedCrop}
              isCellInBuffer={isCellInBuffer}
              cropVisual={cropVisual}
              onNudgePlacement={onNudgePlacement}
              onRequestRemovePlacement={onRequestRemovePlacement}
              requestRotatePreview={requestRotatePreview}
              onRenameBed={onRenameBed}
              onDeleteBed={onDeleteBed}
            />
          );
        })}
      </div>
    </section>
  );
}
