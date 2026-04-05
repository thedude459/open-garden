import { useRef } from "react";
import { PlannerContextType, PlannerProvider } from "./PlannerContext";
import { PlannerPageSection } from "./PlannerPageSection";

type PlannerPageProps = Omit<PlannerContextType, "yardGridRef">;

export function PlannerPage(props: PlannerPageProps) {
  const yardGridRef = useRef<HTMLDivElement>(null);
  return (
    <PlannerProvider value={{ ...props, yardGridRef }}>
      <PlannerPageSection />
    </PlannerProvider>
  );
}
