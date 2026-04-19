import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppPageContent } from "./AppPageContent";

afterEach(() => {
  cleanup();
});

vi.mock("../../home/HomePageSection", () => ({ HomePageSection: () => <div data-testid="home-page-section" /> }));
vi.mock("../../timeline/TimelinePageSection", () => ({ TimelinePageSection: () => <div data-testid="timeline-page-section" /> }));
vi.mock("../../calendar/CalendarPage", () => ({ CalendarPage: () => <div data-testid="calendar-page" /> }));
vi.mock("../../planner/PlannerPage", () => ({ PlannerPage: () => <div data-testid="planner-page" /> }));
vi.mock("../../planning/SeasonalPlanPage", () => ({ SeasonalPlanPage: () => <div data-testid="seasonal-plan-page" /> }));
vi.mock("../../sensors/SensorsPageSection", () => ({ SensorsPageSection: () => <div data-testid="sensors-page-section" /> }));
vi.mock("../../coach/CoachPageSection", () => ({ CoachPageSection: () => <div data-testid="coach-page-section" /> }));
vi.mock("../../pests/PestsPageSection", () => ({ PestsPageSection: () => <div data-testid="pests-page-section" /> }));
vi.mock("../../crops/CropsPageSection", () => ({ CropsPageSection: () => <div data-testid="crops-page-section" /> }));

type AppPageContentProps = Parameters<typeof AppPageContent>[0];

function makeProps(): AppPageContentProps {
  return {
    routing: {
      activePage: "home",
      setActivePage: vi.fn(),
      navigateTo: vi.fn(),
    },
    garden: {
      selectedGarden: null,
      setSelectedGarden: vi.fn(),
      selectedGardenRecord: undefined,
      gardens: [],
      publicGardens: [],
      beds: [],
      placements: [],
      cropTemplates: [],
    },
    calendar: {
      today: "2026-04-04",
      monthCursor: new Date("2026-04-01"),
      setMonthCursor: vi.fn(),
      selectedDate: "2026-04-04",
      setSelectedDate: vi.fn(),
      selectedCropName: "Tomato",
    },
    insights: {
      weather: null,
      gardenClimate: null,
      gardenSunPath: null,
      seasonalPlan: null,
      selectedRecommendationPlantingId: null,
      setSelectedRecommendationPlantingId: vi.fn(),
      plantingRecommendation: null,
      refreshSeasonalPlan: vi.fn(async () => undefined),
      sensorSummary: null,
      gardenTimeline: null,
      loadTimelineForGarden: vi.fn(async () => undefined),
      loadSensorSummaryForGarden: vi.fn(async () => undefined),
      gardenExtensionResources: null,
      loadExtensionResourcesForGarden: vi.fn(async () => undefined),
    },
    cropLibrary: {
      cropTemplateSyncStatus: null,
      isRefreshingCropLibrary: false,
      isCleaningLegacyCropLibrary: false,
      refreshCropTemplateDatabase: vi.fn(async () => undefined),
      requestLegacyCropCleanup: vi.fn(),
    },
    loading: {
      isLoadingGardenData: false,
      isLoadingWeather: false,
      isLoadingClimate: false,
      isLoadingPlantingWindows: false,
      isLoadingSunPath: false,
      isLoadingSeasonalPlan: false,
      isLoadingSensorSummary: false,
      isLoadingTimeline: false,
      isLoadingPlantingRecommendation: false,
      isLoadingExtensionResources: false,
    },
    plannerUi: {
      placementBedId: null,
      setPlacementBedId: vi.fn(),
      plannerUndoCount: 0,
      plannerRedoCount: 0,
      undoPlannerChange: vi.fn(async () => undefined),
      redoPlannerChange: vi.fn(async () => undefined),
      plantingSettings: {
        plantingMethod: "direct_seed",
        setPlantingMethod: vi.fn(),
        plantingLocation: "in_bed",
        setPlantingLocation: vi.fn(),
        plantingDate: "2026-04-01",
        setPlantingDate: vi.fn(),
        plantingMovedOn: null,
        setPlantingMovedOn: vi.fn(),
      },
    },
    actions: {
      taskActions: { tasks: [] } as unknown as AppPageContentProps["actions"]["taskActions"],
      gardenActions: {} as AppPageContentProps["actions"]["gardenActions"],
      cropFormState: {} as AppPageContentProps["actions"]["cropFormState"],
      plannerActions: {} as AppPageContentProps["actions"]["plannerActions"],
      coachState: {} as AppPageContentProps["actions"]["coachState"],
      pestLogActions: {} as AppPageContentProps["actions"]["pestLogActions"],
      derived: { selectedGardenName: "Backyard", cropMap: new Map(), yardWidthFt: 20, yardLengthFt: 30 } as AppPageContentProps["actions"]["derived"],
    },
    confirm: {
      confirmState: null,
      setConfirmState: vi.fn(),
      isConfirmingAction: false,
      runConfirmedAction: vi.fn(async () => undefined),
    },
    notices: {
      notices: [],
      dismissNotice: vi.fn(),
      pushNotice: vi.fn(),
    },
  };
}

describe("AppPageContent", () => {
  it("renders the home page when active page is home", async () => {
    render(<AppPageContent {...makeProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId("home-page-section")).toBeInTheDocument();
    });
  });

  it("returns nothing for garden-required pages without a selected garden", () => {
    const props = makeProps();
    props.routing.activePage = "planner";

    const { container } = render(<AppPageContent {...props} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("keeps crop library accessible without a selected garden", async () => {
    const props = makeProps();
    props.routing.activePage = "crops";

    render(<AppPageContent {...props} />);

    await waitFor(() => {
      expect(screen.getByTestId("crops-page-section")).toBeInTheDocument();
    });
  });

  it("routes selected-garden pages to their page sections", async () => {
    const props = makeProps();
    props.garden.selectedGarden = 1;
    props.garden.selectedGardenRecord = {
      id: 1,
      name: "Backyard",
      description: "",
      zip_code: "80301",
      growing_zone: "6a",
      yard_width_ft: 20,
      yard_length_ft: 30,
      latitude: 40,
      longitude: -105,
      orientation: "south",
      sun_exposure: "full_sun",
      wind_exposure: "moderate",
      thermal_mass: "moderate",
      slope_position: "mid",
      frost_pocket_risk: "low",
      address_private: "",
      is_shared: false,
      edge_buffer_in: 6,
    };

    const pages: Array<[AppPageContentProps["routing"]["activePage"], string]> = [
      ["timeline", "timeline-page-section"],
      ["calendar", "calendar-page"],
      ["planner", "planner-page"],
      ["seasonal", "seasonal-plan-page"],
      ["sensors", "sensors-page-section"],
      ["coach", "coach-page-section"],
      ["pests", "pests-page-section"],
    ];

    for (const [page, testId] of pages) {
      props.routing.activePage = page;
      const { unmount } = render(<AppPageContent {...props} />);
      await waitFor(() => {
        expect(screen.getByTestId(testId)).toBeInTheDocument();
      });
      unmount();
    }
  });
});