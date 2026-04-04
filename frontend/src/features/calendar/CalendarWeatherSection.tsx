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
    <>
      <CalendarPanel />
      <WeatherPanel
        climate={gardenClimate}
        weather={weather}
        tasks={taskActions.tasks}
        isLoadingClimate={isLoadingClimate}
        isLoadingWeather={isLoadingWeather}
        isLoadingTasks={taskActions.isLoadingTasks}
      />
    </>
  );
}
