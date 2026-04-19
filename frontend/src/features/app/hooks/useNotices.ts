import { useCallback, useState } from "react";
import { ToastNotice } from "../../../components/ToastRegion";

export function useNotices() {
  const [notices, setNotices] = useState<ToastNotice[]>([]);

  const dismissNotice = useCallback((id: number) => {
    setNotices((prev) => prev.filter((notice) => notice.id !== id));
  }, []);

  const pushNotice = useCallback((message: string, kind: ToastNotice["kind"], actionLabel?: string, onAction?: () => void) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setNotices((prev) => [...prev, { id, message, kind, actionLabel, onAction }]);
    // Errors need longer read time; routine success/info confirmations auto-dismiss quickly
    // so they do not overlap page content.
    const dwellMs = kind === "error" ? 7000 : actionLabel ? 6000 : 3500;
    window.setTimeout(() => {
      setNotices((prev) => prev.filter((notice) => notice.id !== id));
    }, dwellMs);
  }, []);

  return { notices, dismissNotice, pushNotice };
}
