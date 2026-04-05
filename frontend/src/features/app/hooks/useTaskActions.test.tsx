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
        beds: [{ id: 1 }],
        cropTemplates: [{ name: "Tomato" }],
        setPlantings: vi.fn(),
        invalidateSeasonalPlanCache: vi.fn(),
        loadGardenData: vi.fn(async () => undefined),
        setSelectedCropName: vi.fn(),
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

  it("logs harvest and creates planting", async () => {
    const setPlantings = vi.fn();
    const loadGardenData = vi.fn(async () => undefined);
    const invalidateSeasonalPlanCache = vi.fn();
    const setSelectedCropName = vi.fn();
    const pushNotice = vi.fn();
    const fetchAuthed = vi
      .fn()
      .mockResolvedValueOnce({ id: 10, harvested_on: "2026-04-01" })
      .mockResolvedValueOnce({ id: 11 })
      .mockResolvedValueOnce([{ id: 1, title: "Task", is_done: false }]);

    const { result } = renderHook(() =>
      useTaskActions({
        fetchAuthed,
        pushNotice,
        token: "tok",
        selectedGarden: 1,
        beds: [{ id: 2 }],
        cropTemplates: [{ name: "Lettuce" }],
        setPlantings,
        invalidateSeasonalPlanCache,
        loadGardenData,
        setSelectedCropName,
      }),
    );

    await act(async () => {
      await result.current.logHarvest(10, "2026-04-01", "great");
    });

    expect(setPlantings).toHaveBeenCalled();
    expect(invalidateSeasonalPlanCache).toHaveBeenCalledWith(1);

    const form = document.createElement("form");
    const bed = document.createElement("input");
    bed.name = "bed_id";
    bed.value = "2";
    form.appendChild(bed);
    const crop = document.createElement("input");
    crop.name = "crop_name";
    crop.value = "Lettuce";
    form.appendChild(crop);
    const plantedOn = document.createElement("input");
    plantedOn.name = "planted_on";
    plantedOn.value = "2026-04-04";
    form.appendChild(plantedOn);

    await act(async () => {
      await result.current.createPlanting({ preventDefault: vi.fn(), currentTarget: form } as unknown as React.FormEvent<HTMLFormElement>);
    });

    expect(setSelectedCropName).toHaveBeenCalledWith("Lettuce");
    expect(loadGardenData).toHaveBeenCalled();
    expect(pushNotice).toHaveBeenCalledWith("Planting added: Lettuce.", "success");
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
        beds: [{ id: 1 }],
        cropTemplates: [{ name: "Tomato" }],
        setPlantings: vi.fn(),
        invalidateSeasonalPlanCache: vi.fn(),
        loadGardenData: vi.fn(async () => undefined),
        setSelectedCropName: vi.fn(),
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
        beds: [{ id: 1 }],
        cropTemplates: [{ name: "Tomato" }],
        setPlantings: vi.fn(),
        invalidateSeasonalPlanCache: vi.fn(),
        loadGardenData: vi.fn(async () => undefined),
        setSelectedCropName: vi.fn(),
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
