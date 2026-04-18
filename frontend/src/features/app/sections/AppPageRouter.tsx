import { Dispatch, SetStateAction, useState } from "react";
import { AppNavbar } from "../../../components/AppNavbar";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { HelpModal } from "../../../components/HelpModal";
import { ToastRegion, ToastNotice } from "../../../components/ToastRegion";
import { AppPage, ConfirmState } from "../types";
import { GARDEN_REQUIRED_PAGES } from "../hooks/usePageRouter";
import { useTaskActions } from "../hooks/useTaskActions";
import { useGardenActions } from "../hooks/useGardenActions";
import { useCropFormState } from "../hooks/useCropFormState";
import { usePlannerActions } from "../hooks/usePlannerActions";
import { useCoachState } from "../hooks/useCoachState";
import { usePestLogActions } from "../hooks/usePestLogActions";
import { useDerivedGardenState } from "../hooks/useDerivedGardenState";
import { PageHeading } from "../../../components/PageHeading";
import { EmailVerificationNotice } from "./EmailVerificationNotice";
import { GardenRequiredNotice } from "./GardenRequiredNotice";
import { AppPageContent } from "./AppPageContent";
import {
  Bed, CropTemplate, CropTemplateSyncStatus, Garden, GardenClimate,
  GardenSeasonalPlan, GardenSensorsSummary, GardenSunPath, GardenTimeline,
  Placement, PlantingRecommendations,
} from "../../types";

export interface AppPageRouterProps {
  routing: {
    activePage: AppPage;
    setActivePage: (page: AppPage) => void;
    navigateTo: (page: AppPage) => void;
  };
  shell: {
    isNavOpen: boolean;
    setIsNavOpen: (open: boolean) => void;
    isHelpOpen: boolean;
    setIsHelpOpen: (open: boolean) => void;
    onLogout: () => void;
  };
  auth: {
    isEmailVerified: boolean | null;
    onResendVerificationEmail: () => void;
  };
  garden: {
    selectedGarden: number | null;
    setSelectedGarden: (id: number | null) => void;
    selectedGardenRecord: Garden | undefined;
    gardens: Garden[];
    publicGardens: Garden[];
    beds: Bed[];
    placements: Placement[];
    cropTemplates: CropTemplate[];
  };
  calendar: {
    today: string;
    monthCursor: Date;
    setMonthCursor: Dispatch<SetStateAction<Date>>;
    selectedDate: string;
    setSelectedDate: (date: string) => void;
    selectedCropName: string;
  };
  insights: {
    weather: Record<string, unknown> | null;
    gardenClimate: GardenClimate | null;
    gardenSunPath: GardenSunPath | null;
    seasonalPlan: GardenSeasonalPlan | null;
    selectedRecommendationPlantingId: number | null;
    setSelectedRecommendationPlantingId: (id: number | null) => void;
    plantingRecommendation: PlantingRecommendations | null;
    refreshSeasonalPlan: () => Promise<void>;
    sensorSummary: GardenSensorsSummary | null;
    gardenTimeline: GardenTimeline | null;
    loadTimelineForGarden: (garden: Garden, forceRefresh?: boolean) => Promise<void>;
    loadSensorSummaryForGarden: (garden: Garden) => Promise<void>;
  };
  cropLibrary: {
    cropTemplateSyncStatus: CropTemplateSyncStatus | null;
    isRefreshingCropLibrary: boolean;
    isCleaningLegacyCropLibrary: boolean;
    refreshCropTemplateDatabase: () => Promise<void>;
    requestLegacyCropCleanup: () => void;
  };
  loading: {
    isLoadingGardenData: boolean;
    isLoadingWeather: boolean;
    isLoadingClimate: boolean;
    isLoadingPlantingWindows: boolean;
    isLoadingSunPath: boolean;
    isLoadingSeasonalPlan: boolean;
    isLoadingSensorSummary: boolean;
    isLoadingTimeline: boolean;
    isLoadingPlantingRecommendation: boolean;
  };
  plannerUi: {
    placementBedId: number | null;
    setPlacementBedId: (id: number | null) => void;
    plannerUndoCount: number;
    plannerRedoCount: number;
    undoPlannerChange: () => Promise<void>;
    redoPlannerChange: () => Promise<void>;
  };
  actions: {
    taskActions: ReturnType<typeof useTaskActions>;
    gardenActions: ReturnType<typeof useGardenActions>;
    cropFormState: ReturnType<typeof useCropFormState>;
    plannerActions: ReturnType<typeof usePlannerActions>;
    coachState: ReturnType<typeof useCoachState>;
    pestLogActions: ReturnType<typeof usePestLogActions>;
    derived: ReturnType<typeof useDerivedGardenState>;
  };
  confirm: {
    confirmState: ConfirmState | null;
    setConfirmState: Dispatch<SetStateAction<ConfirmState | null>>;
    isConfirmingAction: boolean;
    runConfirmedAction: () => Promise<void>;
  };
  notices: {
    notices: ToastNotice[];
    dismissNotice: (id: number) => void;
    pushNotice: (message: string, kind: "info" | "success" | "error", actionLabel?: string, onAction?: () => void) => void;
  };
}

export function AppPageRouter(props: AppPageRouterProps) {
  const {
    routing,
    shell,
    auth,
    garden,
    calendar,
    insights,
    cropLibrary,
    loading,
    plannerUi,
    actions,
    confirm,
    notices,
  } = props;

  const { activePage, setActivePage, navigateTo } = routing;
  const { isNavOpen, setIsNavOpen, isHelpOpen, setIsHelpOpen, onLogout } = shell;
  const { isEmailVerified, onResendVerificationEmail } = auth;
  const { selectedGarden, selectedGardenRecord } = garden;
  const { confirmState, setConfirmState, isConfirmingAction, runConfirmedAction } = confirm;
  const { notices: toastNotices, dismissNotice } = notices;
  const [isPlannerVerificationNoticeDismissed, setIsPlannerVerificationNoticeDismissed] = useState(false);
  const showEmailVerificationNotice = isEmailVerified === false && (activePage !== "planner" || !isPlannerVerificationNoticeDismissed);

  const shellWide = activePage === "planner" || activePage === "calendar";

  return (
    <main className={shellWide ? "shell shell--tool" : "shell"}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <AppNavbar
        activePage={activePage}
        selectedGarden={selectedGarden}
        selectedGardenRecord={selectedGardenRecord}
        isNavOpen={isNavOpen}
        setIsNavOpen={setIsNavOpen}
        onNavigate={navigateTo}
        onLogout={onLogout}
        onHelpOpen={() => { setIsNavOpen(false); setIsHelpOpen(true); }}
      />

      <div className="page-body" id="main-content" tabIndex={-1}>
        {showEmailVerificationNotice && (
          <EmailVerificationNotice
            onResend={onResendVerificationEmail}
            compact={activePage === "planner"}
            onDismiss={activePage === "planner" ? () => setIsPlannerVerificationNoticeDismissed(true) : undefined}
          />
        )}

        {!selectedGarden && GARDEN_REQUIRED_PAGES.includes(activePage) && (
          <GardenRequiredNotice onGoHome={() => setActivePage("home")} />
        )}

        {!(selectedGarden === null && GARDEN_REQUIRED_PAGES.includes(activePage)) && (
          <PageHeading activePage={activePage} />
        )}

        <AppPageContent
          routing={routing}
          garden={garden}
          calendar={calendar}
          insights={insights}
          cropLibrary={cropLibrary}
          loading={loading}
          plannerUi={plannerUi}
          actions={actions}
          confirm={confirm}
          notices={notices}
        />
      </div>

      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title || "Confirm action"}
        message={confirmState?.message || "Are you sure?"}
        confirmLabel={isConfirmingAction ? "Working..." : confirmState?.confirmLabel || "Confirm"}
        onConfirm={() => { if (!isConfirmingAction) runConfirmedAction(); }}
        onCancel={() => { if (!isConfirmingAction) setConfirmState(null); }}
      />

      <HelpModal
        isOpen={isHelpOpen}
        onClose={(remember) => {
          setIsHelpOpen(false);
          if (remember) localStorage.setItem("open-garden-help-seen", "1");
        }}
      />

      <ToastRegion
        notices={toastNotices}
        onDismiss={dismissNotice}
        onAction={(id) => {
          const n = toastNotices.find((notice) => notice.id === id);
          if (n?.onAction) n.onAction();
          dismissNotice(id);
        }}
      />
    </main>
  );
}
