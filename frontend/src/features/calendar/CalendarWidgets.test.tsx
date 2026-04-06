import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CalendarAgendaEventsList } from "./CalendarAgendaEventsList";
import { CalendarPlantingForm } from "./CalendarPlantingForm";
import { CalendarTaskForm } from "./CalendarTaskForm";
import { Bed, CalendarEvent, CropTemplate } from "../types";
import { TaskActions } from "./CalendarContext";

afterEach(() => {
  cleanup();
});

const bed: Bed = { id: 1, garden_id: 1, name: "Bed A", width_in: 48, height_in: 96, grid_x: 0, grid_y: 0 };
const crop: CropTemplate = {
  id: 1,
  name: "Tomato",
  variety: "Roma",
  source: "manual",
  source_url: "",
  image_url: "",
  external_product_id: "",
  family: "Solanaceae",
  spacing_in: 18,
  row_spacing_in: 60,
  in_row_spacing_in: 24,
  days_to_harvest: 70,
  planting_window: "Spring",
  direct_sow: false,
  frost_hardy: false,
  weeks_to_transplant: 6,
  notes: "Stake early",
};

const taskActions: TaskActions = {
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
};

describe("CalendarTaskForm", () => {
  it("forwards task filter and submit interactions", () => {
    const setTaskQuery = vi.fn();
    const handleTaskFieldBlur = vi.fn();
    const handleTaskSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());

    render(
      <CalendarTaskForm
        taskQuery="weed"
        setTaskQuery={setTaskQuery}
        isLoadingTasks={true}
        selectedDate="2026-04-04"
        taskFormErrors={{ title: "Title required", due_on: "Date required" }}
        handleTaskFieldBlur={handleTaskFieldBlur}
        handleTaskSubmit={handleTaskSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("Filter Tasks"), { target: { value: "water" } });
    fireEvent.blur(screen.getByLabelText("Task Title"), { target: { value: "Mulch" } });
    fireEvent.blur(screen.getByLabelText("Due Date"), { target: { value: "2026-04-05" } });
    fireEvent.submit(screen.getByRole("button", { name: "Add task" }).closest("form") as HTMLFormElement);

    expect(screen.getByText(/Refreshing task list/i)).toBeInTheDocument();
    expect(setTaskQuery).toHaveBeenCalledWith("water");
    expect(handleTaskFieldBlur).toHaveBeenCalledWith("title", "Mulch");
    expect(handleTaskFieldBlur).toHaveBeenCalledWith("due_on", "2026-04-05");
    expect(handleTaskSubmit).toHaveBeenCalledTimes(1);
  });
});

describe("CalendarPlantingForm", () => {
  it("supports crop selection, field blur, and planting submission", () => {
    const setCropSearchQuery = vi.fn();
    const handleCropSearchKeyDown = vi.fn();
    const selectCrop = vi.fn();
    const setPlantingCropCleared = vi.fn();
    const handlePlantingFieldBlur = vi.fn();
    const handlePlantingSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());

    render(
      <CalendarPlantingForm
        beds={[bed]}
        selectedDate="2026-04-04"
        selectedCropName="Tomato"
        filteredCropTemplates={[crop]}
        cropSearchQuery="tom"
        setCropSearchQuery={setCropSearchQuery}
        handleCropSearchKeyDown={handleCropSearchKeyDown}
        cropSearchActiveIndex={0}
        selectCrop={selectCrop}
        setPlantingCropCleared={setPlantingCropCleared}
        plantingFormErrors={{ bed_id: "", crop_name: "", planted_on: "" }}
        handlePlantingFieldBlur={handlePlantingFieldBlur}
        handlePlantingSubmit={handlePlantingSubmit}
        selectedCrop={crop}
        selectedCropWindow={{ window_start: "2026-04-05", window_end: "2026-04-20", status: "open", reason: "Warm enough", indoor_seed_start: "2026-03-01", indoor_seed_end: "2026-03-15" }}
        isLoadingPlantingWindows={false}
      />,
    );

    fireEvent.change(screen.getByLabelText("Search Vegetable"), { target: { value: "roma" } });
    fireEvent.keyDown(screen.getByLabelText("Search Vegetable"), { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: /Tomato/i }));
    fireEvent.blur(screen.getByLabelText("Search Vegetable"));
    fireEvent.blur(screen.getByLabelText("Planting Date"), { target: { value: "2026-04-06" } });
    fireEvent.submit(screen.getByRole("button", { name: "Add planting" }).closest("form") as HTMLFormElement);

    expect(screen.getByText(/Dynamic window/i)).toBeInTheDocument();
    expect(setCropSearchQuery).toHaveBeenCalledWith("roma");
    expect(handleCropSearchKeyDown).toHaveBeenCalledTimes(1);
    expect(selectCrop).toHaveBeenCalledWith(crop);
    expect(setPlantingCropCleared).toHaveBeenCalledTimes(1);
    expect(handlePlantingFieldBlur).toHaveBeenCalledWith("crop_name", "Tomato");
    expect(handlePlantingFieldBlur).toHaveBeenCalledWith("planted_on", "2026-04-06");
    expect(handlePlantingSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows empty crop-search results and disables submission without a selected crop", () => {
    render(
      <CalendarPlantingForm
        beds={[bed]}
        selectedDate="2026-04-04"
        selectedCropName=""
        filteredCropTemplates={[]}
        cropSearchQuery="xyz"
        setCropSearchQuery={vi.fn()}
        handleCropSearchKeyDown={vi.fn()}
        cropSearchActiveIndex={0}
        selectCrop={vi.fn()}
        setPlantingCropCleared={vi.fn()}
        plantingFormErrors={{ bed_id: "Pick a bed", crop_name: "Pick a crop", planted_on: "Pick a date" }}
        handlePlantingFieldBlur={vi.fn()}
        handlePlantingSubmit={vi.fn()}
        isLoadingPlantingWindows={true}
      />,
    );

    expect(screen.getByText(/No vegetables match that search/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add planting" })).toBeDisabled();
  });
});

describe("CalendarAgendaEventsList", () => {
  it("handles task and harvest display actions", () => {
    const beginTaskEdit = vi.fn();
    const beginHarvestEdit = vi.fn();
    const beginHarvestLog = vi.fn();
    const setTaskDoneFilter = vi.fn();

    const events: CalendarEvent[] = [
      { id: "task-1", date: "2026-04-04", title: "Water beds", kind: "task", taskId: 11, is_done: false },
      { id: "harvest-1", date: "2026-04-04", title: "Harvest lettuce", kind: "harvest", plantingId: 21 },
    ];

    render(
      <CalendarAgendaEventsList
        selectedDateLabel="Apr 4"
        hasTasks
        taskDoneFilter="all"
        setTaskDoneFilter={setTaskDoneFilter}
        selectedDayEvents={events}
        filteredDayEvents={events}
        taskEditId={null}
        taskEditDraft={{ title: "", due_on: "", notes: "" }}
        setTaskEditDraft={vi.fn()}
        setTaskEditId={vi.fn()}
        harvestEditId={null}
        harvestDraft={{ harvested_on: "", yield_notes: "" }}
        setHarvestDraft={vi.fn()}
        setHarvestEditId={vi.fn()}
        taskActions={taskActions}
        beginTaskEdit={beginTaskEdit}
        saveTaskEdit={vi.fn()}
        beginHarvestEdit={beginHarvestEdit}
        beginHarvestLog={beginHarvestLog}
        saveHarvestEdit={vi.fn()}
        today="2026-04-04"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByLabelText(/Mark "Water beds" as complete/i));
    fireEvent.click(screen.getByLabelText("Edit task"));
    fireEvent.click(screen.getByLabelText("Delete task"));
    fireEvent.click(screen.getByRole("button", { name: "Log harvest" }));

    expect(setTaskDoneFilter).toHaveBeenCalledWith("done");
    expect(taskActions.toggleTaskDone).toHaveBeenCalledWith(11, true);
    expect(beginTaskEdit).toHaveBeenCalledWith(events[0]);
    expect(taskActions.deleteTask).toHaveBeenCalledWith(11);
    expect(beginHarvestLog).toHaveBeenCalledWith(21, "2026-04-04");
  });

  it("supports edit forms and empty filtered states", () => {
    const setTaskEditId = vi.fn();
    const setHarvestEditId = vi.fn();
    const saveTaskEdit = vi.fn();
    const saveHarvestEdit = vi.fn();

    const editedTask: CalendarEvent = { id: "task-1", date: "2026-04-04", title: "Water beds", kind: "task", taskId: 11, is_done: true };
    const editedHarvest: CalendarEvent = { id: "harvest-1", date: "2026-04-04", title: "Harvest lettuce", kind: "harvest", plantingId: 21, harvested_on: "2026-04-04", yield_notes: "2 heads" };

    const { rerender } = render(
      <CalendarAgendaEventsList
        selectedDateLabel="Apr 4"
        hasTasks
        taskDoneFilter="todo"
        setTaskDoneFilter={vi.fn()}
        selectedDayEvents={[editedTask, editedHarvest]}
        filteredDayEvents={[]}
        taskEditId={11}
        taskEditDraft={{ title: "Water beds", due_on: "2026-04-05", notes: "At dusk" }}
        setTaskEditDraft={vi.fn()}
        setTaskEditId={setTaskEditId}
        harvestEditId={21}
        harvestDraft={{ harvested_on: "2026-04-04", yield_notes: "2 heads" }}
        setHarvestDraft={vi.fn()}
        setHarvestEditId={setHarvestEditId}
        taskActions={taskActions}
        beginTaskEdit={vi.fn()}
        saveTaskEdit={saveTaskEdit}
        beginHarvestEdit={vi.fn()}
        beginHarvestLog={vi.fn()}
        saveHarvestEdit={saveHarvestEdit}
        today="2026-04-04"
      />,
    );

    expect(screen.getByText(/No pending tasks today/i)).toBeInTheDocument();

    rerender(
      <CalendarAgendaEventsList
        selectedDateLabel="Apr 4"
        hasTasks
        taskDoneFilter="all"
        setTaskDoneFilter={vi.fn()}
        selectedDayEvents={[editedTask, editedHarvest]}
        filteredDayEvents={[editedTask, editedHarvest]}
        taskEditId={11}
        taskEditDraft={{ title: "Water beds", due_on: "2026-04-05", notes: "At dusk" }}
        setTaskEditDraft={vi.fn()}
        setTaskEditId={setTaskEditId}
        harvestEditId={21}
        harvestDraft={{ harvested_on: "2026-04-04", yield_notes: "2 heads" }}
        setHarvestDraft={vi.fn()}
        setHarvestEditId={setHarvestEditId}
        taskActions={taskActions}
        beginTaskEdit={vi.fn()}
        saveTaskEdit={saveTaskEdit}
        beginHarvestEdit={vi.fn()}
        beginHarvestLog={vi.fn()}
        saveHarvestEdit={saveHarvestEdit}
        today="2026-04-04"
      />,
    );

    const saveButtons = screen.getAllByRole("button", { name: "Save" });
    fireEvent.click(saveButtons[0]);
    fireEvent.click(saveButtons[1]);
    fireEvent.click(screen.getAllByRole("button", { name: "Cancel" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Cancel" })[1]);

    expect(saveTaskEdit).toHaveBeenCalledWith(11);
    expect(saveHarvestEdit).toHaveBeenCalledWith(21);
    expect(setTaskEditId).toHaveBeenCalledWith(null);
    expect(setHarvestEditId).toHaveBeenCalledWith(null);
  });
});