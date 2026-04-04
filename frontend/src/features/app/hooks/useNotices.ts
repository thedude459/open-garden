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
    window.setTimeout(() => {
      setNotices((prev) => prev.filter((notice) => notice.id !== id));
    }, 6500);
  }, []);

  return { notices, dismissNotice, pushNotice };
}
