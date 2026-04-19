import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTaskActions } from "./useTaskActions";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useTaskActions", () => {
  it("loads tasks and supports create/edit/toggle/delete", async () => {
    const fetchAuthed = vi
      .fn()
      .mockResolvedValueOnce([{ id: 1, title: "A", is_done: false }])
      .mockResolvedValueOnce({ id: 2, title: "New", is_done: false })
      .mockResolvedValueOnce([{ id: 1, title: "A", is_done: false }, { id: 2, title: "New", is_done: false }])
      .mockResolvedValueOnce({ id: 1, title: "A", is_done: true })
      .mockResolvedValueOnce({ id: 1, title: "Edited", is_done: true })
      .mockResolvedValueOnce(undefined);

    const pushNotice = vi.fn();
    const { result } = renderHook(() =>
      useTaskActions({
        fetchAuthed,
        pushNotice,
        token: "tok",
        selectedGarden: 1,
        setPlantings: vi.fn(),
        invalidateSeasonalPlanCache: vi.fn(),
      }),
    );

    await waitFor(() => {
      expect(fetchAuthed).toHaveBeenCalledWith("/tasks?garden_id=1&q=");
    });

    const form = document.createElement("form");
    const title = document.createElement("input");
    title.name = "title";
    title.value = "New";
    form.appendChild(title);
    const due = document.createElement("input");
    due.name = "due_on";
    due.value = "2026-04-04";
    form.appendChild(due);

    await act(async () => {
      await result.current.createTask({ preventDefault: vi.fn(), currentTarget: form } as unknown as React.FormEvent<HTMLFormElement>);
      await result.current.toggleTaskDone(1, true);
      await result.current.editTask(1, { title: "Edited" });
      await result.current.deleteTask(2);
    });

    expect(pushNotice).toHaveBeenCalledWith("Task added.", "success");
    expect(result.current.tasks.some((task) => task.id === 2)).toBe(false);
  });

  it("logs harvest", async () => {
    const setPlantings = vi.fn();
    const invalidateSeasonalPlanCache = vi.fn();
    const pushNotice = vi.fn();
    const fetchAuthed = vi
      .fn()
      .mockResolvedValueOnce({ id: 10, harvested_on: "2026-04-01" });

    const { result } = renderHook(() =>
      useTaskActions({
        fetchAuthed,
        pushNotice,
        token: "tok",
        selectedGarden: 1,
        setPlantings,
        invalidateSeasonalPlanCache,
      }),
    );

    await act(async () => {
      await result.current.logHarvest(10, "2026-04-01", "great");
    });

    expect(setPlantings).toHaveBeenCalled();
    expect(invalidateSeasonalPlanCache).toHaveBeenCalledWith(1);
    expect(pushNotice).toHaveBeenCalledWith("Harvest logged!", "success");
  });

  it("toggles loading state during explicit task fetch", async () => {
    const pending = deferred<Array<{ id: number; title: string; is_done: boolean }>>();
    const fetchAuthed = vi.fn().mockImplementationOnce(() => pending.promise);

    const pushNotice = vi.fn();
    const { result } = renderHook(() =>
      useTaskActions({
        fetchAuthed,
        pushNotice,
        token: "tok",
        selectedGarden: null,
        setPlantings: vi.fn(),
        invalidateSeasonalPlanCache: vi.fn(),
      }),
    );

    await act(async () => {
      result.current.loadTasks(1, "").catch(() => undefined);
    });
    await waitFor(() => {
      expect(result.current.isLoadingTasks).toBe(true);
    });

    await act(async () => {
      pending.resolve([]);
      await pending.promise;
    });
    await waitFor(() => {
      expect(result.current.isLoadingTasks).toBe(false);
    });
  });

  it("handles create task mutation failures", async () => {
    const fetchAuthed = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("Create failed"));
    const pushNotice = vi.fn();
    const { result } = renderHook(() =>
      useTaskActions({
        fetchAuthed,
        pushNotice,
        token: "tok",
        selectedGarden: 1,
        setPlantings: vi.fn(),
        invalidateSeasonalPlanCache: vi.fn(),
      }),
    );

    const form = document.createElement("form");
    const title = document.createElement("input");
    title.name = "title";
    title.value = "Broken";
    form.appendChild(title);
    const due = document.createElement("input");
    due.name = "due_on";
    due.value = "2026-04-04";
    form.appendChild(due);

    await act(async () => {
      await result.current.createTask({
        preventDefault: vi.fn(),
        currentTarget: form,
      } as unknown as React.FormEvent<HTMLFormElement>);
    });

    expect(pushNotice).toHaveBeenCalledWith("Create failed", "error");
  });
});
