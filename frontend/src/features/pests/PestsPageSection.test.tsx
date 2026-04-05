import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PestsPageSection } from "./PestsPageSection";

afterEach(() => {
  cleanup();
});

describe("PestsPageSection", () => {
  it("renders pest logs and forwards form and delete actions", async () => {
    const createPestLog = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());
    const deletePestLog = vi.fn(async () => undefined);

    render(
      <PestsPageSection
        selectedDate="2026-04-04"
        pestLogActions={{
          pestLogs: [{ id: 1, garden_id: 1, title: "Aphids", observed_on: "2026-04-03", treatment: "Neem oil" }],
          isLoadingPestLogs: false,
          loadPestLogs: vi.fn(async () => undefined),
          createPestLog: vi.fn(async (event: React.FormEvent<HTMLFormElement>) => {
            createPestLog(event);
          }),
          deletePestLog,
        } as Parameters<typeof PestsPageSection>[0]["pestLogActions"]}
      />,
    );

    fireEvent.submit(screen.getByRole("button", { name: "Log observation" }).closest("form") as HTMLFormElement);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByText(/1 observation/i)).toBeInTheDocument();
    expect(screen.getByText("Neem oil")).toBeInTheDocument();
    expect(createPestLog).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(deletePestLog).toHaveBeenCalledWith(1);
    });
  });

  it("shows loading and empty-state hints", () => {
    const { rerender } = render(
      <PestsPageSection
        selectedDate="2026-04-04"
        pestLogActions={{
          pestLogs: [],
          isLoadingPestLogs: true,
          loadPestLogs: vi.fn(async () => undefined),
          createPestLog: vi.fn(async () => undefined),
          deletePestLog: vi.fn(async () => undefined),
        } as Parameters<typeof PestsPageSection>[0]["pestLogActions"]}
      />,
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    rerender(
      <PestsPageSection
        selectedDate="2026-04-04"
        pestLogActions={{
          pestLogs: [],
          isLoadingPestLogs: false,
          loadPestLogs: vi.fn(async () => undefined),
          createPestLog: vi.fn(async () => undefined),
          deletePestLog: vi.fn(async () => undefined),
        } as Parameters<typeof PestsPageSection>[0]["pestLogActions"]}
      />,
    );

    expect(screen.getByText(/No pest or disease observations yet/i)).toBeInTheDocument();
  });
});