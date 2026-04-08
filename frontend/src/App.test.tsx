import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

let latestRouterProps: unknown = null;
const authScreenMock = vi.fn(() => <div data-testid="auth-screen" />);
const appPageRouterMock = vi.fn((props: unknown) => {
  latestRouterProps = props;
  return <div data-testid="app-page-router" />;
});

afterEach(() => {
  cleanup();
});

vi.mock("./features/auth/AuthScreen", () => ({
  AuthScreen: () => authScreenMock(),
}));

vi.mock("./features/app/sections/AppPageRouter", () => ({
  AppPageRouter: (props: unknown) => appPageRouterMock(props),
}));

vi.mock("./features/app/hooks/useNotices", () => ({
  useNotices: () => ({ notices: [], dismissNotice: vi.fn(), pushNotice: vi.fn() }),
}));

vi.mock("./features/app/hooks/useAuthedFetch", () => ({
  useAuthedFetch: () => ({ authHeaders: { Authorization: "Bearer tok" }, fetchAuthed: vi.fn() }),
}));

vi.mock("./features/app/hooks/useAuthFlow", () => ({
  useAuthFlow: () => ({
    email: "",
    setEmail: vi.fn(),
    username: "",
    setUsername: vi.fn(),
    password: "",
    setPassword: vi.fn(),
    loginMode: "signin",
    setLoginMode: vi.fn(),
    authPane: "login",
    setAuthPane: vi.fn(),
    setResetToken: vi.fn(),
    resetPassword: "",
    setResetPassword: vi.fn(),
    handleAuth: vi.fn(),
    handleForgotPassword: vi.fn(),
    handleForgotUsername: vi.fn(),
    submitPasswordReset: vi.fn(),
    isEmailVerified: true,
    setIsEmailVerified: vi.fn(),
    resendVerificationEmail: vi.fn(async () => undefined),
  }),
}));

vi.mock("./features/app/hooks/usePlannerHistory", () => ({
  usePlannerHistory: () => ({
    plannerUndoCount: 0,
    plannerRedoCount: 0,
    pushPlannerHistory: vi.fn(),
    undoPlannerChange: vi.fn(async () => undefined),
    redoPlannerChange: vi.fn(async () => undefined),
    resetPlannerHistory: vi.fn(),
  }),
}));

vi.mock("./features/app/hooks/useConfirmAction", () => ({
  useConfirmAction: () => ({
    confirmState: null,
    setConfirmState: vi.fn(),
    isConfirmingAction: false,
    runConfirmedAction: vi.fn(async () => undefined),
  }),
}));

vi.mock("./features/app/hooks/useGardenDataFlow", () => ({
  useGardenDataFlow: () => ({
    gardens: [{ id: 1, name: "My Garden" }],
    setGardens: vi.fn(),
    publicGardens: [],
    selectedGarden: 1,
    setSelectedGarden: vi.fn(),
    beds: [],
    setBeds: vi.fn(),
    plantings: [],
    setPlantings: vi.fn(),
    placements: [],
    setPlacements: vi.fn(),
    cropTemplates: [],
    weather: null,
    gardenClimate: null,
    plantingWindows: null,
    gardenSunPath: null,
    seasonalPlan: null,
    sensorSummary: null,
    gardenTimeline: null,
    plantingRecommendation: null,
    selectedRecommendationPlantingId: null,
    setSelectedRecommendationPlantingId: vi.fn(),
    cropTemplateSyncStatus: null,
    isRefreshingCropLibrary: false,
    isCleaningLegacyCropLibrary: false,
    isLoadingGardenData: false,
    isLoadingWeather: false,
    isLoadingClimate: false,
    isLoadingPlantingWindows: false,
    isLoadingSunPath: false,
    isLoadingSeasonalPlan: false,
    isLoadingSensorSummary: false,
    isLoadingTimeline: false,
    isLoadingPlantingRecommendation: false,
    selectedCropName: "",
    setSelectedCropName: vi.fn(),
    loadGardens: vi.fn(async () => undefined),
    loadCropTemplates: vi.fn(async () => undefined),
    loadGardenData: vi.fn(async () => undefined),
    loadClimateForGarden: vi.fn(async () => undefined),
    loadPlantingWindowsForGarden: vi.fn(async () => undefined),
    loadSunPathForGarden: vi.fn(async () => undefined),
    loadSeasonalPlanForGarden: vi.fn(async () => undefined),
    loadSensorSummaryForGarden: vi.fn(async () => undefined),
    loadTimelineForGarden: vi.fn(async () => undefined),
    loadPlantingRecommendation: vi.fn(async () => undefined),
    refreshCropTemplateDatabase: vi.fn(async () => undefined),
    requestLegacyCropCleanup: vi.fn(),
    refreshSeasonalPlan: vi.fn(async () => undefined),
    invalidateGardenInsightCaches: vi.fn(),
    invalidateSensorCaches: vi.fn(),
    invalidateSeasonalPlanCache: vi.fn(),
    noticeUnlessExpired: vi.fn(() => vi.fn()),
  }),
}));

vi.mock("./features/app/hooks/usePageRouter", () => ({
  usePageRouter: () => ({
    activePage: "home",
    setActivePage: vi.fn(),
    navigateTo: vi.fn(),
    isNavOpen: false,
    setIsNavOpen: vi.fn(),
    isHelpOpen: false,
    setIsHelpOpen: vi.fn(),
    monthCursor: new Date("2026-04-01"),
    setMonthCursor: vi.fn(),
    selectedDate: "2026-04-04",
    setSelectedDate: vi.fn(),
    placementBedId: null,
    setPlacementBedId: vi.fn(),
  }),
}));

vi.mock("./features/app/hooks/useTaskActions", () => ({ useTaskActions: () => ({ tasks: [], setTasks: vi.fn(), refreshTasks: vi.fn(async () => undefined) }) }));
vi.mock("./features/app/hooks/useGardenActions", () => ({ useGardenActions: () => ({}) }));
vi.mock("./features/app/hooks/useCropFormState", () => ({ useCropFormState: () => ({}) }));
vi.mock("./features/app/hooks/useDerivedGardenState", () => ({
  useDerivedGardenState: () => ({ yardWidthFt: 20, yardLengthFt: 20, cropMap: new Map(), selectedGardenName: "My Garden" }),
}));
vi.mock("./features/app/hooks/usePlannerActions", () => ({ usePlannerActions: () => ({}) }));
vi.mock("./features/app/hooks/useCoachState", () => ({ useCoachState: () => ({ resetCoach: vi.fn() }) }));
vi.mock("./features/app/hooks/usePestLogActions", () => ({ usePestLogActions: () => ({}) }));
vi.mock("./features/app/hooks/usePageDataEffects", () => ({ usePageDataEffects: vi.fn() }));

describe("App shell integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    latestRouterProps = null;
  });

  it("renders auth screen when no token is available", () => {
    render(<App />);

    expect(screen.getByTestId("auth-screen")).toBeInTheDocument();
    expect(screen.queryByTestId("app-page-router")).not.toBeInTheDocument();
  });

  it("renders router when token exists and logout returns to auth", () => {
    localStorage.setItem("open-garden-token", "tok");

    render(<App />);

    expect(screen.getByTestId("app-page-router")).toBeInTheDocument();
    const props = latestRouterProps as { shell: { onLogout: () => void } };

    act(() => {
      props.shell.onLogout();
    });

    expect(localStorage.getItem("open-garden-token")).toBeNull();
    expect(screen.getByTestId("auth-screen")).toBeInTheDocument();
  });
});
