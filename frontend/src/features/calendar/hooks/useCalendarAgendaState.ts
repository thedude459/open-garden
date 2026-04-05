import { FormEvent, useMemo, useState } from "react";
import { CalendarEvent } from "../../types";
import { TaskActions } from "../CalendarContext";

type TaskFilter = "all" | "todo" | "done";

type TaskDraft = { title: string; due_on: string; notes: string };
type HarvestDraft = { harvested_on: string; yield_notes: string };
type TaskFormErrors = { title: string; due_on: string };
type PlantingFormErrors = { bed_id: string; crop_name: string; planted_on: string };

interface UseCalendarAgendaStateParams {
  selectedDayEvents: CalendarEvent[];
  selectedCropName: string;
  taskActions: TaskActions;
}

export function useCalendarAgendaState({
  selectedDayEvents,
  selectedCropName,
  taskActions,
}: UseCalendarAgendaStateParams) {
  const [taskDoneFilter, setTaskDoneFilter] = useState<TaskFilter>("all");
  const [taskEditId, setTaskEditId] = useState<number | null>(null);
  const [taskEditDraft, setTaskEditDraft] = useState<TaskDraft>({ title: "", due_on: "", notes: "" });
  const [harvestEditId, setHarvestEditId] = useState<number | null>(null);
  const [harvestDraft, setHarvestDraft] = useState<HarvestDraft>({ harvested_on: "", yield_notes: "" });
  const [taskFormErrors, setTaskFormErrors] = useState<TaskFormErrors>({ title: "", due_on: "" });
  const [plantingFormErrors, setPlantingFormErrors] = useState<PlantingFormErrors>({
    bed_id: "",
    crop_name: "",
    planted_on: "",
  });

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

  function validatePlantingField(field: keyof PlantingFormErrors, value: string) {
    if (field === "bed_id") {
      return value.trim() ? "" : "Choose a bed for this planting.";
    }
    if (field === "crop_name") {
      return value.trim() ? "" : "Choose a vegetable before adding a planting.";
    }
    return value.trim() ? "" : "Planting date is required.";
  }

  function handleTaskFieldBlur(field: keyof TaskFormErrors, value: string) {
    setTaskFormErrors((current) => ({ ...current, [field]: validateTaskField(field, value) }));
  }

  function handlePlantingFieldBlur(field: keyof PlantingFormErrors, value: string) {
    setPlantingFormErrors((current) => ({ ...current, [field]: validatePlantingField(field, value) }));
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

  function handlePlantingSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const nextErrors = {
      bed_id: validatePlantingField("bed_id", String(formData.get("bed_id") || "")),
      crop_name: validatePlantingField("crop_name", selectedCropName),
      planted_on: validatePlantingField("planted_on", String(formData.get("planted_on") || "")),
    };
    setPlantingFormErrors(nextErrors);
    if (nextErrors.bed_id || nextErrors.crop_name || nextErrors.planted_on) {
      event.preventDefault();
      return;
    }
    taskActions.createPlanting(event);
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
    plantingFormErrors,
    setPlantingFormErrors,
    handleTaskFieldBlur,
    handlePlantingFieldBlur,
    handleTaskSubmit,
    handlePlantingSubmit,
    beginTaskEdit,
    saveTaskEdit,
    beginHarvestEdit,
    beginHarvestLog,
    saveHarvestEdit,
  };
}
