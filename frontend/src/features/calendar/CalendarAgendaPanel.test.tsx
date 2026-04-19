import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CalendarAgendaPanel } from "./CalendarAgendaPanel";

vi.mock("./CalendarAgendaEventsList", () => ({
  CalendarAgendaEventsList: ({ selectedDateLabel }: { selectedDateLabel: string }) => <div data-testid="agenda-events">{selectedDateLabel}</div>,
}));

vi.mock("./CalendarTaskForm", () => ({
  CalendarTaskForm: ({ taskQuery }: { taskQuery: string }) => <div data-testid="agenda-task">{taskQuery}</div>,
}));

describe("CalendarAgendaPanel", () => {
  it("composes agenda event and task widgets without a planting form", () => {
    render(
      <CalendarAgendaPanel
        selectedDateLabel="Apr 4"
        selectedDayEvents={[]}
        filteredDayEvents={[]}
        hasTasks={false}
        taskDoneFilter="all"
        setTaskDoneFilter={vi.fn()}
        taskEditId={null}
        taskEditDraft={{ title: "", due_on: "", notes: "" }}
        setTaskEditDraft={vi.fn()}
        setTaskEditId={vi.fn()}
        harvestEditId={null}
        harvestDraft={{ harvested_on: "", yield_notes: "" }}
        setHarvestDraft={vi.fn()}
        setHarvestEditId={vi.fn()}
        taskActions={{
          tasks: [],
          taskQuery: "weed",
          setTaskQuery: vi.fn(),
          isLoadingTasks: false,
          createTask: vi.fn(),
          toggleTaskDone: vi.fn(),
          deleteTask: vi.fn(),
          editTask: vi.fn(),
          logHarvest: vi.fn(),
        }}
        beginTaskEdit={vi.fn()}
        saveTaskEdit={vi.fn()}
        beginHarvestEdit={vi.fn()}
        beginHarvestLog={vi.fn()}
        saveHarvestEdit={vi.fn()}
        today="2026-04-04"
        taskFormErrors={{ title: "", due_on: "" }}
        handleTaskFieldBlur={vi.fn()}
        handleTaskSubmit={vi.fn()}
        selectedDate="2026-04-04"
      />,
    );

    expect(screen.getByTestId("agenda-events")).toHaveTextContent("Apr 4");
    expect(screen.getByTestId("agenda-task")).toHaveTextContent("weed");
    expect(screen.queryByTestId("agenda-planting")).toBeNull();
  });
});
