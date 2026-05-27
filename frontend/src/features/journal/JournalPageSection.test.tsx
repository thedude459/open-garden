import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JournalPageSection } from "./JournalPageSection";

afterEach(() => {
  cleanup();
});

describe("JournalPageSection", () => {
  it("renders observations and forwards form and delete actions", async () => {
    const createObservation = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());
    const deleteObservation = vi.fn(async () => undefined);

    render(
      <JournalPageSection
        selectedDate="2026-04-04"
        journalActions={{
          observations: [
            {
              id: 1,
              garden_id: 1,
              title: "First bloom",
              observed_on: "2026-04-03",
              notes: "Two trusses forming",
              photo_url: "https://example.com/photo.jpg",
              planting_id: null,
              bed_id: null,
            },
          ],
          isLoadingObservations: false,
          loadObservations: vi.fn(async () => undefined),
          createObservation: vi.fn(async (event: React.FormEvent<HTMLFormElement>) => {
            createObservation(event);
          }),
          deleteObservation,
        } as Parameters<typeof JournalPageSection>[0]["journalActions"]}
      />,
    );

    fireEvent.submit(screen.getByRole("button", { name: "Save entry" }).closest("form") as HTMLFormElement);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByText(/1 entr/i)).toBeInTheDocument();
    expect(screen.getByText("Two trusses forming")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Linked photo" })).toHaveAttribute("href", "https://example.com/photo.jpg");
    expect(createObservation).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(deleteObservation).toHaveBeenCalledWith(1);
    });
  });

  it("shows loading and empty-state hints", () => {
    const { rerender } = render(
      <JournalPageSection
        selectedDate="2026-04-04"
        journalActions={{
          observations: [],
          isLoadingObservations: true,
          loadObservations: vi.fn(async () => undefined),
          createObservation: vi.fn(async () => undefined),
          deleteObservation: vi.fn(async () => undefined),
        } as Parameters<typeof JournalPageSection>[0]["journalActions"]}
      />,
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    rerender(
      <JournalPageSection
        selectedDate="2026-04-04"
        journalActions={{
          observations: [],
          isLoadingObservations: false,
          loadObservations: vi.fn(async () => undefined),
          createObservation: vi.fn(async () => undefined),
          deleteObservation: vi.fn(async () => undefined),
        } as Parameters<typeof JournalPageSection>[0]["journalActions"]}
      />,
    );

    expect(screen.getByText(/No entries yet/i)).toBeInTheDocument();
  });
});
