import { usePlannerContext } from "./PlannerContext";
import { PlannerPanel } from "./PlannerPanel";
import { cropBaseName } from "../app/cropUtils";
import { YARD_CELL_PX } from "../app/constants";

export function PlannerPageSection() {
  const {
    isLoadingGardenData,
    beds,
    placements,
    cropTemplates,
    derived,
    gardenActions,
    cropFormState,
    plannerActions,
    selectedGardenRecord,
    selectedCropName,
    placementBedId,
    setPlacementBedId,
    yardGridRef,
    gardenSunPath,
    isLoadingSunPath,
    isLoadingPlantingWindows,
    plannerUndoCount,
    plannerRedoCount,
    undoPlannerChange,
    redoPlannerChange,
    setConfirmState,
    pushNotice,
    onGoToCrops,
    toFeet,
  } = usePlannerContext();

  return (
    <PlannerPanel
      isLoadingGardenData={isLoadingGardenData}
      beds={beds}
      placements={placements}
      cropTemplates={cropTemplates}
      yardWidthFt={derived.yardWidthFt}
      yardLengthFt={derived.yardLengthFt}
      yardWidthDraft={gardenActions.yardWidthDraft}
      yardLengthDraft={gardenActions.yardLengthDraft}
      onYardWidthDraftChange={gardenActions.setYardWidthDraft}
      onYardLengthDraftChange={gardenActions.setYardLengthDraft}
      onCreateBed={gardenActions.createBed}
      onUpdateYardSize={gardenActions.updateYardSize}
      onGoToCrops={onGoToCrops}
      cropSearchQuery={cropFormState.cropSearchQuery}
      onCropSearchQueryChange={cropFormState.setCropSearchQuery}
      onCropSearchKeyDown={cropFormState.handleCropSearchKeyDown}
      bedName={gardenActions.bedDraft.name}
      bedWidthFt={gardenActions.bedDraft.width_ft}
      bedLengthFt={gardenActions.bedDraft.length_ft}
      onBedNameChange={(v) => gardenActions.setBedDraft((c) => ({ ...c, name: v }))}
      onBedWidthFtChange={(v) => gardenActions.setBedDraft((c) => ({ ...c, width_ft: v }))}
      onBedLengthFtChange={(v) => gardenActions.setBedDraft((c) => ({ ...c, length_ft: v }))}
      bedErrors={{
        name: gardenActions.showBedValidation ? gardenActions.bedFormErrors.name : "",
        width_ft: gardenActions.showBedValidation ? gardenActions.bedFormErrors.width_ft : "",
        length_ft: gardenActions.showBedValidation ? gardenActions.bedFormErrors.length_ft : "",
      }}
      yardErrors={{
        yard_width_ft: gardenActions.showYardValidation ? gardenActions.yardFormErrors.yard_width_ft : "",
        yard_length_ft: gardenActions.showYardValidation ? gardenActions.yardFormErrors.yard_length_ft : "",
      }}
      filteredCropTemplates={cropFormState.filteredCropTemplates}
      cropSearchActiveIndex={cropFormState.cropSearchActiveIndex}
      selectedCropName={selectedCropName}
      selectedCrop={derived.selectedCrop}
      selectedCropWindow={derived.selectedCropWindow}
      isLoadingPlantingWindows={isLoadingPlantingWindows}
      gardenSunPath={gardenSunPath}
      isLoadingSunPath={isLoadingSunPath}
      gardenOrientation={selectedGardenRecord?.orientation || "south"}
      gardenSatelliteUrl={
        selectedGardenRecord?.latitude && selectedGardenRecord?.longitude
          ? `https://maps.google.com/?q=${selectedGardenRecord.latitude},${selectedGardenRecord.longitude}&z=19&t=k`
          : undefined
      }
      onSelectCrop={cropFormState.selectCrop}
      cropBaseName={cropBaseName}
      placementBedId={placementBedId}
      onPlacementBedIdChange={setPlacementBedId}
      yardGridRef={yardGridRef}
      yardCellPx={YARD_CELL_PX}
      toFeet={toFeet}
      onMoveBedInYard={(bedId, x, y) => plannerActions.moveBedInYard(bedId, x, y).catch(() => undefined)}
      onNudgeBed={plannerActions.nudgeBedByDelta}
      onRotateBed={(bedId, autoFit) => plannerActions.rotateBedInYard(bedId, autoFit)}
      onDeleteBed={(bedId) => plannerActions.deleteBed(bedId).catch(() => undefined)}
      onAddPlacement={(bedId, x, y) => plannerActions.addPlacement(bedId, x, y).catch(() => undefined)}
      onMovePlacement={(placementId, bedId, x, y) => plannerActions.movePlacement(placementId, bedId, x, y).catch(() => undefined)}
      onNudgePlacement={plannerActions.nudgePlacementByDelta}
      onBulkMovePlacements={(ids, dx, dy) => plannerActions.movePlacementsByDelta(ids, dx, dy).catch(() => undefined)}
      onBulkRemovePlacements={(ids) => plannerActions.removePlacementsBulk(ids).catch(() => undefined)}
      canUndoPlanner={plannerUndoCount > 0}
      canRedoPlanner={plannerRedoCount > 0}
      onUndoPlanner={() => undoPlannerChange().catch(() => undefined)}
      onRedoPlanner={() => redoPlannerChange().catch(() => undefined)}
      onRequestRemovePlacement={(placementId, cropName) => {
        setConfirmState({
          title: "Remove placement?",
          message: `Remove ${cropName} from this bed?`,
          confirmLabel: "Remove",
          onConfirm: async () => {
            await plannerActions.removePlacement(placementId);
          },
        });
      }}
      onBlockedPlacementMove={(cropName) =>
        pushNotice(`Too close to another plant for ${cropName}.`, "error")
      }
      placementSpacingConflict={plannerActions.placementSpacingConflict}
      isCellBlockedForSelectedCrop={plannerActions.isCellBlockedForSelectedCrop}
      isCellInBuffer={plannerActions.isCellInBuffer}
    />
  );
}
