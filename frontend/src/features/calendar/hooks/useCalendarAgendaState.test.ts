import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FormEvent } from "react";

import { useCalendarAgendaState } from "./useCalendarAgendaState";
import type { CalendarEvent } from "../../types";
import type { TaskActions } from "../CalendarContext";

function makeTaskActions(overrides: Partial<TaskActions> = {}): TaskActions {
  return {
    tasks: [],
    taskQuery: "",
    setTaskQuery: vi.fn(),
    isLoadingTasks: false,
    createTask: vi.fn(),
    toggleTaskDone: vi.fn(),
    deleteTask: vi.fn(),
    editTask: vi.fn(),
    logHarvest: vi.fn(),
    ...overrides,
  };
}

function taskEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "1",
    date: "2026-04-05",
    title: "Water seedlings",
    kind: "task",
    taskId: 1,
    is_done: false,
    notes: "",
    ...overrides,
  };
}

function plantingEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "p1",
    date: "2026-04-05",
    title: "Tomato",
    kind: "planting",
    plantingId: 10,
    harvested_on: null,
    yield_notes: "",
    ...overrides,
  };
}

function makeFormEvent(fields: Record<string, string>): FormEvent<HTMLFormElement> {
  const form = document.createElement("form");
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  return {
    currentTarget: form,
    preventDefault: vi.fn(),
  } as unknown as FormEvent<HTMLFormElement>;
}

describe("useCalendarAgendaState – filteredDayEvents", () => {
  it("returns all events when filter is 'all'", () => {
    const events = [
      taskEvent({ id: "1", taskId: 1, is_done: false }),
      taskEvent({ id: "2", taskId: 2, is_done: true }),
      plantingEvent(),
    ];
    const { result } = renderHook(() =>
      useCalendarAgendaState({ selectedDayEvents: events, selectedCropName: "", taskActions: makeTaskActions() }),
    );
    expect(result.current.filteredDayEvents).toHaveLength(3);
  });

  it("filters to only incomplete tasks when filter is 'todo'", () => {
    const events = [
      taskEvent({ id: "1", taskId: 1, is_done: false }),
      taskEvent({ id: "2", taskId: 2, is_done: true }),
      plantingEvent(),
    ];
    const { result } = renderHook(() =>
      useCalendarAgendaState({ selectedDayEvents: events, selectedCropName: "", taskActions: makeTaskActions() }),
    );
    act(() => result.current.setTaskDoneFilter("todo"));
    // undone task + non-task planting = 2
    expect(result.current.filteredDayEvents).toHaveLength(2);
    expect(result.current.filteredDayEvents.filter((e) => e.kind === "task").every((e) => !e.is_done)).toBe(true);
  });

  it("filters to only completed tasks when filter is 'done'", () => {
    const events = [
      taskEvent({ id: "1", taskId: 1, is_done: false }),
      taskEvent({ id: "2", taskId: 2, is_done: true }),
      plantingEvent(),
    ];
    const { result } = renderHook(() =>
      useCalendarAgendaState({ selectedDayEvents: events, selectedCropName: "", taskActions: makeTaskActions() }),
    );
    act(() => result.current.setTaskDoneFilter("done"));
    // done task + planting = 2
    expect(result.current.filteredDayEvents).toHaveLength(2);
    expect(result.current.filteredDayEvents.filter((e) => e.kind === "task").every((e) => e.is_done)).toBe(true);
  });

  it("non-task events always pass through regardless of filter", () => {
    const events = [plantingEvent({ kind: "planting" })];
    const { result } = renderHook(() =>
      useCalendarAgendaState({ selectedDayEvents: events, selectedCropName: "", taskActions: makeTaskActions() }),
    );
    act(() => result.current.setTaskDoneFilter("todo"));
    expect(result.current.filteredDayEvents).toHaveLength(1);
    act(() => result.current.setTaskDoneFilter("done"));
    expect(result.current.filteredDayEvents).toHaveLength(1);
  });
});

describe("useCalendarAgendaState – hasTasks", () => {
  it("is true when at least one task event exists", () => {
    const { result } = renderHook(() =>
      useCalendarAgendaState({ selectedDayEvents: [taskEvent()], selectedCropName: "", taskActions: makeTaskActions() }),
    );
    expect(result.current.hasTasks).toBe(true);
  });

  it("is false when only planting events exist", () => {
    const { result } = renderHook(() =>
      useCalendarAgendaState({ selectedDayEvents: [plantingEvent()], selectedCropName: "", taskActions: makeTaskActions() }),
    );
    expect(result.current.hasTasks).toBe(false);
  });

  it("is false with empty events list", () => {
    const { result } = renderHook(() =>
      useCalendarAgendaState({ selectedDayEvents: [], selectedCropName: "", taskActions: makeTaskActions() }),
    );
    expect(result.current.hasTasks).toBe(false);
  });
});

describe("useCalendarAgendaState – handleTaskFieldBlur", () => {
  it("sets title error for blank value", () => {
    const { result } = renderHook(() =>
      useCalendarAgendaState({ selectedDayEvents: [], selectedCropName: "", taskActions: makeTaskActions() }),
    );
    act(() => result.current.handleTaskFieldBlur("title", "  "));
    expect(result.current.taskFormErrors.title).toBe("Task title is required.");
  });

  it("clears title error for non-blank value", () => {
    const { result } = renderHook(() =>
      useCalendarAgendaState({ selectedDayEvents: [], selectedCropName: "", taskActions: makeTaskActions() }),
    );
    act(() => result.current.handleTaskFieldBlur("title", "  "));
    act(() => result.current.handleTaskFieldBlur("title", "Water crops"));
    expect(result.current.taskFormErrors.title).toBe("");
  });

  it("sets due_on error for blank value", () => {
    const { result } = renderHook(() =>
      useCalendarAgendaState({ selectedDayEvents: [], selectedCropName: "", taskActions: makeTaskActions() }),
    );
    act(() => result.current.handleTaskFieldBlur("due_on", ""));
    expect(result.current.taskFormErrors.due_on).toBe("Due date is required.");
  });

  it("clears due_on error for non-blank value", () => {
    const { result } = renderHook(() =>
      useCalendarAgendaState({ selectedDayEvents: [], selectedCropName: "", taskActions: makeTaskActions() }),
    );
    act(() => result.current.handleTaskFieldBlur("due_on", ""));
    act(() => result.current.handleTaskFieldBlur("due_on", "2026-04-10"));
    expect(result.current.taskFormErrors.due_on).toBe("");
  });
});

describe("useCalendarAgendaState – handleTaskSubmit", () => {
  it("blocks submission and sets both errors when required fields are blank", () => {
    const createTask = vi.fn();
    const { result } = renderHook(() =>
      useCalendarAgendaState({ selectedDayEvents: [], selectedCropName: "", taskActions: makeTaskActions({ createTask }) }),
    );
    const event = makeFormEvent({ title: "", due_on: "" });
    act(() => result.current.handleTaskSubmit(event));
    expect(createTask).not.toHaveBeenCalled();
    expect(result.current.taskFormErrors.title).toBe("Task title is required.");
    expect(result.current.taskFormErrors.due_on).toBe("Due date is required.");
  });

  it("blocks submission when only title is missing", () => {
    const createTask = vi.fn();
    const { result } = renderHook(() =>
      useCalendarAgendaState({ selectedDayEvents: [], selectedCropName: "", taskActions: makeTaskActions({ createTask }) }),
    );
    const event = makeFormEvent({ title: "", due_on: "2026-04-10" });
    act(() => result.current.handleTaskSubmit(event));
    expect(createTask).not.toHaveBeenCalled();
    expect(result.current.taskFormErrors.title).toBe("Task title is required.");
  });

  it("calls createTask when both required fields are filled", () => {
    const createTask = vi.fn();
    const { result } = renderHook(() =>
      useCalendarAgendaState({ selectedDayEvents: [], selectedCropName: "", taskActions: makeTaskActions({ createTask }) }),
    );
    const event = makeFormEvent({ title: "Water crops", due_on: "2026-04-10" });
    act(() => result.current.handleTaskSubmit(event));
    expect(createTask).toHaveBeenCalledWith(event);
  });
});

describe("useCalendarAgendaState – task edit flow", () => {
  it("populates edit draft from event and calls editTask on save", () => {
    const editTask = vi.fn();
    const { result } = renderHook(() =>
      useCalendarAgendaState({ selectedDayEvents: [], selectedCropName: "", taskActions: makeTaskActions({ editTask }) }),
    );
    const event = taskEvent({ taskId: 5, title: "Weed bed", date: "2026-04-08", notes: "Be thorough" });
    act(() => result.current.beginTaskEdit(event));
    expect(result.current.taskEditId).toBe(5);
    expect(result.current.taskEditDraft.title).toBe("Weed bed");
    expect(result.current.taskEditDraft.due_on).toBe("2026-04-08");
    expect(result.current.taskEditDraft.notes).toBe("Be thorough");

    act(() => result.current.saveTaskEdit(5));
    expect(editTask).toHaveBeenCalledWith(5, { title: "Weed bed", due_on: "2026-04-08", notes: "Be thorough" });
    expect(result.current.taskEditId).toBeNull();
  });

  it("does nothing when event has no taskId", () => {
    const { result } = renderHook(() =>
      useCalendarAgendaState({ selectedDayEvents: [], selectedCropName: "", taskActions: makeTaskActions() }),
    );
    act(() => result.current.beginTaskEdit(taskEvent({ taskId: undefined })));
    expect(result.current.taskEditId).toBeNull();
  });
});

describe("useCalendarAgendaState – harvest flow", () => {
  it("populates harvest draft from planting event and calls logHarvest on save", () => {
    const logHarvest = vi.fn();
    const { result } = renderHook(() =>
      useCalendarAgendaState({ selectedDayEvents: [], selectedCropName: "", taskActions: makeTaskActions({ logHarvest }) }),
    );
    const event = plantingEvent({ plantingId: 10, harvested_on: "2026-05-01", yield_notes: "2.5 lbs" });
    act(() => result.current.beginHarvestEdit(event));
    expect(result.current.harvestEditId).toBe(10);
    expect(result.current.harvestDraft.harvested_on).toBe("2026-05-01");
    expect(result.current.harvestDraft.yield_notes).toBe("2.5 lbs");

    act(() => result.current.saveHarvestEdit(10));
    expect(logHarvest).toHaveBeenCalledWith(10, "2026-05-01", "2.5 lbs");
    expect(result.current.harvestEditId).toBeNull();
  });

  it("does nothing when planting event has no plantingId", () => {
    const { result } = renderHook(() =>
      useCalendarAgendaState({ selectedDayEvents: [], selectedCropName: "", taskActions: makeTaskActions() }),
    );
    act(() => result.current.beginHarvestEdit(plantingEvent({ plantingId: undefined })));
    expect(result.current.harvestEditId).toBeNull();
  });

  it("beginHarvestLog initialises draft with provided date and calls logHarvest on save", () => {
    const logHarvest = vi.fn();
    const { result } = renderHook(() =>
      useCalendarAgendaState({ selectedDayEvents: [], selectedCropName: "", taskActions: makeTaskActions({ logHarvest }) }),
    );
    act(() => result.current.beginHarvestLog(7, "2026-06-15"));
    expect(result.current.harvestEditId).toBe(7);
    expect(result.current.harvestDraft.harvested_on).toBe("2026-06-15");

    act(() => result.current.saveHarvestEdit(7));
    expect(logHarvest).toHaveBeenCalledWith(7, "2026-06-15", "");
    expect(result.current.harvestEditId).toBeNull();
  });
});
