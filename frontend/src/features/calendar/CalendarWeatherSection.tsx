import { CalendarPanel } from "./CalendarPanel";
import { WeatherPanel } from "../weather/WeatherPanel";
import { useCalendarContext } from "./CalendarContext";

export function CalendarWeatherSection() {
  const {
    gardenClimate,
    weather,
    isLoadingClimate,
    isLoadingWeather,
    taskActions,
  } = useCalendarContext();

  return (
    <div className="calendar-page-layout">
      <div className="calendar-page-layout-main">
        <CalendarPanel />
      </div>
      <aside className="calendar-page-layout-weather" aria-label="Weather outlook">
        <WeatherPanel
          climate={gardenClimate}
          weather={weather}
          tasks={taskActions.tasks}
          isLoadingClimate={isLoadingClimate}
          isLoadingWeather={isLoadingWeather}
          isLoadingTasks={taskActions.isLoadingTasks}
        />
      </aside>
    </div>
  );
}
