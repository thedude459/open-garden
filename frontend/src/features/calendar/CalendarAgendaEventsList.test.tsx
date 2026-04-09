import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CalendarAgendaEventsList } from "./CalendarAgendaEventsList";
import type { CalendarEvent } from "../types";

const taskEvent: CalendarEvent = {
  id: "task-1",
  title: "Water tomatoes",
  date: "2025-06-01",
  kind: "task",
  taskId: 1,
  is_done: false,
};

const harvestEvent: CalendarEvent = {
  id: "harvest-10",
  title: "Harvest Tomato",
  date: "2025-06-01",
  kind: "harvest",
  plantingId: 10,
  is_done: false,
  harvested_on: "",
  yield_notes: "",
};

const harvestLoggedEvent: CalendarEvent = {
  id: "harvest-11",
  title: "Harvest Lettuce",
  date: "2025-06-01",
  kind: "harvest",
  plantingId: 11,
  is_done: true,
  harvested_on: "2025-06-01",
  yield_notes: "Half a bucket",
};

const plantingEvent: CalendarEvent = {
  id: "planting-5",
  title: "Plant Carrot",
  date: "2025-06-01",
  kind: "planting",
  is_done: false,
};

function defaultProps(overrides: Partial<Parameters<typeof CalendarAgendaEventsList>[0]> = {}) {
  return {
    selectedDateLabel: "Sunday, Jun 1",
    hasTasks: false,
    taskDoneFilter: "all" as const,
    setTaskDoneFilter: vi.fn(),
    selectedDayEvents: [],
    filteredDayEvents: [],
    taskEditId: null,
    taskEditDraft: { title: "", due_on: "", notes: "" },
    setTaskEditDraft: vi.fn(),
    setTaskEditId: vi.fn(),
    harvestEditId: null,
    harvestDraft: { harvested_on: "", yield_notes: "" },
    setHarvestDraft: vi.fn(),
    setHarvestEditId: vi.fn(),
    taskActions: {
      toggleTaskDone: vi.fn(),
      deleteTask: vi.fn(),
    } as unknown as Parameters<typeof CalendarAgendaEventsList>[0]["taskActions"],
    beginTaskEdit: vi.fn(),
    saveTaskEdit: vi.fn(),
    beginHarvestEdit: vi.fn(),
    beginHarvestLog: vi.fn(),
    saveHarvestEdit: vi.fn(),
    today: "2025-06-01",
    ...overrides,
  };
}

describe("CalendarAgendaEventsList", () => {
  it("shows the selected date label", () => {
    render(<CalendarAgendaEventsList {...defaultProps()} />);
    expect(screen.getByRole("heading", { name: "Sunday, Jun 1" })).toBeInTheDocument();
  });

  it("shows no-events message when list is empty", () => {
    render(<CalendarAgendaEventsList {...defaultProps()} />);
    expect(screen.getByText("No events scheduled.")).toBeInTheDocument();
  });

  it("shows task filter row when hasTasks is true", () => {
    render(<CalendarAgendaEventsList {...defaultProps({ hasTasks: true })} />);
    expect(screen.getByRole("group", { name: /filter tasks/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "To-do" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("calls setTaskDoneFilter when a filter button is clicked", () => {
    const setTaskDoneFilter = vi.fn();
    render(
      <CalendarAgendaEventsList
        {...defaultProps({ hasTasks: true, setTaskDoneFilter })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "To-do" }));
    expect(setTaskDoneFilter).toHaveBeenCalledWith("todo");
  });

  it("renders a task event with checkbox and action buttons", () => {
    render(
      <CalendarAgendaEventsList
        {...defaultProps({
          selectedDayEvents: [taskEvent],
          filteredDayEvents: [taskEvent],
        })}
      />,
    );
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
    expect(screen.getByLabelText(/edit task/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/delete task/i)).toBeInTheDocument();
  });

  it("calls toggleTaskDone when checkbox is toggled", () => {
    const toggleTaskDone = vi.fn();
    render(
      <CalendarAgendaEventsList
        {...defaultProps({
          selectedDayEvents: [taskEvent],
          filteredDayEvents: [taskEvent],
          taskActions: { toggleTaskDone, deleteTask: vi.fn() } as unknown as Parameters<typeof CalendarAgendaEventsList>[0]["taskActions"],
        })}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox"));
    expect(toggleTaskDone).toHaveBeenCalledWith(1, true);
  });

  it("calls deleteTask when delete button is clicked", () => {
    const deleteTask = vi.fn();
    render(
      <CalendarAgendaEventsList
        {...defaultProps({
          selectedDayEvents: [taskEvent],
          filteredDayEvents: [taskEvent],
          taskActions: { toggleTaskDone: vi.fn(), deleteTask } as unknown as Parameters<typeof CalendarAgendaEventsList>[0]["taskActions"],
        })}
      />,
    );
    fireEvent.click(screen.getByLabelText(/delete task/i));
    expect(deleteTask).toHaveBeenCalledWith(1);
  });

  it("calls beginTaskEdit when edit button is clicked", () => {
    const beginTaskEdit = vi.fn();
    render(
      <CalendarAgendaEventsList
        {...defaultProps({
          selectedDayEvents: [taskEvent],
          filteredDayEvents: [taskEvent],
          beginTaskEdit,
        })}
      />,
    );
    fireEvent.click(screen.getByLabelText(/edit task/i));
    expect(beginTaskEdit).toHaveBeenCalledWith(taskEvent);
  });

  it("renders task edit form when taskEditId matches", () => {
    const saveTaskEdit = vi.fn();
    render(
      <CalendarAgendaEventsList
        {...defaultProps({
          selectedDayEvents: [taskEvent],
          filteredDayEvents: [taskEvent],
          taskEditId: 1,
          taskEditDraft: { title: "Water tomatoes", due_on: "2025-06-01", notes: "" },
          saveTaskEdit,
        })}
      />,
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("saves task edit on form submit", () => {
    const saveTaskEdit = vi.fn();
    render(
      <CalendarAgendaEventsList
        {...defaultProps({
          selectedDayEvents: [taskEvent],
          filteredDayEvents: [taskEvent],
          taskEditId: 1,
          taskEditDraft: { title: "Water tomatoes", due_on: "2025-06-01", notes: "" },
          saveTaskEdit,
        })}
      />,
    );
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);
    expect(saveTaskEdit).toHaveBeenCalledWith(1);
  });

  it("renders harvest event with Log harvest button when not yet harvested", () => {
    render(
      <CalendarAgendaEventsList
        {...defaultProps({
          selectedDayEvents: [harvestEvent],
          filteredDayEvents: [harvestEvent],
        })}
      />,
    );
    expect(screen.getByRole("button", { name: /log harvest/i })).toBeInTheDocument();
  });

  it("calls beginHarvestLog when Log harvest is clicked", () => {
    const beginHarvestLog = vi.fn();
    render(
      <CalendarAgendaEventsList
        {...defaultProps({
          selectedDayEvents: [harvestEvent],
          filteredDayEvents: [harvestEvent],
          beginHarvestLog,
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /log harvest/i }));
    expect(beginHarvestLog).toHaveBeenCalledWith(10, "2025-06-01");
  });

  it("renders already-logged harvest with edit button and yield notes", () => {
    render(
      <CalendarAgendaEventsList
        {...defaultProps({
          selectedDayEvents: [harvestLoggedEvent],
          filteredDayEvents: [harvestLoggedEvent],
        })}
      />,
    );
    expect(screen.getByText("Half a bucket")).toBeInTheDocument();
    expect(screen.getByLabelText(/edit harvest/i)).toBeInTheDocument();
  });

  it("renders harvest edit form when harvestEditId matches", () => {
    const saveHarvestEdit = vi.fn();
    render(
      <CalendarAgendaEventsList
        {...defaultProps({
          selectedDayEvents: [harvestLoggedEvent],
          filteredDayEvents: [harvestLoggedEvent],
          harvestEditId: 11,
          harvestDraft: { harvested_on: "2025-06-01", yield_notes: "Half a bucket" },
          saveHarvestEdit,
        })}
      />,
    );
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);
    expect(saveHarvestEdit).toHaveBeenCalledWith(11);
  });

  it("renders generic planting event title", () => {
    render(
      <CalendarAgendaEventsList
        {...defaultProps({
          selectedDayEvents: [plantingEvent],
          filteredDayEvents: [plantingEvent],
        })}
      />,
    );
    expect(screen.getByText("Plant Carrot")).toBeInTheDocument();
  });

  it("shows no-done-tasks message when filtering with no matches", () => {
    render(
      <CalendarAgendaEventsList
        {...defaultProps({
          selectedDayEvents: [taskEvent],
          filteredDayEvents: [],
          taskDoneFilter: "done",
        })}
      />,
    );
    expect(screen.getByText(/no completed tasks today/i)).toBeInTheDocument();
  });
});
