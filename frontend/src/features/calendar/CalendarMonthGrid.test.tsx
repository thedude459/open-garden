import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CalendarMonthGrid } from "./CalendarMonthGrid";

describe("CalendarMonthGrid", () => {
  it("supports month navigation and day selection user flow", () => {
    const setSelectedDate = vi.fn();
    const setMonthCursor = vi.fn();
    const monthCursor = new Date("2026-04-01T00:00:00");
    const monthCells = [
      new Date("2026-04-01T00:00:00"),
      new Date("2026-04-02T00:00:00"),
    ];

    render(
      <CalendarMonthGrid
        title="Season Calendar - Test"
        monthCursor={monthCursor}
        selectedDate="2026-04-01"
        today="2026-04-01"
        monthCells={monthCells}
        eventsByDate={new Map([["2026-04-02", [{ id: "t", kind: "task", title: "Water", date: "2026-04-02" } as never]]])}
        setSelectedDate={setSelectedDate}
        setMonthCursor={setMonthCursor}
        monthTitle={() => "April 2026"}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    fireEvent.click(screen.getByRole("button", { name: /21 item/i }));

    expect(setMonthCursor).toHaveBeenCalledTimes(2);
    expect(setSelectedDate).toHaveBeenCalledWith("2026-04-02");
  });
});
