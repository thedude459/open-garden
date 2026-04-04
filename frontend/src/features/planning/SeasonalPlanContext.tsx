import { ReactNode, createContext, useContext } from "react";
import { GardenSeasonalPlan, PlantingRecommendations } from "../../types";

export interface SeasonalPlanContextType {
  // Data
  selectedGardenName?: string;
  seasonalPlan: GardenSeasonalPlan | null;
  selectedRecommendationPlantingId: number | null;
  plantingRecommendation: PlantingRecommendations | null;
  
  // State management
  setSelectedRecommendationPlantingId: (id: number | null) => void;
  refreshSeasonalPlan: () => Promise<void>;
  
  // Loading states
  isLoadingSeasonalPlan: boolean;
  isLoadingPlantingRecommendation: boolean;
  
  // Utilities
  pushNotice: (message: string, kind: "info" | "success" | "error") => void;
}

const SeasonalPlanContext = createContext<SeasonalPlanContextType | undefined>(undefined);

/**
 * Provider component for seasonal planning feature
 * Consolidates seasonal plan-specific state
 */
export function SeasonalPlanProvider({ children, value }: { children: ReactNode; value: SeasonalPlanContextType }) {
  return (
    <SeasonalPlanContext.Provider value={value}>
      {children}
    </SeasonalPlanContext.Provider>
  );
}

/**
 * Hook to access seasonal plan context
 */
export function useSeasonalPlanContext(): SeasonalPlanContextType {
  const context = useContext(SeasonalPlanContext);
  if (!context) {
    throw new Error("useSeasonalPlanContext must be used within SeasonalPlanProvider");
  }
  return context;
}
