import {
  Dispatch,
  FormEvent,
  KeyboardEvent,
  ReactNode,
  RefObject,
  SetStateAction,
  createContext,
  useContext,
} from "react";
import { Bed, CropTemplate, Garden, Placement } from "../../types";
import { ClimatePlantingWindow } from "../types";
import { ConfirmState } from "../app/types";
import { GardenSunPath } from "../types";

interface DerivedState {
  yardWidthFt: number;
  yardLengthFt: number;
  selectedCrop?: CropTemplate;
  selectedCropWindow?: ClimatePlantingWindow;
  selectedGardenName?: string;
  cropMap: Map<string, CropTemplate>;
}

interface CropFormState {
  cropSearchQuery: string;
  setCropSearchQuery: (value: string) => void;
  handleCropSearchKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  filteredCropTemplates: CropTemplate[];
  cropSearchActiveIndex: number;
  selectCrop: (crop: CropTemplate) => void;
}

interface GardenActions {
  yardWidthDraft: number;
  yardLengthDraft: number;
  setYardWidthDraft: (value: number) => void;
  setYardLengthDraft: (value: number) => void;
  createBed: (e: FormEvent<HTMLFormElement>) => void;
  updateYardSize: (e: FormEvent<HTMLFormElement>) => void;
  bedDraft: { name: string; width_ft: number; length_ft: number };
  setBedDraft: Dispatch<SetStateAction<{ name: string; width_ft: number; length_ft: number }>>;
  showBedValidation: boolean;
  bedFormErrors: { name: string; width_ft: string; length_ft: string };
  showYardValidation: boolean;
  yardFormErrors: { yard_width_ft: string; yard_length_ft: string };
}

interface PlannerActions {
  moveBedInYard: (bedId: number, x: number, y: number) => Promise<void>;
  nudgeBedByDelta: (bedId: number, dx: number, dy: number) => void;
  rotateBedInYard: (bedId: number, autoFit?: boolean) => Promise<void>;
  deleteBed: (bedId: number) => Promise<void>;
  addPlacement: (bedId: number, x: number, y: number) => Promise<void>;
  movePlacement: (placementId: number, bedId: number, x: number, y: number) => Promise<void>;
  nudgePlacementByDelta: (placementId: number, dx: number, dy: number) => void;
  movePlacementsByDelta: (placementIds: number[], dx: number, dy: number) => Promise<void>;
  removePlacementsBulk: (placementIds: number[]) => Promise<void>;
  removePlacement: (placementId: number) => Promise<void>;
  placementSpacingConflict: (bedId: number, x: number, y: number, cropName: string, ignorePlacementId?: number) => string | null;
  isCellBlockedForSelectedCrop: (bedId: number, x: number, y: number, occupant: Placement | undefined) => boolean;
  isCellInBuffer: (bedId: number, x: number, y: number) => boolean;
}

export interface PlannerContextType {
  // Data
  beds: Bed[];
  placements: Placement[];
  cropTemplates: CropTemplate[];
  selectedCropName: string;
  selectedGardenRecord: Garden | undefined;
  gardenSunPath: GardenSunPath | null;
  yardGridRef: RefObject<HTMLDivElement>;
  derived: DerivedState;
  
  // State management
  cropFormState: CropFormState;
  gardenActions: GardenActions;
  plannerActions: PlannerActions;
  
  // UI state
  placementBedId: number | null;
  setPlacementBedId: (id: number | null) => void;
  
  // History
  plannerUndoCount: number;
  plannerRedoCount: number;
  undoPlannerChange: () => void;
  redoPlannerChange: () => void;
  
  // Loading states
  isLoadingGardenData: boolean;
  isLoadingSunPath: boolean;
  isLoadingPlantingWindows: boolean;
  
  // Utilities
  pushNotice: (message: string, kind: "info" | "success" | "error") => void;
  setConfirmState: Dispatch<SetStateAction<ConfirmState | null>>;
  toFeet: (inches: number) => string;
  onGoToCrops: () => void;
}

const PlannerContext = createContext<PlannerContextType | undefined>(undefined);

/**
 * Provider component for planner feature
 * Consolidates planner-specific state to avoid prop drilling in nested components
 */
export function PlannerProvider({ children, value }: { children: ReactNode; value: PlannerContextType }) {
  return (
    <PlannerContext.Provider value={value}>
      {children}
    </PlannerContext.Provider>
  );
}

/**
 * Hook to access planner context
 */
export function usePlannerContext(): PlannerContextType {
  const context = useContext(PlannerContext);
  if (!context) {
    throw new Error("usePlannerContext must be used within PlannerProvider");
  }
  return context;
}
