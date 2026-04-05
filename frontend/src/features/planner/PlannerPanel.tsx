import { FormEvent, KeyboardEvent, RefObject, useMemo, useState } from "react";
import { Bed, ClimatePlantingWindow, CropTemplate, Garden, GardenSunPath, Placement } from "../types";
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
    <article className="card bed-planner-card">
      <h2>Garden Bed Planner Studio</h2>
      <p className="subhead">Build your layout map, then click inside each bed to place crops with proper spacing.</p>
      {isLoadingGardenData && <p className="hint">Refreshing layout data...</p>}

      <div className="planner-layout">
        <aside className="planner-sidebar">
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
            canUndoPlanner={canUndoPlanner}
            canRedoPlanner={canRedoPlanner}
            onUndoPlanner={onUndoPlanner}
            onRedoPlanner={onRedoPlanner}
            requestRotatePreview={requestRotatePreview}
            onDeleteBed={onDeleteBed}
            onBlockedPlacementMove={onBlockedPlacementMove}
            placementSpacingConflict={placementSpacingConflict}
            onMovePlacement={onMovePlacement}
            onAddPlacement={onAddPlacement}
            isCellBlockedForSelectedCrop={isCellBlockedForSelectedCrop}
            isCellInBuffer={isCellInBuffer}
            cropVisual={cropVisual}
            onNudgePlacement={onNudgePlacement}
            onRequestRemovePlacement={onRequestRemovePlacement}
          />

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
        </div>
      </div>
    </article>
  );
}
