import { useCallback, useRef, useState } from "react";
import { PlannerHistoryEntry } from "../types";

type Notify = (message: string, kind: "info" | "success" | "error") => void;

export function usePlannerHistory(notify: Notify) {
  const undoStackRef = useRef<PlannerHistoryEntry[]>([]);
  const redoStackRef = useRef<PlannerHistoryEntry[]>([]);
  const [plannerUndoCount, setPlannerUndoCount] = useState(0);
  const [plannerRedoCount, setPlannerRedoCount] = useState(0);

  const syncCounts = useCallback(() => {
    setPlannerUndoCount(undoStackRef.current.length);
    setPlannerRedoCount(redoStackRef.current.length);
  }, []);

  const pushPlannerHistory = useCallback((entry: PlannerHistoryEntry) => {
    undoStackRef.current.push(entry);
    redoStackRef.current = [];
    syncCounts();
  }, [syncCounts]);

  const undoPlannerChange = useCallback(async () => {
    const entry = undoStackRef.current.pop();
    if (!entry) {
      return;
    }
    await entry.undo();
    redoStackRef.current.push(entry);
    syncCounts();
    notify(`Undo: ${entry.label}.`, "info");
  }, [notify, syncCounts]);

  const redoPlannerChange = useCallback(async () => {
    const entry = redoStackRef.current.pop();
    if (!entry) {
      return;
    }
    await entry.redo();
    undoStackRef.current.push(entry);
    syncCounts();
    notify(`Redo: ${entry.label}.`, "info");
  }, [notify, syncCounts]);

  const resetPlannerHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    syncCounts();
  }, [syncCounts]);

  return {
    plannerUndoCount,
    plannerRedoCount,
    pushPlannerHistory,
    undoPlannerChange,
    redoPlannerChange,
    resetPlannerHistory,
  };
}
