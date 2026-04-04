import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CalendarProvider, CalendarContextType } from "./CalendarContext";
import { CalendarWeatherSection } from "./CalendarWeatherSection";

vi.mock("./CalendarPanel", () => ({
  CalendarPanel: () => <div data-testid="calendar-panel" />,
}));

vi.mock("../weather/WeatherPanel", () => ({
  WeatherPanel: ({ tasks }: { tasks: Array<unknown> }) => (
    <div data-testid="weather-panel">tasks:{tasks.length}</div>
  ),
}));

function buildCalendarContextValue(): CalendarContextType {
  return {
    monthCursor: new Date("2026-04-01T00:00:00"),
    setMonthCursor: vi.fn(),
    selectedDate: "2026-04-01",
    setSelectedDate: vi.fn(),
    today: "2026-04-01",
    beds: [],
    weather: null,
    gardenClimate: null,
    taskActions: {
      tasks: [{ id: 1 } as never],
      taskQuery: "",
      setTaskQuery: vi.fn(),
      isLoadingTasks: false,
      createTask: vi.fn(),
      createPlanting: vi.fn(),
      toggleTaskDone: vi.fn(),
      deleteTask: vi.fn(),
      editTask: vi.fn(),
      logHarvest: vi.fn(),
    },
    cropFormState: {
      cropSearchQuery: "",
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
    selectedCropName: "",
    isLoadingPlantingWindows: false,
    isLoadingClimate: false,
    isLoadingWeather: false,
    pushNotice: vi.fn(),
  };
}

describe("CalendarWeatherSection", () => {
  it("renders calendar and weather panels from calendar context", () => {
    render(
      <CalendarProvider value={buildCalendarContextValue()}>
        <CalendarWeatherSection />
      </CalendarProvider>,
    );

    expect(screen.getByTestId("calendar-panel")).toBeInTheDocument();
    expect(screen.getByTestId("weather-panel")).toHaveTextContent("tasks:1");
  });
});
