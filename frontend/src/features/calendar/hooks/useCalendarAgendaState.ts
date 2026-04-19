import { FormEvent, useMemo, useState } from "react";
import { CalendarEvent } from "../../types";
import { TaskActions } from "../CalendarContext";

type TaskFilter = "all" | "todo" | "done";

type TaskDraft = { title: string; due_on: string; notes: string };
type HarvestDraft = { harvested_on: string; yield_notes: string };
type TaskFormErrors = { title: string; due_on: string };

interface UseCalendarAgendaStateParams {
  selectedDayEvents: CalendarEvent[];
  selectedCropName: string;
  taskActions: TaskActions;
}

export function useCalendarAgendaState({
  selectedDayEvents,
  taskActions,
}: UseCalendarAgendaStateParams) {
  const [taskDoneFilter, setTaskDoneFilter] = useState<TaskFilter>("all");
  const [taskEditId, setTaskEditId] = useState<number | null>(null);
  const [taskEditDraft, setTaskEditDraft] = useState<TaskDraft>({ title: "", due_on: "", notes: "" });
  const [harvestEditId, setHarvestEditId] = useState<number | null>(null);
  const [harvestDraft, setHarvestDraft] = useState<HarvestDraft>({ harvested_on: "", yield_notes: "" });
  const [taskFormErrors, setTaskFormErrors] = useState<TaskFormErrors>({ title: "", due_on: "" });

  const hasTasks = useMemo(
    () => selectedDayEvents.some((event) => event.kind === "task"),
    [selectedDayEvents],
  );

  const filteredDayEvents = useMemo(
    () => selectedDayEvents.filter((event) => {
      if (event.kind !== "task") return true;
      if (taskDoneFilter === "todo") return !event.is_done;
      if (taskDoneFilter === "done") return event.is_done;
      return true;
    }),
    [selectedDayEvents, taskDoneFilter],
  );

  function validateTaskField(field: keyof TaskFormErrors, value: string) {
    if (field === "title") {
      return value.trim() ? "" : "Task title is required.";
    }
    return value.trim() ? "" : "Due date is required.";
  }

  function handleTaskFieldBlur(field: keyof TaskFormErrors, value: string) {
    setTaskFormErrors((current) => ({ ...current, [field]: validateTaskField(field, value) }));
  }

  function handleTaskSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const nextErrors = {
      title: validateTaskField("title", String(formData.get("title") || "")),
      due_on: validateTaskField("due_on", String(formData.get("due_on") || "")),
    };
    setTaskFormErrors(nextErrors);
    if (nextErrors.title || nextErrors.due_on) {
      event.preventDefault();
      return;
    }
    taskActions.createTask(event);
  }

  function beginTaskEdit(event: CalendarEvent) {
    if (event.taskId === undefined) {
      return;
    }
    setTaskEditId(event.taskId);
    setTaskEditDraft({
      title: event.title,
      due_on: event.date,
      notes: event.notes || "",
    });
  }

  function saveTaskEdit(taskId: number) {
    taskActions.editTask(taskId, {
      title: taskEditDraft.title,
      due_on: taskEditDraft.due_on,
      notes: taskEditDraft.notes,
    });
    setTaskEditId(null);
  }

  function beginHarvestEdit(event: CalendarEvent) {
    if (event.plantingId === undefined) {
      return;
    }
    setHarvestEditId(event.plantingId);
    setHarvestDraft({
      harvested_on: event.harvested_on || "",
      yield_notes: event.yield_notes || "",
    });
  }

  function beginHarvestLog(plantingId: number, today: string) {
    setHarvestEditId(plantingId);
    setHarvestDraft({ harvested_on: today, yield_notes: "" });
  }

  function saveHarvestEdit(plantingId: number) {
    taskActions.logHarvest(plantingId, harvestDraft.harvested_on, harvestDraft.yield_notes);
    setHarvestEditId(null);
  }

  return {
    taskDoneFilter,
    setTaskDoneFilter,
    hasTasks,
    filteredDayEvents,
    taskEditId,
    setTaskEditId,
    taskEditDraft,
    setTaskEditDraft,
    harvestEditId,
    setHarvestEditId,
    harvestDraft,
    setHarvestDraft,
    taskFormErrors,
    handleTaskFieldBlur,
    handleTaskSubmit,
    beginTaskEdit,
    saveTaskEdit,
    beginHarvestEdit,
    beginHarvestLog,
    saveHarvestEdit,
  };
}
