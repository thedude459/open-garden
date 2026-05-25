import type { AppPage } from "../types";

/** Stored when user picks a garden-required tool before an active garden exists */
export const INTENDED_GARDEN_PAGE_KEY = "open-garden-intended-page";

const SLUG_TO_PAGE: Record<string, AppPage> = {
  calendar: "calendar",
  seasonal: "seasonal",
  planner: "planner",
  timeline: "timeline",
  coach: "coach",
  sensors: "sensors",
  pests: "pests",
  journal: "journal",
};

const PAGE_TO_SLUG: Record<AppPage, string | undefined> = {
  home: undefined,
  crops: undefined,
  calendar: "calendar",
  seasonal: "seasonal",
  planner: "planner",
  timeline: "timeline",
  coach: "coach",
  sensors: "sensors",
  pests: "pests",
  journal: "journal",
};

export type ParsedAppLocation =
  | { kind: "home"; page: "home"; gardenId: null }
  | { kind: "crops"; page: "crops"; gardenId: null }
  | { kind: "garden"; page: AppPage; gardenId: number; slug: string };

export function parseAppPath(pathname: string): ParsedAppLocation | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/" || path === "/home") {
    return { kind: "home", page: "home", gardenId: null };
  }
  if (path === "/crops") {
    return { kind: "crops", page: "crops", gardenId: null };
  }
  const match = /^\/g\/(\d+)\/([a-z-]+)$/.exec(path);
  if (!match) return null;
  const gardenId = Number(match[1]);
  const slug = match[2];
  const page = SLUG_TO_PAGE[slug];
  if (!page || page === "home" || page === "crops") return null;
  return { kind: "garden", page, gardenId, slug };
}

export function buildAppPath(page: AppPage, gardenId: number | null): string {
  if (page === "home") return "/home";
  if (page === "crops") return "/crops";
  const slug = PAGE_TO_SLUG[page];
  if (!slug || gardenId == null) return "/home";
  return `/g/${gardenId}/${slug}`;
}

export function peekIntendedGardenPage(): AppPage | null {
  const raw = sessionStorage.getItem(INTENDED_GARDEN_PAGE_KEY);
  if (
    raw === "calendar" ||
    raw === "seasonal" ||
    raw === "planner" ||
    raw === "timeline" ||
    raw === "coach" ||
    raw === "sensors" ||
    raw === "pests" ||
    raw === "journal"
  ) {
    return raw;
  }
  return null;
}

export function consumeIntendedGardenPage(): AppPage | null {
  const page = peekIntendedGardenPage();
  if (page) sessionStorage.removeItem(INTENDED_GARDEN_PAGE_KEY);
  return page;
}

export function gardenRequiredToolLabel(page: AppPage): string {
  switch (page) {
    case "calendar":
      return "Calendar";
    case "seasonal":
      return "Seasonal Plan";
    case "planner":
      return "Bed Planner";
    case "timeline":
      return "Timeline";
    case "coach":
      return "AI Coach";
    case "sensors":
      return "Sensors";
    case "pests":
      return "Pest Log";
    case "journal":
      return "Observation Journal";
    default:
      return "This tool";
  }
}
