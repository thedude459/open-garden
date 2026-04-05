import { Dispatch, SetStateAction } from "react";
import { weekdayLabels } from "../app/constants";
import { CalendarEvent } from "../types";
import { isoDate } from "./utils/calendarDateUtils";

type CalendarMonthGridProps = {
  title: string;
  monthCursor: Date;
  selectedDate: string;
  today: string;
  monthCells: Date[];
  eventsByDate: Map<string, CalendarEvent[]>;
  setSelectedDate: (value: string) => void;
  setMonthCursor: Dispatch<SetStateAction<Date>>;
  monthTitle: (value: Date) => string;
};

export function CalendarMonthGrid({
  title,
  monthCursor,
  selectedDate,
  today,
  monthCells,
  eventsByDate,
  setSelectedDate,
  setMonthCursor,
  monthTitle,
}: CalendarMonthGridProps) {
  return (
    <>
      <div className="calendar-head">
        <h2>{title}</h2>
        <div className="month-nav">
          <button onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>Previous</button>
          <strong>{monthTitle(monthCursor)}</strong>
          <button onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>Next</button>
        </div>
      </div>

      <div className="month-grid" role="grid" aria-label="Month view">
        {weekdayLabels.map((label) => (
          <div key={label} className="weekday">
            {label}
          </div>
        ))}
        {monthCells.map((day) => {
          const dayIso = isoDate(day);
          const dayEvents = eventsByDate.get(dayIso) || [];
          const outsideMonth = day.getMonth() !== monthCursor.getMonth();

          return (
            <button
              key={dayIso}
              className={`day-cell${outsideMonth ? " muted" : ""}${dayIso === selectedDate ? " selected" : ""}${dayIso === today ? " today" : ""}`}
              onClick={() => setSelectedDate(dayIso)}
            >
              <span>{day.getDate()}</span>
              <small>{dayEvents.length > 0 ? `${dayEvents.length} item${dayEvents.length === 1 ? "" : "s"}` : ""}</small>
            </button>
          );
        })}
      </div>
    </>
  );
}
