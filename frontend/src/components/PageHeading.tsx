import { AppPage } from "@/features/app/types";

const PAGE_HEADING_LABELS: Record<AppPage, string> = {
  home: "My gardens",
  timeline: "Timeline",
  calendar: "Calendar",
  seasonal: "Seasonal plan",
  planner: "Bed planner",
  coach: "AI coach",
  crops: "Crop library",
  pests: "Pest log",
  sensors: "Sensors",
};

type PageHeadingProps = {
  activePage: AppPage;
};

export function PageHeading({ activePage }: PageHeadingProps) {
  return (
    <header className="page-heading">
      <h2 className="page-heading-title">{PAGE_HEADING_LABELS[activePage]}</h2>
    </header>
  );
}
