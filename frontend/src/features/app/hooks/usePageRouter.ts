import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppPage } from "../types";
import { isoDate } from "../utils/appUtils";
import {
  buildAppPath,
  consumeIntendedGardenPage,
  INTENDED_GARDEN_PAGE_KEY,
  parseAppPath,
} from "../utils/appPaths";
import type { Garden } from "../../types";

export const GARDEN_REQUIRED_PAGES: AppPage[] = [
  "timeline",
  "calendar",
  "seasonal",
  "planner",
  "coach",
  "pests",
  "sensors",
  "journal",
];

interface UsePageRouterParams {
  token: string;
  authFlow: {
    setIsEmailVerified: (value: boolean) => void;
    setResetToken: (token: string) => void;
    setAuthPane: (pane: "login" | "forgot-password" | "forgot-username" | "reset") => void;
    verifyEmailToken?: (token: string) => Promise<void>;
  };
  pushNotice: (message: string, kind: "info" | "success" | "error") => void;
  selectedGarden?: number | null;
  setSelectedGarden: (id: number | null) => void;
  gardens: Garden[];
}

interface UsePageRouterReturn {
  activePage: AppPage;
  navigateTo: (page: AppPage) => void;
  /** Call after user picks a garden from My Gardens to honor any queued deep-link intent */
  resumeAfterGardenPick: (gardenId: number) => void;
  isNavOpen: boolean;
  setIsNavOpen: (open: boolean) => void;
  isHelpOpen: boolean;
  setIsHelpOpen: (open: boolean) => void;
  monthCursor: Date;
  setMonthCursor: Dispatch<SetStateAction<Date>>;
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
  setSelectedGarden,
  gardens,
}: UsePageRouterParams): UsePageRouterReturn {
  const navigate = useNavigate();
  const location = useLocation();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpPromptedForToken, setHelpPromptedForToken] = useState<string | null>(null);
  const [navContextKey, setNavContextKey] = useState(`${location.pathname}:${selectedGarden ?? ""}`);
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()));
  const [placementBedId, setPlacementBedId] = useState<number | null>(null);

  const authParamsHandledRef = useRef(false);

  const activePage: AppPage = useMemo(() => {
    const parsed = parseAppPath(location.pathname);
    if (!parsed) return "home";
    return parsed.page;
  }, [location.pathname]);

  // Handle auth URL params (verify token, reset token)
  useEffect(() => {
    if (authParamsHandledRef.current) return;
    authParamsHandledRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get("verify_token");
    const reset = params.get("reset_token");

    if (verifyToken && authFlow.verifyEmailToken) {
      authFlow
        .verifyEmailToken(verifyToken)
        .then(() => {
          authFlow.setIsEmailVerified(true);
          pushNotice("Email verified. Password reset is now available.", "success");
        })
        .catch((err: unknown) =>
          pushNotice(
            err instanceof Error && err.message
              ? err.message
              : "Verification link is invalid or expired.",
            "error"
          )
        )
        .finally(() => {
          params.delete("verify_token");
          const q = params.toString();
          window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
        });
    }

    if (reset) {
      authFlow.setResetToken(reset);
      authFlow.setAuthPane("reset");
      params.delete("reset_token");
      const q = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
    }
  }, [authFlow, pushNotice]);

  // Canonical paths
  useEffect(() => {
    if (location.pathname === "/" || location.pathname === "") {
      navigate("/home", { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    const parsed = parseAppPath(location.pathname);
    if (!parsed) {
      navigate("/home", { replace: true });
      return;
    }
    if (parsed.kind === "garden" && parsed.gardenId !== selectedGarden) {
      setSelectedGarden(parsed.gardenId);
    }
  }, [location.pathname, navigate, selectedGarden, setSelectedGarden]);

  useEffect(() => {
    const parsed = parseAppPath(location.pathname);
    if (parsed?.kind !== "garden") return;
    if (gardens.length === 0) return;
    const exists = gardens.some((g) => g.id === parsed.gardenId);
    if (!exists) {
      pushNotice("That garden is unavailable.", "error");
      navigate("/home", { replace: true });
    }
  }, [gardens, location.pathname, navigate, pushNotice]);

  const nextNavContextKey = `${location.pathname}:${selectedGarden ?? ""}`;
  if (nextNavContextKey !== navContextKey) {
    setNavContextKey(nextNavContextKey);
    if (isNavOpen) {
      setIsNavOpen(false);
    }
  }

  if (token && helpPromptedForToken !== token) {
    setHelpPromptedForToken(token);
    if (!localStorage.getItem("open-garden-help-seen")) {
      setIsHelpOpen(true);
    }
  }

  const navigateTo = useCallback(
    (page: AppPage) => {
      setIsNavOpen(false);
      if (page === "home") {
        navigate("/home");
        return;
      }
      if (page === "crops") {
        navigate("/crops");
        return;
      }
      if (!selectedGarden) {
        sessionStorage.setItem(INTENDED_GARDEN_PAGE_KEY, page);
        navigate("/home");
        pushNotice("Pick a garden from My Gardens to open planning tools.", "info");
        return;
      }
      navigate(buildAppPath(page, selectedGarden));
    },
    [navigate, pushNotice, selectedGarden]
  );

  const resumeAfterGardenPick = useCallback(
    (gardenId: number) => {
      const intended = consumeIntendedGardenPage();
      if (intended) {
        navigate(buildAppPath(intended, gardenId));
      }
    },
    [navigate]
  );

  return {
    activePage,
    navigateTo,
    resumeAfterGardenPick,
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
