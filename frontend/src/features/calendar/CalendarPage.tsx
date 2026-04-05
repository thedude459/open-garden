import { CalendarContextType, CalendarProvider } from "./CalendarContext";
import { CalendarWeatherSection } from "./CalendarWeatherSection";

export function CalendarPage(props: CalendarContextType) {
  return (
    <CalendarProvider value={props}>
      <CalendarWeatherSection />
    </CalendarProvider>
  );
}
