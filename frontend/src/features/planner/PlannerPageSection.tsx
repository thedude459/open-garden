import { usePlannerContext } from "./PlannerContext";
import { PlannerPanel } from "./PlannerPanel";
import { cropBaseName } from "../app/utils/cropUtils";
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
    plantingSettings,
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
  } = usePlannerContext();

  return (
    <PlannerPanel
      layout={{
        isLoadingGardenData,
        beds,
        placements,
        cropTemplates,
        yardWidthFt: derived.yardWidthFt,
        yardLengthFt: derived.yardLengthFt,
        gardenSunPath,
        isLoadingSunPath,
        isLoadingPlantingWindows,
        gardenOrientation: selectedGardenRecord?.orientation || "south",
        gardenSatelliteUrl:
          selectedGardenRecord?.latitude && selectedGardenRecord?.longitude
            ? `https://maps.google.com/?q=${selectedGardenRecord.latitude},${selectedGardenRecord.longitude}&z=19&t=k`
            : undefined,
      }}
      forms={{
        bedName: gardenActions.bedDraft.name,
        bedWidthFt: gardenActions.bedDraft.width_ft,
        bedLengthFt: gardenActions.bedDraft.length_ft,
        yardWidthDraft: gardenActions.yardWidthDraft,
        yardLengthDraft: gardenActions.yardLengthDraft,
        bedErrors: {
          name: gardenActions.showBedValidation ? gardenActions.bedFormErrors.name : "",
          width_ft: gardenActions.showBedValidation ? gardenActions.bedFormErrors.width_ft : "",
          length_ft: gardenActions.showBedValidation ? gardenActions.bedFormErrors.length_ft : "",
        },
        yardErrors: {
          yard_width_ft: gardenActions.showYardValidation ? gardenActions.yardFormErrors.yard_width_ft : "",
          yard_length_ft: gardenActions.showYardValidation ? gardenActions.yardFormErrors.yard_length_ft : "",
        },
        onBedNameChange: (v) => gardenActions.setBedDraft((c) => ({ ...c, name: v })),
        onBedWidthFtChange: (v) => gardenActions.setBedDraft((c) => ({ ...c, width_ft: v })),
        onBedLengthFtChange: (v) => gardenActions.setBedDraft((c) => ({ ...c, length_ft: v })),
        onYardWidthDraftChange: gardenActions.setYardWidthDraft,
        onYardLengthDraftChange: gardenActions.setYardLengthDraft,
        onCreateBed: gardenActions.createBed,
        onUpdateYardSize: gardenActions.updateYardSize,
        onGoToCrops,
      }}
      crop={{
        cropSearchQuery: cropFormState.cropSearchQuery,
        onCropSearchQueryChange: cropFormState.setCropSearchQuery,
        onCropSearchKeyDown: cropFormState.handleCropSearchKeyDown,
        filteredCropTemplates: cropFormState.filteredCropTemplates,
        cropSearchActiveIndex: cropFormState.cropSearchActiveIndex,
        selectedCropName,
        selectedCrop: derived.selectedCrop,
        selectedCropWindow: derived.selectedCropWindow,
        onSelectCrop: cropFormState.selectCrop,
        cropBaseName,
      }}
      planner={{
        placementBedId,
        onPlacementBedIdChange: setPlacementBedId,
        yardGridRef,
        yardCellPx: YARD_CELL_PX,
        onMoveBedInYard: (bedId, x, y) => plannerActions.moveBedInYard(bedId, x, y).catch(() => undefined),
        onNudgeBed: plannerActions.nudgeBedByDelta,
        onRotateBed: (bedId, autoFit) => plannerActions.rotateBedInYard(bedId, autoFit),
        onRenameBed: (bedId, nextName) => plannerActions.renameBed(bedId, nextName).catch(() => undefined),
        onDeleteBed: (bedId) => plannerActions.deleteBed(bedId).catch(() => undefined),
        onAddPlacement: (bedId, x, y) => plannerActions.addPlacement(bedId, x, y).catch(() => undefined),
        onMovePlacement: (placementId, bedId, x, y) => plannerActions.movePlacement(placementId, bedId, x, y).catch(() => undefined),
        onRelocatePlanting: (placementId, location) => plannerActions.relocatePlanting(placementId, location).catch(() => undefined),
        onUpdatePlantingDates: (placementId, changes) =>
          plannerActions.updatePlantingDates(placementId, changes).catch(() => undefined),
        plantingMethod: plantingSettings.plantingMethod,
        setPlantingMethod: plantingSettings.setPlantingMethod,
        plantingLocation: plantingSettings.plantingLocation,
        setPlantingLocation: plantingSettings.setPlantingLocation,
        plantingDate: plantingSettings.plantingDate,
        setPlantingDate: plantingSettings.setPlantingDate,
        plantingMovedOn: plantingSettings.plantingMovedOn,
        setPlantingMovedOn: plantingSettings.setPlantingMovedOn,
        onNudgePlacement: plannerActions.nudgePlacementByDelta,
        onBulkMovePlacements: (ids, dx, dy) => plannerActions.movePlacementsByDelta(ids, dx, dy).catch(() => undefined),
        onBulkRemovePlacements: (ids) => plannerActions.removePlacementsBulk(ids).catch(() => undefined),
        onRequestRemovePlacement: (placementId, cropName) => {
          setConfirmState({
            title: "Remove placement?",
            message: `Remove ${cropName} from this bed?`,
            confirmLabel: "Remove",
            onConfirm: async () => {
              await plannerActions.removePlacement(placementId);
            },
          });
        },
        onBlockedPlacementMove: (cropName) => pushNotice(`Too close to another plant for ${cropName}.`, "error"),
        placementSpacingConflict: plannerActions.placementSpacingConflict,
        isCellBlockedForSelectedCrop: plannerActions.isCellBlockedForSelectedCrop,
        isCellInBuffer: plannerActions.isCellInBuffer,
      }}
      history={{
        canUndoPlanner: plannerUndoCount > 0,
        canRedoPlanner: plannerRedoCount > 0,
        onUndoPlanner: () => undoPlannerChange().catch(() => undefined),
        onRedoPlanner: () => redoPlannerChange().catch(() => undefined),
      }}
    />
  );
}
