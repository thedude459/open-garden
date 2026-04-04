import { useCallback, useEffect, useRef, useState } from "react";
import { AppPage } from "../types";
import { isoDate } from "../utils";

export const GARDEN_REQUIRED_PAGES: AppPage[] = [
  "timeline", "calendar", "seasonal", "planner", "coach", "pests", "sensors",
];

interface UsePageRouterParams {
  token: string;
  authFlow: { setIsEmailVerified: (value: boolean) => void; setResetToken: (token: string) => void; setAuthPane: (pane: string) => void; verifyEmailToken?: (token: string) => Promise<void> };
  pushNotice: (message: string, kind: "info" | "success" | "error") => void;
  selectedGarden?: number | null;
}

interface UsePageRouterReturn {
  activePage: AppPage;
  setActivePage: (page: AppPage) => void;
  navigateTo: (page: AppPage) => void;
  isNavOpen: boolean;
  setIsNavOpen: (open: boolean) => void;
  isHelpOpen: boolean;
  setIsHelpOpen: (open: boolean) => void;
  monthCursor: Date;
  setMonthCursor: (date: Date) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  placementBedId: number | null;
  setPlacementBedId: (id: number | null) => void;
}

export function usePageRouter({
  token,
  authFlow,
  pushNotice,
  selectedGarden,
}: UsePageRouterParams): UsePageRouterReturn {
  const [activePage, setActivePage] = useState<AppPage>("home");
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => {
    return isoDate(new Date());
  });
  const [placementBedId, setPlacementBedId] = useState<number | null>(null);

  const authParamsHandledRef = useRef(false);

  // Handle auth URL params (verify token, reset token)
  useEffect(() => {
    if (authParamsHandledRef.current) return;
    authParamsHandledRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get("verify_token");
    const reset = params.get("reset_token");

    if (verifyToken && authFlow.verifyEmailToken) {
      authFlow.verifyEmailToken(verifyToken)
        .then(() => {
          authFlow.setIsEmailVerified(true);
          pushNotice("Email verified. Password reset is now available.", "success");
        })
        .catch((err: any) =>
          pushNotice(
            err?.message || "Verification link is invalid or expired.",
            "error"
          )
        )
        .finally(() => {
          params.delete("verify_token");
          const q = params.toString();
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}${q ? `?${q}` : ""}`
          );
        });
    }

    if (reset) {
      authFlow.setResetToken(reset);
      authFlow.setAuthPane("reset");
      params.delete("reset_token");
      const q = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${q ? `?${q}` : ""}`
      );
    }
  }, []);

  // Show help modal on first login if not seen before
  useEffect(() => {
    if (token && !localStorage.getItem("open-garden-help-seen")) {
      setIsHelpOpen(true);
    }
  }, [token]);

  // Guard: redirect to home if page requires garden but none selected
  useEffect(() => {
    if (selectedGarden === undefined || selectedGarden === null) {
      if (GARDEN_REQUIRED_PAGES.includes(activePage)) {
        setActivePage("home");
      }
    }
  }, [selectedGarden, activePage]);

  // Close nav when page or garden changes
  useEffect(() => {
    setIsNavOpen(false);
  }, [activePage, selectedGarden]);

  const navigateTo = useCallback(
    (page: AppPage) => {
      setActivePage(page);
      setIsNavOpen(false);
    },
    []
  );

  return {
    activePage,
    setActivePage,
    navigateTo,
    isNavOpen,
    setIsNavOpen,
    isHelpOpen,
    setIsHelpOpen,
    monthCursor,
    setMonthCursor,
    selectedDate,
    setSelectedDate,
    placementBedId,
    setPlacementBedId,
  };
}
