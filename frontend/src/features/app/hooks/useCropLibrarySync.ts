import { useCallback, useRef, useState } from "react";
import { CropTemplateSyncStatus } from "../../types";
import { ConfirmState } from "../types";

type NoticeKind = "info" | "success" | "error";

type UseCropLibrarySyncParams = {
  fetchAuthed: (path: string, opts?: RequestInit) => Promise<unknown>;
  pushNotice: (message: string, kind: NoticeKind) => void;
  setConfirmState: (state: ConfirmState | null) => void;
  loadCropTemplates: (preferredCropName?: string) => Promise<void>;
  selectedCropName: string;
};

export function useCropLibrarySync({
  fetchAuthed,
  pushNotice,
  setConfirmState,
  loadCropTemplates,
  selectedCropName,
}: UseCropLibrarySyncParams) {
  const [cropTemplateSyncStatus, setCropTemplateSyncStatus] = useState<CropTemplateSyncStatus | null>(null);
  const [isRefreshingCropLibrary, setIsRefreshingCropLibrary] = useState(false);
  const [isCleaningLegacyCropLibrary, setIsCleaningLegacyCropLibrary] = useState(false);
  const cropSyncWasRunningRef = useRef(false);

  const loadCropTemplateSyncStatus = useCallback(async (notifyOnCompletion = true) => {
    const status = await fetchAuthed("/crop-templates/sync-status") as CropTemplateSyncStatus;
    const wasRunning = cropSyncWasRunningRef.current;
    cropSyncWasRunningRef.current = status.is_running;
    setCropTemplateSyncStatus(status);

    if (wasRunning && !status.is_running) {
      await loadCropTemplates(undefined);
      if (notifyOnCompletion) {
        if (status.status === "failed") {
          pushNotice(status.error || status.message || "Crop database sync failed.", "error");
        } else {
          pushNotice(status.message || "Crop database sync completed.", "success");
        }
      }
    }
  }, [fetchAuthed, loadCropTemplates, pushNotice]);

  const refreshCropTemplateDatabase = useCallback(async () => {
    try {
      setIsRefreshingCropLibrary(true);
      const result = await fetchAuthed("/crop-templates/refresh", { method: "POST" }) as { message: string };
      await loadCropTemplateSyncStatus(false);
      pushNotice(result.message || "Crop database updated.", "success");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to update crop database.";
      pushNotice(message, "error");
    } finally {
      setIsRefreshingCropLibrary(false);
    }
  }, [fetchAuthed, loadCropTemplateSyncStatus, pushNotice]);

  const requestLegacyCropCleanup = useCallback(() => {
    setConfirmState({
      title: "Remove legacy starter crops?",
      message: "This removes only the old hard-coded starter crop templates and keeps Johnny's imports plus true manual entries.",
      confirmLabel: "Remove legacy crops",
      onConfirm: async () => {
        try {
          setIsCleaningLegacyCropLibrary(true);
          const result = await fetchAuthed("/crop-templates/cleanup-legacy", { method: "POST" }) as { message: string };
          await loadCropTemplates(selectedCropName || undefined);
          await loadCropTemplateSyncStatus(false);
          pushNotice(result.message || "Legacy starter crops removed.", "success");
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Unable to remove legacy starter crops.";
          pushNotice(message, "error");
        } finally {
          setIsCleaningLegacyCropLibrary(false);
        }
      },
    });
  }, [selectedCropName, fetchAuthed, loadCropTemplates, loadCropTemplateSyncStatus, pushNotice, setConfirmState]);

  return {
    cropTemplateSyncStatus,
    isRefreshingCropLibrary,
    isCleaningLegacyCropLibrary,
    loadCropTemplateSyncStatus,
    refreshCropTemplateDatabase,
    requestLegacyCropCleanup,
  };
}
