import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WeatherPanel } from "./WeatherPanel";
import { GardenClimate, Task } from "../types";

const climate: GardenClimate = {
  zone: "6a",
  microclimate_band: "warm pocket",
  baseline_last_spring_frost: "2026-05-01",
  adjusted_last_spring_frost: "2026-04-24",
  baseline_first_fall_frost: "2026-10-10",
  adjusted_first_fall_frost: "2026-10-20",
  last_frost_shift_days: -7,
  first_fall_shift_days: 10,
  soil_temperature_estimate_f: 61,
  soil_temperature_status: "warm",
  frost_risk_next_10_days: "low",
  next_frost_date: null,
  growing_season_days: 180,
  factors: [],
  recommendations: [{ key: "signal", title: "Delay sowing", status: "caution", detail: "Cool nights remain." }],
  forecast: [],
};

const tasks: Task[] = [
  { id: 1, garden_id: 1, planting_id: null, title: "Check mulch", due_on: "2026-04-06", is_done: false, notes: "" },
];

describe("WeatherPanel", () => {
  it("renders climate guidance and task queue when climate data exists", () => {
    render(
      <WeatherPanel
        climate={climate}
        weather={null}
        tasks={tasks}
        isLoadingClimate={false}
        isLoadingWeather={false}
        isLoadingTasks={false}
      />,
    );

    expect(screen.getByText(/warm pocket/i)).toBeInTheDocument();
    expect(screen.getByText(/Delay sowing/i)).toBeInTheDocument();
    expect(screen.getByText(/2026-04-06: Check mulch/i)).toBeInTheDocument();
  });

  it("falls back through loading, forecast, and empty states", () => {
    const { rerender } = render(
      <WeatherPanel
        climate={null}
        weather={null}
        tasks={[]}
        isLoadingClimate={false}
        isLoadingWeather={true}
        isLoadingTasks={true}
      />,
    );

    expect(screen.getByText(/Loading weather forecast/i)).toBeInTheDocument();
    expect(screen.getByText(/Loading tasks/i)).toBeInTheDocument();

    rerender(
      <WeatherPanel
        climate={null}
        weather={{
          daily: {
            time: ["2026-04-04"],
            temperature_2m_min: [39],
            temperature_2m_max: [65],
            precipitation_sum: [0.2],
          },
        }}
        tasks={[]}
        isLoadingClimate={false}
        isLoadingWeather={false}
        isLoadingTasks={false}
      />,
    );

    expect(screen.getByText(/2026-04-04: 39F to 65F, rain 0.2 in/i)).toBeInTheDocument();

    rerender(
      <WeatherPanel
        climate={null}
        weather={null}
        tasks={[]}
        isLoadingClimate={false}
        isLoadingWeather={false}
        isLoadingTasks={false}
      />,
    );

    expect(screen.getByText("No weather loaded yet.")).toBeInTheDocument();
  });
});