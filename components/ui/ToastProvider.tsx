"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ToastNotification, ToastVariant } from "@/lib/planner/types";
import { ToastStack } from "./Toast";

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      const id = `toast-${++toastCounter}`;
      const duration_ms = variant === "error" ? 5000 : 3000;
      const toast: ToastNotification = {
        id,
        variant,
        message,
        created_at: Date.now(),
        duration_ms,
      };
      setToasts((current) => [...current.slice(-2), toast]);
      const timer = window.setTimeout(() => dismiss(id), duration_ms);
      timersRef.current.set(id, timer);
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      showToast,
      success: (message: string) => showToast(message, "success"),
      error: (message: string) => showToast(message, "error"),
    }),
    [showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
