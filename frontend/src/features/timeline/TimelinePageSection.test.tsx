import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TimelinePageSection } from "./TimelinePageSection";
import { Garden, GardenTimeline } from "../types";

afterEach(() => {
  cleanup();
});

const garden: Garden = {
  id: 1,
  name: "Backyard",
  description: "",
  zip_code: "80301",
  growing_zone: "6a",
  yard_width_ft: 20,
  yard_length_ft: 30,
  latitude: 40,
  longitude: -105,
  orientation: "south",
  sun_exposure: "full_sun",
  wind_exposure: "moderate",
  thermal_mass: "moderate",
  slope_position: "mid",
  frost_pocket_risk: "low",
  address_private: "",
  is_shared: false,
  edge_buffer_in: 6,
};

const timeline: GardenTimeline = {
  generated_at: "2026-04-04T10:00:00Z",
  counts_by_category: {
    task: 1,
    weather: 0,
    planting_window: 2,
    sensor_alert: 0,
    ai_recommendation: 0,
  },
  events: [
    {
      event_date: "2026-04-04",
      title: "Irrigate bed A",
      detail: "Check soil moisture and irrigate if needed.",
      category: "task",
      source: "tasks",
      severity: "medium",
      drilldown: { task_id: 12 },
    },
    {
      event_date: "2026-04-05",
      title: "Tomato transplant window",
      detail: "A good transplant window opens.",
      category: "planting_window",
      source: "planner",
      severity: "low",
      drilldown: { crop_name: "Tomato (Roma)", variety: "Roma", method: "transplant", indoor_seed_start: "2026-03-01", indoor_seed_end: "2026-03-15", outdoor_window_start: "2026-04-05", outdoor_window_end: "2026-04-20" },
    },
    {
      event_date: "2026-04-05",
      title: "Tomato transplant window",
      detail: "A second variety is also ready.",
      category: "planting_window",
      source: "planner",
      severity: "low",
      drilldown: { crop_name: "Tomato (Cherry)", variety: "Cherry", method: "transplant", indoor_seed_start: "2026-03-01", indoor_seed_end: "2026-03-15", outdoor_window_start: "2026-04-05", outdoor_window_end: "2026-04-20" },
    },
  ],
};

describe("TimelinePageSection", () => {
  it("renders timeline events, grouped planting windows, and refresh handling", async () => {
    const loadTimelineForGarden = vi.fn(async () => undefined);

    render(
      <TimelinePageSection
        selectedGardenRecord={garden}
        selectedGardenName="Backyard"
        timeline={timeline}
        isLoading={false}
        loadTimelineForGarden={loadTimelineForGarden}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    fireEvent.click(screen.getByRole("button", { name: /Planting window: Tomato/i }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: /Irrigate bed A/i }));
    fireEvent.click(screen.getByLabelText(/Weather/i));
    fireEvent.click(screen.getByLabelText(/Tasks/i));
    fireEvent.click(screen.getByLabelText(/Planting Windows/i));

    await waitFor(() => {
      expect(loadTimelineForGarden).toHaveBeenCalledWith(garden, true);
    });

    expect(screen.getByText(/task_id/i)).toBeInTheDocument();
    expect(screen.getByText(/No timeline events match the selected filters/i)).toBeInTheDocument();
  });

  it("shows loading and empty-state hints when there is no timeline data", () => {
    const { rerender } = render(
      <TimelinePageSection
        selectedGardenRecord={undefined}
        selectedGardenName="Backyard"
        timeline={null}
        isLoading={true}
        loadTimelineForGarden={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByText(/Loading timeline/i)).toBeInTheDocument();

    rerender(
      <TimelinePageSection
        selectedGardenRecord={undefined}
        selectedGardenName="Backyard"
        timeline={null}
        isLoading={false}
        loadTimelineForGarden={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByText(/No timeline events match the selected filters/i)).toBeInTheDocument();
  });
});