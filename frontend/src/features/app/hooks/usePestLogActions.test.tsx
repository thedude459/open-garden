import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePestLogActions } from "./usePestLogActions";

describe("usePestLogActions", () => {
  it("loads logs for pest page and can create/delete entries", async () => {
    const fetchAuthed = vi
      .fn()
      .mockResolvedValueOnce([{ id: 1, title: "Aphids" }])
      .mockResolvedValueOnce({ id: 2 })
      .mockResolvedValueOnce([{ id: 1, title: "Aphids" }, { id: 2, title: "Mildew" }])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ id: 2, title: "Mildew" }]);
    const pushNotice = vi.fn();
    const setConfirmState = vi.fn();

    const { result } = renderHook(() =>
      usePestLogActions({
        fetchAuthed,
        pushNotice,
        token: "tok",
        selectedGarden: 1,
        activePage: "pests",
        setConfirmState,
      }),
    );

    await waitFor(() => {
      expect(fetchAuthed).toHaveBeenCalledWith("/pest-logs?garden_id=1");
    });

    const form = document.createElement("form");
    const title = document.createElement("input");
    title.name = "title";
    title.value = "Mildew";
    form.appendChild(title);

    await act(async () => {
      await result.current.createPestLog({ preventDefault: vi.fn(), currentTarget: form } as unknown as React.FormEvent<HTMLFormElement>);
    });

    expect(pushNotice).toHaveBeenCalledWith("Observation logged.", "success");

    await act(async () => {
      await result.current.deletePestLog(2);
    });

    const confirmConfig = setConfirmState.mock.calls[0][0];
    await act(async () => {
      await confirmConfig.onConfirm();
    });

    expect(pushNotice).toHaveBeenCalledWith("Observation deleted.", "info");
  });

  it("reports create errors", async () => {
    const fetchAuthed = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("Create pest failed"));
    const pushNotice = vi.fn();

    const { result } = renderHook(() =>
      usePestLogActions({
        fetchAuthed,
        pushNotice,
        token: "tok",
        selectedGarden: 1,
        activePage: "pests",
        setConfirmState: vi.fn(),
      }),
    );

    const form = document.createElement("form");
    const title = document.createElement("input");
    title.name = "title";
    title.value = "Rust";
    form.appendChild(title);

    await act(async () => {
      await result.current.createPestLog({
        preventDefault: vi.fn(),
        currentTarget: form,
      } as unknown as React.FormEvent<HTMLFormElement>);
    });

    expect(pushNotice).toHaveBeenCalledWith("Create pest failed", "error");
  });
});
