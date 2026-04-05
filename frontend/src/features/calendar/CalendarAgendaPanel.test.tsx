import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CalendarAgendaPanel } from "./CalendarAgendaPanel";

vi.mock("./CalendarAgendaEventsList", () => ({
  CalendarAgendaEventsList: ({ selectedDateLabel }: { selectedDateLabel: string }) => <div data-testid="agenda-events">{selectedDateLabel}</div>,
}));

vi.mock("./CalendarTaskForm", () => ({
  CalendarTaskForm: ({ taskQuery }: { taskQuery: string }) => <div data-testid="agenda-task">{taskQuery}</div>,
}));

vi.mock("./CalendarPlantingForm", () => ({
  CalendarPlantingForm: ({ selectedCropName }: { selectedCropName: string }) => <div data-testid="agenda-planting">{selectedCropName}</div>,
}));

describe("CalendarAgendaPanel", () => {
  it("composes agenda event, task, and planting widgets", () => {
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
          createPlanting: vi.fn(),
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
        beds={[]}
        selectedDate="2026-04-04"
        selectedCropName="Tomato"
        filteredCropTemplates={[]}
        cropSearchQuery="tom"
        setCropSearchQuery={vi.fn()}
        handleCropSearchKeyDown={vi.fn()}
        cropSearchActiveIndex={0}
        selectCrop={vi.fn()}
        setPlantingCropCleared={vi.fn()}
        plantingFormErrors={{ bed_id: "", crop_name: "", planted_on: "" }}
        handlePlantingFieldBlur={vi.fn()}
        handlePlantingSubmit={vi.fn()}
        isLoadingPlantingWindows={false}
      />,
    );

    expect(screen.getByTestId("agenda-events")).toHaveTextContent("Apr 4");
    expect(screen.getByTestId("agenda-task")).toHaveTextContent("weed");
    expect(screen.getByTestId("agenda-planting")).toHaveTextContent("Tomato");
  });
});