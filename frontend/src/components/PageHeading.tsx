import { AppPage } from "@/features/app/types";
import {
  Bot,
  Bug,
  CalendarDays,
  Cpu,
  History,
  Home,
  LayoutGrid,
  ListChecks,
  Sprout,
} from "lucide-react";

type PageMeta = {
  label: string;
  subtitle: string;
  Icon: typeof Home;
};

const PAGE_META: Record<AppPage, PageMeta> = {
  home: {
    label: "My gardens",
    subtitle: "Your gardens, weekly to-dos, weather, and planting cues",
    Icon: Home,
  },
  timeline: {
    label: "Timeline",
    subtitle: "History of plantings, harvests, and notable events",
    Icon: History,
  },
  calendar: {
    label: "Calendar",
    subtitle: "Monthly view of plantings, tasks, and harvests",
    Icon: CalendarDays,
  },
  seasonal: {
    label: "Seasonal plan",
    subtitle: "Season-aware recommendations tuned to your zone",
    Icon: ListChecks,
  },
  planner: {
    label: "Bed planner",
    subtitle: "Design beds and place crops on a square-foot grid",
    Icon: LayoutGrid,
  },
  coach: {
    label: "AI coach",
    subtitle: "Ask questions about your garden — tailored to your climate",
    Icon: Bot,
  },
  crops: {
    label: "Crops",
    subtitle: "Browse the crop library and tune custom varieties",
    Icon: Sprout,
  },
  pests: {
    label: "Pest log",
    subtitle: "Track pests, diseases, and control actions over time",
    Icon: Bug,
  },
  sensors: {
    label: "Sensors",
    subtitle: "Live readings from your microclimate sensors",
    Icon: Cpu,
  },
};

type PageHeadingProps = {
  activePage: AppPage;
};

export function PageHeading({ activePage }: PageHeadingProps) {
  const meta = PAGE_META[activePage];
  const Icon = meta.Icon;
  return (
    <header className="page-heading">
      <span className="page-heading__icon" aria-hidden>
        <Icon strokeWidth={2} />
      </span>
      <div className="page-heading__text">
        <h2 className="page-heading-title">{meta.label}</h2>
        <p className="page-heading__subtitle">{meta.subtitle}</p>
      </div>
    </header>
  );
}
