import { FormEvent, KeyboardEvent, RefObject, useMemo, useState } from "react";
import { Bed, ClimatePlantingWindow, CropTemplate, Garden, GardenSunPath, Placement } from "../types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlannerCropVisuals } from "./hooks/usePlannerCropVisuals";
import { usePlannerBulkSelection } from "./hooks/usePlannerBulkSelection";
import { usePlannerRotationPreview } from "./hooks/usePlannerRotationPreview";
import { usePlannerOverlayState } from "./hooks/usePlannerOverlayState";
import { getBedGridPositionForPoint as getBedGridPosition } from "./engine/plannerGeometry";
import { PlannerCreateBedForm } from "./bed/PlannerCreateBedForm";
import { PlannerPlacementTools } from "./PlannerPlacementTools";
import { PlannerBedSheetsSection } from "./bed/PlannerBedSheetsSection";
import { PlannerYardLayoutSection } from "./yard/PlannerYardLayoutSection";

type PlannerPanelProps = {
  layout: {
    isLoadingGardenData: boolean;
    beds: Bed[];
    placements: Placement[];
    cropTemplates: CropTemplate[];
    yardWidthFt: number;
    yardLengthFt: number;
    gardenSunPath: GardenSunPath | null;
    isLoadingSunPath: boolean;
    isLoadingPlantingWindows: boolean;
    gardenOrientation: Garden["orientation"];
    gardenSatelliteUrl?: string;
  };
  forms: {
    bedName: string;
    bedWidthFt: number;
    bedLengthFt: number;
    yardWidthDraft: number;
    yardLengthDraft: number;
    bedErrors: { name: string; width_ft: string; length_ft: string };
    yardErrors: { yard_width_ft: string; yard_length_ft: string };
    onBedNameChange: (value: string) => void;
    onBedWidthFtChange: (value: number) => void;
    onBedLengthFtChange: (value: number) => void;
    onYardWidthDraftChange: (value: number) => void;
    onYardLengthDraftChange: (value: number) => void;
    onCreateBed: (e: FormEvent<HTMLFormElement>) => void;
    onUpdateYardSize: (e: FormEvent<HTMLFormElement>) => void;
    onGoToCrops: () => void;
  };
  crop: {
    cropSearchQuery: string;
    onCropSearchQueryChange: (value: string) => void;
    onCropSearchKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
    filteredCropTemplates: CropTemplate[];
    cropSearchActiveIndex: number;
    selectedCropName: string;
    selectedCrop?: CropTemplate;
    selectedCropWindow?: ClimatePlantingWindow;
    onSelectCrop: (crop: CropTemplate) => void;
    cropBaseName: (crop: CropTemplate) => string;
  };
  planner: {
    placementBedId: number | null;
    onPlacementBedIdChange: (value: number | null) => void;
    yardGridRef: RefObject<HTMLDivElement>;
    yardCellPx: number;
    onMoveBedInYard: (bedId: number, x: number, y: number) => Promise<void> | void;
    onNudgeBed: (bedId: number, dx: number, dy: number) => void;
    onRotateBed: (bedId: number, autoFit?: boolean) => Promise<void>;
    onRenameBed: (bedId: number, nextName: string) => Promise<void> | void;
    onDeleteBed: (bedId: number) => void;
    onAddPlacement: (bedId: number, x: number, y: number) => void;
    onMovePlacement: (placementId: number, bedId: number, x: number, y: number) => void;
    onNudgePlacement: (placementId: number, dx: number, dy: number) => void;
    onBulkMovePlacements: (placementIds: number[], dx: number, dy: number) => void;
    onBulkRemovePlacements: (placementIds: number[]) => void;
    onRequestRemovePlacement: (placementId: number, cropName: string) => void;
    onBlockedPlacementMove: (cropName: string) => void;
    placementSpacingConflict: (bedId: number, x: number, y: number, cropName: string, ignorePlacementId?: number) => string | null;
    isCellBlockedForSelectedCrop: (bedId: number, x: number, y: number, occupant: Placement | undefined) => boolean;
    isCellInBuffer: (bedId: number, x: number, y: number) => boolean;
  };
  history: {
    canUndoPlanner: boolean;
    canRedoPlanner: boolean;
    onUndoPlanner: () => void;
    onRedoPlanner: () => void;
  };
};

export function PlannerPanel({
  layout,
  forms,
  crop,
  planner,
  history,
}: PlannerPanelProps) {
  const {
    isLoadingGardenData,
    beds,
    placements,
    cropTemplates,
    yardWidthFt,
    yardLengthFt,
    gardenSunPath,
    isLoadingSunPath,
    isLoadingPlantingWindows,
    gardenOrientation,
    gardenSatelliteUrl,
  } = layout;
  const {
    bedName,
    bedWidthFt,
    bedLengthFt,
    yardWidthDraft,
    yardLengthDraft,
    bedErrors,
    yardErrors,
    onBedNameChange,
    onBedWidthFtChange,
    onBedLengthFtChange,
    onYardWidthDraftChange,
    onYardLengthDraftChange,
    onCreateBed,
    onUpdateYardSize,
    onGoToCrops,
  } = forms;
  const {
    cropSearchQuery,
    onCropSearchQueryChange,
    onCropSearchKeyDown,
    filteredCropTemplates,
    cropSearchActiveIndex,
    selectedCropName,
    selectedCrop,
    selectedCropWindow,
    onSelectCrop,
    cropBaseName,
  } = crop;
  const {
    placementBedId,
    onPlacementBedIdChange,
    yardGridRef,
    yardCellPx,
    onMoveBedInYard,
    onNudgeBed,
    onRotateBed,
    onRenameBed,
    onDeleteBed,
    onAddPlacement,
    onMovePlacement,
    onNudgePlacement,
    onBulkMovePlacements,
    onBulkRemovePlacements,
    onRequestRemovePlacement,
    onBlockedPlacementMove,
    placementSpacingConflict,
    isCellBlockedForSelectedCrop,
    isCellInBuffer,
  } = planner;
  const {
    canUndoPlanner,
    canRedoPlanner,
    onUndoPlanner,
    onRedoPlanner,
  } = history;
  const [selectedPlacementId, setSelectedPlacementId] = useState<number | null>(null);
  const [selectedBedId, setSelectedBedId] = useState<number | null>(null);
  const {
    showSunOverlay,
    setShowSunOverlay,
    showShadeOverlay,
    setShowShadeOverlay,
    showGrowthPreview,
    setShowGrowthPreview,
    sunHour,
    setSunHour,
    growthDayOffset,
    setGrowthDayOffset,
    setOverlayPreset,
    sunSample,
    sunExposure,
    shadeMap,
    canopyPreview,
  } = usePlannerOverlayState({
    gardenSunPath,
    yardWidthFt,
    yardLengthFt,
    gardenOrientation,
    beds,
    placements,
    cropTemplates,
  });
  const { cropVisual } = usePlannerCropVisuals(cropTemplates);
  const {
    bulkMode,
    selectedPlacementIds,
    toggleBulkMode,
    clearSelection,
    togglePlacementSelection,
    startLasso,
    updateLasso,
    finishLasso,
  } = usePlannerBulkSelection(placements, () => setSelectedPlacementId(null));
  const {
    pendingRotation,
    setPendingRotation,
    isApplyingRotation,
    requestRotatePreview,
    confirmRotate,
  } = usePlannerRotationPreview({ beds, yardWidthFt, yardLengthFt, onRotateBed });

  const [activeTab, setActiveTab] = useState<"setup" | "plantings">("setup");
  const selectedPlacement = useMemo(
    () => placements.find((placement) => placement.id === selectedPlacementId) || null,
    [placements, selectedPlacementId],
  );
  function resolveBedGridPosition(bedId: number, clientX: number, clientY: number) {
    if (!yardGridRef.current) {
      return null;
    }
    return getBedGridPosition({
      bedId,
      clientX,
      clientY,
      beds,
      yardRect: yardGridRef.current.getBoundingClientRect(),
      yardCellPx,
      yardWidthFt,
      yardLengthFt,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-3xl font-serif">Garden Bed Planner Studio</CardTitle>
        <CardDescription>Build your layout map, then click inside each bed to place crops with proper spacing.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoadingGardenData && <p className="text-sm text-muted-foreground">Refreshing layout data...</p>}

        {/* Main Content - Tabbed Workflow */}
        <div className="planner-tabs-wrapper">
            <div className="planner-tabs-container">
              <div className="planner-tabs-segmented" role="tablist" aria-label="Planner workflow">
                <button
                  type="button"
                  role="tab"
                  id="planner-tab-setup"
                  aria-selected={activeTab === "setup"}
                  aria-controls="planner-panel-setup"
                  className={`planner-tab-button ${activeTab === "setup" ? "active" : ""}`}
                  onClick={() => setActiveTab("setup")}
                >
                  Setup Yard
                </button>
                <button
                  type="button"
                  role="tab"
                  id="planner-tab-plantings"
                  aria-selected={activeTab === "plantings"}
                  aria-controls="planner-panel-plantings"
                  className={`planner-tab-button ${activeTab === "plantings" ? "active" : ""}`}
                  onClick={() => setActiveTab("plantings")}
                >
                  Manage Plantings
                </button>
              </div>

              <p className="planner-tab-hint" id="planner-tab-desc">
                {activeTab === "setup"
                  ? "Position beds on the yard grid and tune sun or shade overlays. Use Manage Plantings to choose crops and fill bed squares."
                  : "Pick a crop in the sidebar, then tap bed squares to plant. Undo and redo apply to layout and placement changes."}
              </p>

              <div className="planner-sticky-context" role="toolbar" aria-label="Undo, redo, and selected crop">
                <div className="planner-sticky-context-inner">
                  <button type="button" className="secondary-btn" onClick={onUndoPlanner} disabled={!canUndoPlanner}>
                    Undo
                  </button>
                  <button type="button" className="secondary-btn" onClick={onRedoPlanner} disabled={!canRedoPlanner}>
                    Redo
                  </button>
                  <span className="planner-sticky-crop">
                    Crop:&nbsp;
                    <strong>
                      {selectedCropName
                        ? (selectedCrop ? cropBaseName(selectedCrop) : selectedCropName)
                        : "—"}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="planner-tab-content" aria-labelledby="planner-tab-desc">
                {/* Setup Tab */}
                {activeTab === "setup" && (
                  <div className="planner-tab-pane" role="tabpanel" id="planner-panel-setup" aria-labelledby="planner-tab-setup">
                    <div className="planner-setup-grid">
                      <aside className="planner-form-sidebar">
                        <PlannerCreateBedForm
                          bedName={bedName}
                          bedWidthFt={bedWidthFt}
                          bedLengthFt={bedLengthFt}
                          bedErrors={bedErrors}
                          onBedNameChange={onBedNameChange}
                          onBedWidthFtChange={onBedWidthFtChange}
                          onBedLengthFtChange={onBedLengthFtChange}
                          onCreateBed={onCreateBed}
                        />
                      </aside>
                      <section className="planner-main-content">
                        <PlannerYardLayoutSection
                          gardenSatelliteUrl={gardenSatelliteUrl}
                          isLoadingSunPath={isLoadingSunPath}
                          sunSample={sunSample}
                          yardWidthDraft={yardWidthDraft}
                          yardLengthDraft={yardLengthDraft}
                          yardErrors={yardErrors}
                          onYardWidthDraftChange={onYardWidthDraftChange}
                          onYardLengthDraftChange={onYardLengthDraftChange}
                          onUpdateYardSize={onUpdateYardSize}
                          beds={beds}
                          selectedBedId={selectedBedId}
                          setSelectedBedId={setSelectedBedId}
                          onNudgeBed={onNudgeBed}
                          requestRotatePreview={requestRotatePreview}
                          onDeleteBed={onDeleteBed}
                          pendingRotation={pendingRotation}
                          setPendingRotation={setPendingRotation}
                          confirmRotate={confirmRotate}
                          isApplyingRotation={isApplyingRotation}
                          showSunOverlay={showSunOverlay}
                          showShadeOverlay={showShadeOverlay}
                          showGrowthPreview={showGrowthPreview}
                          setShowSunOverlay={setShowSunOverlay}
                          setShowShadeOverlay={setShowShadeOverlay}
                          setShowGrowthPreview={setShowGrowthPreview}
                          setOverlayPreset={setOverlayPreset}
                          gardenSunPath={gardenSunPath}
                          sunHour={sunHour}
                          setSunHour={setSunHour}
                          growthDayOffset={growthDayOffset}
                          setGrowthDayOffset={setGrowthDayOffset}
                          sunExposure={sunExposure}
                          shadeMap={shadeMap}
                          canopyPreview={canopyPreview}
                          yardGridRef={yardGridRef}
                          yardWidthFt={yardWidthFt}
                          yardLengthFt={yardLengthFt}
                          yardCellPx={yardCellPx}
                          resolveBedGridPosition={resolveBedGridPosition}
                          onMoveBedInYard={onMoveBedInYard}
                          placementBedId={placementBedId}
                        />
                      </section>
                    </div>
                  </div>
                )}

                {/* Plantings Tab */}
                {activeTab === "plantings" && (
                  <div className="planner-tab-pane" role="tabpanel" id="planner-panel-plantings" aria-labelledby="planner-tab-plantings">
                    <div className="planner-plantings-grid">
                      <aside className="planner-form-sidebar">
                        <PlannerPlacementTools
                          cropSearchQuery={cropSearchQuery}
                          onCropSearchQueryChange={onCropSearchQueryChange}
                          onCropSearchKeyDown={onCropSearchKeyDown}
                          filteredCropTemplates={filteredCropTemplates}
                          cropSearchActiveIndex={cropSearchActiveIndex}
                          selectedCropName={selectedCropName}
                          selectedCrop={selectedCrop}
                          selectedCropWindow={selectedCropWindow}
                          isLoadingPlantingWindows={isLoadingPlantingWindows}
                          onSelectCrop={onSelectCrop}
                          cropBaseName={cropBaseName}
                          beds={beds}
                          placementBedId={placementBedId}
                          onPlacementBedIdChange={onPlacementBedIdChange}
                          onGoToCrops={onGoToCrops}
                        />
                      </aside>
                      <section className="planner-main-content">
                        <PlannerBedSheetsSection
                          beds={beds}
                          placements={placements}
                          selectedCropName={selectedCropName}
                          selectedPlacement={selectedPlacement}
                          setSelectedPlacementId={setSelectedPlacementId}
                          bulkMode={bulkMode}
                          selectedPlacementIds={selectedPlacementIds}
                          toggleBulkMode={toggleBulkMode}
                          clearSelection={clearSelection}
                          togglePlacementSelection={togglePlacementSelection}
                          startLasso={startLasso}
                          updateLasso={updateLasso}
                          finishLasso={finishLasso}
                          onBulkMovePlacements={onBulkMovePlacements}
                          onBulkRemovePlacements={onBulkRemovePlacements}
                          onBlockedPlacementMove={onBlockedPlacementMove}
                          placementSpacingConflict={placementSpacingConflict}
                          onMovePlacement={onMovePlacement}
                          onAddPlacement={onAddPlacement}
                          isCellBlockedForSelectedCrop={isCellBlockedForSelectedCrop}
                          isCellInBuffer={isCellInBuffer}
                          cropVisual={cropVisual}
                          onNudgePlacement={onNudgePlacement}
                          onRequestRemovePlacement={onRequestRemovePlacement}
                          onRenameBed={onRenameBed}
                        />
                      </section>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
  );
}
