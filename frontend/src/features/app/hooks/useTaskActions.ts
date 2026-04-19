import { FormEvent, useCallback, useEffect, useState } from "react";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { FetchAuthed } from "../types";
import { getErrorMessage } from "../utils/appUtils";
import { Planting, Task } from "../../types";

type NoticeKind = "info" | "success" | "error";

interface UseTaskActionsParams {
  fetchAuthed: FetchAuthed;
  pushNotice: (message: string, kind: NoticeKind) => void;
  token: string;
  selectedGarden: number | null;
  setPlantings: React.Dispatch<React.SetStateAction<Planting[]>>;
  invalidateSeasonalPlanCache: (gardenId: number) => void;
}

export function useTaskActions({
  fetchAuthed,
  pushNotice,
  token,
  selectedGarden,
  setPlantings,
  invalidateSeasonalPlanCache,
}: UseTaskActionsParams) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskQuery, setTaskQuery] = useState("");
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const debouncedTaskQuery = useDebouncedValue(taskQuery, 320);

  const loadTasks = useCallback(
    async (gardenId: number, query: string) => {
      try {
        setIsLoadingTasks(true);
        const tasksData: Task[] = await fetchAuthed(
          `/tasks?garden_id=${gardenId}&q=${encodeURIComponent(query)}`,
        );
        setTasks(tasksData);
      } finally {
        setIsLoadingTasks(false);
      }
    },
    [fetchAuthed],
  );

  const refreshTasks = useCallback(async () => {
    if (selectedGarden) {
      await loadTasks(selectedGarden, debouncedTaskQuery);
    }
  }, [selectedGarden, debouncedTaskQuery, loadTasks]);

  useEffect(() => {
    if (token && selectedGarden) {
      loadTasks(selectedGarden, debouncedTaskQuery).catch(() => {});
    }
  }, [token, selectedGarden, debouncedTaskQuery, loadTasks]);

  const createTask = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!selectedGarden) return;
      const form = e.currentTarget;
      const fd = new FormData(form);
      try {
        await fetchAuthed("/tasks", {
          method: "POST",
          body: JSON.stringify({
            garden_id: selectedGarden,
            title: fd.get("title"),
            due_on: fd.get("due_on"),
            notes: fd.get("notes") || "",
          }),
        });
        form.reset();
        await loadTasks(selectedGarden, debouncedTaskQuery);
        pushNotice("Task added.", "success");
      } catch (err: unknown) {
        pushNotice(getErrorMessage(err, "Unable to create task."), "error");
      }
    },
    [fetchAuthed, selectedGarden, loadTasks, debouncedTaskQuery, pushNotice],
  );

  const toggleTaskDone = useCallback(
    async (taskId: number, done: boolean) => {
      try {
        const updated: Task = await fetchAuthed(`/tasks/${taskId}`, {
          method: "PATCH",
          body: JSON.stringify({ is_done: done }),
        });
        setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      } catch (err: unknown) {
        pushNotice(getErrorMessage(err, "Unable to update task."), "error");
      }
    },
    [fetchAuthed, pushNotice],
  );

  const deleteTask = useCallback(
    async (taskId: number) => {
      try {
        await fetchAuthed(`/tasks/${taskId}`, { method: "DELETE" });
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
      } catch (err: unknown) {
        pushNotice(getErrorMessage(err, "Unable to delete task."), "error");
      }
    },
    [fetchAuthed, pushNotice],
  );

  const editTask = useCallback(
    async (taskId: number, update: { title?: string; due_on?: string; notes?: string }) => {
      try {
        const updated: Task = await fetchAuthed(`/tasks/${taskId}`, {
          method: "PATCH",
          body: JSON.stringify(update),
        });
        setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      } catch (err: unknown) {
        pushNotice(getErrorMessage(err, "Unable to update task."), "error");
      }
    },
    [fetchAuthed, pushNotice],
  );

  const logHarvest = useCallback(
    async (plantingId: number, harvested_on: string, yield_notes: string) => {
      try {
        const updated: Planting = await fetchAuthed(`/plantings/${plantingId}/harvest`, {
          method: "PATCH",
          body: JSON.stringify({ harvested_on, yield_notes }),
        });
        setPlantings((prev) => prev.map((p) => (p.id === plantingId ? updated : p)));
        if (selectedGarden) {
          invalidateSeasonalPlanCache(selectedGarden);
        }
        pushNotice("Harvest logged!", "success");
      } catch (err: unknown) {
        pushNotice(getErrorMessage(err, "Unable to log harvest."), "error");
      }
    },
    [fetchAuthed, setPlantings, selectedGarden, invalidateSeasonalPlanCache, pushNotice],
  );

  return {
    tasks,
    setTasks,
    taskQuery,
    setTaskQuery,
    isLoadingTasks,
    debouncedTaskQuery,
    loadTasks,
    refreshTasks,
    createTask,
    toggleTaskDone,
    deleteTask,
    editTask,
    logHarvest,
  };
}
