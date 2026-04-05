import { SeasonalPlanContextType, SeasonalPlanProvider } from "./SeasonalPlanContext";
import { SeasonalPageSection } from "./SeasonalPageSection";

export function SeasonalPlanPage(props: SeasonalPlanContextType) {
  return (
    <SeasonalPlanProvider value={props}>
      <SeasonalPageSection />
    </SeasonalPlanProvider>
  );
}
