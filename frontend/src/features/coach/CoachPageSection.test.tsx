import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CoachPageSection } from "./CoachPageSection";
import { AiCoachResponse, AiCoachScenario, CoachMessage } from "../types";

afterEach(() => {
  cleanup();
});

const scenario: AiCoachScenario = {
  days_ahead: 7,
  rain_outlook: "normal",
  labor_hours: 2,
  water_budget: "normal",
};

const messages: CoachMessage[] = [
  { id: 1, role: "user", content: "What should I do?" },
  { id: 2, role: "coach", content: "Mulch and water lightly." },
];

const response: AiCoachResponse = {
  reply: "Focus on tomatoes.",
  context_highlights: [],
  suggested_actions: [{ title: "Mulch beds", detail: "Preserve moisture before a warm spell.", priority: "high", category: "care" }],
  scenario_outcomes: [{ title: "Dry week", detail: "Increase irrigation checks." }],
};

describe("CoachPageSection", () => {
  it("renders coach content and forwards scenario/chat actions", async () => {
    const askCoach = vi.fn(async () => undefined);
    const setCoachDraftMessage = vi.fn();
    const setCoachScenario = vi.fn();

    render(
      <CoachPageSection
        selectedGardenName="Backyard"
        pushNotice={vi.fn()}
        coachState={{
          coachMessages: messages,
          isLoadingCoach: false,
          coachDraftMessage: "  Check tomatoes  ",
          setCoachDraftMessage,
          coachScenario: scenario,
          setCoachScenario,
          coachLatestResponse: response,
          askCoach,
          resetCoach: vi.fn(),
        } as Parameters<typeof CoachPageSection>[0]["coachState"]}
      />,
    );

    fireEvent.submit(screen.getByRole("button", { name: "Send" }).closest("form") as HTMLFormElement);
    fireEvent.change(screen.getByPlaceholderText("What should I focus on this week?"), { target: { value: "Plan tomorrow" } });
    fireEvent.change(screen.getByLabelText("Planning horizon (days)"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Rain outlook"), { target: { value: "wet" } });
    fireEvent.change(screen.getByLabelText("Available labor hours/day"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Water budget"), { target: { value: "high" } });
    fireEvent.click(screen.getByRole("button", { name: "Run Scenario Plan" }));

    await waitFor(() => {
      expect(askCoach).toHaveBeenNthCalledWith(1, "Check tomatoes", scenario);
      expect(askCoach).toHaveBeenNthCalledWith(2, "Run scenario planning for this garden.", scenario);
    });

    expect(setCoachDraftMessage).toHaveBeenCalledWith("Plan tomorrow");
    expect(setCoachScenario).toHaveBeenCalledWith({ ...scenario, days_ahead: 1 });
    expect(setCoachScenario).toHaveBeenCalledWith({ ...scenario, rain_outlook: "wet" });
    expect(setCoachScenario).toHaveBeenCalledWith({ ...scenario, labor_hours: 0.5 });
    expect(setCoachScenario).toHaveBeenCalledWith({ ...scenario, water_budget: "high" });
    expect(screen.getByText("Mulch beds")).toBeInTheDocument();
    expect(screen.getByText("Dry week")).toBeInTheDocument();
  });

  it("reports coach errors through notices", async () => {
    const pushNotice = vi.fn();

    render(
      <CoachPageSection
        selectedGardenName="Backyard"
        pushNotice={pushNotice}
        coachState={{
          coachMessages: [],
          isLoadingCoach: false,
          coachDraftMessage: "Help",
          setCoachDraftMessage: vi.fn(),
          coachScenario: scenario,
          setCoachScenario: vi.fn(),
          coachLatestResponse: null,
          askCoach: vi.fn(async () => { throw new Error("Coach offline"); }),
          resetCoach: vi.fn(),
        } as Parameters<typeof CoachPageSection>[0]["coachState"]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(pushNotice).toHaveBeenCalledWith("Coach offline", "error");
    });
  });
});