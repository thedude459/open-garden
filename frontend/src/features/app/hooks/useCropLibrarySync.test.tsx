import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useCropLibrarySync } from "./useCropLibrarySync";

describe("useCropLibrarySync", () => {
  it("loads sync status and notifies when a running sync completes", async () => {
    const fetchAuthed = vi
      .fn()
      .mockResolvedValueOnce({ is_running: true, status: "running", message: "Syncing" })
      .mockResolvedValueOnce({ is_running: false, status: "completed", message: "Done" });
    const pushNotice = vi.fn();
    const setConfirmState = vi.fn();
    const loadCropTemplates = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useCropLibrarySync({
        fetchAuthed,
        pushNotice,
        setConfirmState,
        loadCropTemplates,
        selectedCropName: "Tomato",
      }),
    );

    await act(async () => {
      await result.current.loadCropTemplateSyncStatus();
      await result.current.loadCropTemplateSyncStatus();
    });

    expect(loadCropTemplates).toHaveBeenCalledWith(undefined);
    expect(pushNotice).toHaveBeenCalledWith("Done", "success");
    expect(fetchAuthed).toHaveBeenCalledWith("/crop-templates/sync-status");
  });

  it("refreshes the crop library and handles refresh failures", async () => {
    const setConfirmState = vi.fn();
    const loadCropTemplates = vi.fn(async () => undefined);

    const successFetch = vi
      .fn()
      .mockResolvedValueOnce({ message: "Updated" })
      .mockResolvedValueOnce({ is_running: false, status: "completed", message: "Idle" });
    const successNotice = vi.fn();

    const { result: successResult } = renderHook(() =>
      useCropLibrarySync({
        fetchAuthed: successFetch,
        pushNotice: successNotice,
        setConfirmState,
        loadCropTemplates,
        selectedCropName: "Tomato",
      }),
    );

    await act(async () => {
      await successResult.current.refreshCropTemplateDatabase();
    });

    expect(successFetch).toHaveBeenCalledWith("/crop-templates/refresh", { method: "POST" });
    expect(successNotice).toHaveBeenCalledWith("Updated", "success");
    expect(successResult.current.isRefreshingCropLibrary).toBe(false);

    const failureFetch = vi.fn().mockRejectedValueOnce(new Error("Refresh failed"));
    const failureNotice = vi.fn();

    const { result: failureResult } = renderHook(() =>
      useCropLibrarySync({
        fetchAuthed: failureFetch,
        pushNotice: failureNotice,
        setConfirmState,
        loadCropTemplates,
        selectedCropName: "Tomato",
      }),
    );

    await act(async () => {
      await failureResult.current.refreshCropTemplateDatabase();
    });

    expect(failureNotice).toHaveBeenCalledWith("Refresh failed", "error");
    expect(failureResult.current.isRefreshingCropLibrary).toBe(false);
  });

  it("requests legacy cleanup and executes confirm callback", async () => {
    const capturedState: { current: { onConfirm: () => Promise<void> } | null } = { current: null };
    const setConfirmState = vi.fn((state) => {
      capturedState.current = state;
    });
    const fetchAuthed = vi
      .fn()
      .mockResolvedValueOnce({ message: "Removed" })
      .mockResolvedValueOnce({ is_running: false, status: "completed", message: "Idle" });
    const pushNotice = vi.fn();
    const loadCropTemplates = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useCropLibrarySync({
        fetchAuthed,
        pushNotice,
        setConfirmState,
        loadCropTemplates,
        selectedCropName: "Tomato",
      }),
    );

    act(() => {
      result.current.requestLegacyCropCleanup();
    });

    expect(setConfirmState).toHaveBeenCalled();
    expect(capturedState.current).not.toBeNull();

    await act(async () => {
      await capturedState.current?.onConfirm();
    });

    await waitFor(() => {
      expect(fetchAuthed).toHaveBeenCalledWith("/crop-templates/cleanup-legacy", { method: "POST" });
    });
    expect(loadCropTemplates).toHaveBeenCalledWith("Tomato");
    expect(pushNotice).toHaveBeenCalledWith("Removed", "success");
    expect(result.current.isCleaningLegacyCropLibrary).toBe(false);
  });
});
