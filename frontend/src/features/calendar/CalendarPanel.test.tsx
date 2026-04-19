import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CalendarProvider, CalendarContextType } from "./CalendarContext";
import { CalendarPanel } from "./CalendarPanel";

vi.mock("./CalendarMonthGrid", () => ({
  CalendarMonthGrid: ({ title }: { title: string }) => <div data-testid="calendar-month-grid">{title}</div>,
}));

vi.mock("./CalendarAgendaPanel", () => ({
  CalendarAgendaPanel: ({ selectedDateLabel }: { selectedDateLabel: string }) => (
    <div data-testid="calendar-agenda-panel">{selectedDateLabel}</div>
  ),
}));

function buildCalendarContextValue(): CalendarContextType {
  return {
    monthCursor: new Date("2026-04-01T00:00:00"),
    setMonthCursor: vi.fn(),
    selectedDate: "2026-04-04",
    setSelectedDate: vi.fn(),
    today: "2026-04-04",
    beds: [],
    weather: null,
    gardenClimate: null,
    taskActions: {
      tasks: [],
      taskQuery: "",
      setTaskQuery: vi.fn(),
      isLoadingTasks: false,
      createTask: vi.fn(),
      toggleTaskDone: vi.fn(),
      deleteTask: vi.fn(),
      editTask: vi.fn(),
      logHarvest: vi.fn(),
    },
    cropFormState: {
      cropSearchQuery: "tom",
      setCropSearchQuery: vi.fn(),
      handleCropSearchKeyDown: vi.fn(),
      filteredCropTemplates: [],
      cropSearchActiveIndex: 0,
      selectCrop: vi.fn(),
    },
    derived: {
      selectedGardenName: "Test Garden",
      monthCells: [new Date("2026-04-01T00:00:00")],
      eventsByDate: new Map(),
      selectedDayEvents: [],
      selectedCrop: undefined,
      selectedCropWindow: undefined,
    },
    selectedCropName: "Tomato",
    isLoadingPlantingWindows: false,
    isLoadingClimate: false,
    isLoadingWeather: false,
    pushNotice: vi.fn(),
  };
}

describe("CalendarPanel", () => {
  it("composes month grid and agenda panel from calendar context", () => {
    render(
      <CalendarProvider value={buildCalendarContextValue()}>
        <CalendarPanel />
      </CalendarProvider>,
    );

    expect(screen.getByTestId("calendar-month-grid")).toHaveTextContent("Season Calendar - Test Garden");
    expect(screen.getByTestId("calendar-agenda-panel")).toHaveTextContent("Saturday, Apr 4");
  });
});