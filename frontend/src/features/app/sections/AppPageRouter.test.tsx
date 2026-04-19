import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppPageRouter } from "./AppPageRouter";

afterEach(() => {
  cleanup();
});

vi.mock("../../../components/AppNavbar", () => ({
  AppNavbar: () => <div data-testid="app-navbar" />,
}));

vi.mock("../../../components/ConfirmDialog", () => ({
  ConfirmDialog: () => <div data-testid="confirm-dialog" />,
}));

vi.mock("../../../components/HelpModal", () => ({
  HelpModal: () => <div data-testid="help-modal" />,
}));

vi.mock("../../../components/ToastRegion", () => ({
  ToastRegion: () => <div data-testid="toast-region" />,
}));

vi.mock("./EmailVerificationNotice", () => ({
  EmailVerificationNotice: ({ onDismiss }: { onDismiss?: () => void }) => (
    <div data-testid="email-verification-notice">
      {onDismiss ? <button type="button" onClick={onDismiss}>Dismiss verification notice</button> : null}
    </div>
  ),
}));

vi.mock("./GardenRequiredNotice", () => ({
  GardenRequiredNotice: () => <div data-testid="garden-required-notice" />,
}));

vi.mock("../../home/HomePageSection", () => ({
  HomePageSection: () => <div data-testid="home-page-section" />,
}));

vi.mock("../../calendar/CalendarPage", () => ({
  CalendarPage: () => <div data-testid="calendar-page" />,
}));

vi.mock("../../coach/CoachPageSection", () => ({
  CoachPageSection: () => <div data-testid="coach-page-section" />,
}));

vi.mock("../../crops/CropsPageSection", () => ({
  CropsPageSection: () => <div data-testid="crops-page-section" />,
}));

vi.mock("../../pests/PestsPageSection", () => ({
  PestsPageSection: () => <div data-testid="pests-page-section" />,
}));

vi.mock("../../planning/SeasonalPlanPage", () => ({
  SeasonalPlanPage: () => <div data-testid="seasonal-plan-page" />,
}));

vi.mock("../../planner/PlannerPage", () => ({
  PlannerPage: () => <div data-testid="planner-page" />,
}));

vi.mock("../../sensors/SensorsPageSection", () => ({
  SensorsPageSection: () => <div data-testid="sensors-page-section" />,
}));

vi.mock("../../timeline/TimelinePageSection", () => ({
  TimelinePageSection: () => <div data-testid="timeline-page-section" />,
}));

type AppPageRouterProps = Parameters<typeof AppPageRouter>[0];

function makeProps(): AppPageRouterProps {
  return {
    routing: {
      activePage: "home",
      setActivePage: vi.fn(),
      navigateTo: vi.fn(),
    },
    shell: {
      isNavOpen: false,
      setIsNavOpen: vi.fn(),
      isHelpOpen: false,
      setIsHelpOpen: vi.fn(),
      onLogout: vi.fn(),
    },
    auth: {
      isEmailVerified: true,
      onResendVerificationEmail: vi.fn(),
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
      selectedCropName: "",
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
      taskActions: {} as AppPageRouterProps["actions"]["taskActions"],
      gardenActions: {} as AppPageRouterProps["actions"]["gardenActions"],
      cropFormState: {} as AppPageRouterProps["actions"]["cropFormState"],
      plannerActions: {} as AppPageRouterProps["actions"]["plannerActions"],
      coachState: {} as AppPageRouterProps["actions"]["coachState"],
      pestLogActions: {} as AppPageRouterProps["actions"]["pestLogActions"],
      derived: { selectedGardenName: "My Garden" } as AppPageRouterProps["actions"]["derived"],
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

describe("AppPageRouter", () => {
  it("renders home page section when active page is home", async () => {
    render(<AppPageRouter {...makeProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId("home-page-section")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("garden-required-notice")).not.toBeInTheDocument();
  });

  it("shows garden required notice and blocks garden pages when no garden is selected", () => {
    const props = makeProps();
    props.routing.activePage = "planner";

    render(<AppPageRouter {...props} />);

    expect(screen.getByTestId("garden-required-notice")).toBeInTheDocument();
    expect(screen.queryByTestId("planner-page")).not.toBeInTheDocument();
  });

  it("renders planner page once a garden is selected", async () => {
    const props = makeProps();
    props.routing.activePage = "planner";
    props.garden.selectedGarden = 42;

    render(<AppPageRouter {...props} />);

    await waitFor(() => {
      expect(screen.getByTestId("planner-page")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("garden-required-notice")).not.toBeInTheDocument();
  });

  it("shows a dismissible verification notice when the email is unverified", () => {
    const props = makeProps();
    props.routing.activePage = "planner";
    props.garden.selectedGarden = 42;
    props.auth.isEmailVerified = false;

    render(<AppPageRouter {...props} />);

    expect(screen.getByTestId("email-verification-notice")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss verification notice" }));
    expect(screen.queryByTestId("email-verification-notice")).not.toBeInTheDocument();
  });
});
