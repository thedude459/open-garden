import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useJournalActions } from "./useJournalActions";

describe("useJournalActions", () => {
  it("loads observations for journal page and can create/delete entries", async () => {
    const fetchAuthed = vi
      .fn()
      .mockResolvedValueOnce([{ id: 1, title: "First bloom" }])
      .mockResolvedValueOnce({ id: 2 })
      .mockResolvedValueOnce([
        { id: 1, title: "First bloom" },
        { id: 2, title: "Rain check" },
      ])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ id: 2, title: "Rain check" }]);
    const pushNotice = vi.fn();
    const setConfirmState = vi.fn();

    const { result } = renderHook(() =>
      useJournalActions({
        fetchAuthed,
        pushNotice,
        token: "tok",
        selectedGarden: 1,
        activePage: "journal",
        setConfirmState,
      }),
    );

    await waitFor(() => {
      expect(fetchAuthed).toHaveBeenCalledWith("/observations?garden_id=1");
    });

    const form = document.createElement("form");
    for (const [name, value] of [
      ["title", "Rain check"],
      ["observed_on", "2026-04-05"],
      ["notes", "Skipped watering"],
      ["photo_url", ""],
    ]) {
      const input = document.createElement("input");
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }

    await act(async () => {
      await result.current.createObservation({
        preventDefault: vi.fn(),
        currentTarget: form,
      } as unknown as React.FormEvent<HTMLFormElement>);
    });

    expect(pushNotice).toHaveBeenCalledWith("Journal entry saved.", "success");

    await act(async () => {
      await result.current.deleteObservation(2);
    });

    const confirmConfig = setConfirmState.mock.calls[0][0];
    await act(async () => {
      await confirmConfig.onConfirm();
    });

    expect(pushNotice).toHaveBeenCalledWith("Entry deleted.", "info");
  });

  it("reports load and create errors", async () => {
    const fetchAuthed = vi
      .fn()
      .mockRejectedValueOnce(new Error("Load failed"))
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("Save failed"));
    const pushNotice = vi.fn();

    const { result } = renderHook(() =>
      useJournalActions({
        fetchAuthed,
        pushNotice,
        token: "tok",
        selectedGarden: 1,
        activePage: "journal",
        setConfirmState: vi.fn(),
      }),
    );

    await waitFor(() => {
      expect(pushNotice).toHaveBeenCalledWith("Unable to load observation journal.", "error");
    });

    const form = document.createElement("form");
    const title = document.createElement("input");
    title.name = "title";
    title.value = "Draft";
    form.appendChild(title);

    await act(async () => {
      await result.current.createObservation({
        preventDefault: vi.fn(),
        currentTarget: form,
      } as unknown as React.FormEvent<HTMLFormElement>);
    });

    expect(pushNotice).toHaveBeenCalledWith("Save failed", "error");
    expect(result.current.observations).toEqual([]);
  });
});
