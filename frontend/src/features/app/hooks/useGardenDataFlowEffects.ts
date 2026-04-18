import { useEffect } from "react";
import { CropTemplateSyncStatus, Garden } from "../../types";

type UseGardenDataFlowEffectsParams = {
  token: string;
  loadGardens: () => Promise<void>;
  loadCropTemplates: () => Promise<void>;
  loadMe: () => Promise<void>;
  loadCropTemplateSyncStatus: (notifyOnCompletion?: boolean) => Promise<void>;
  cropTemplateSyncStatus: CropTemplateSyncStatus | null;
  selectedGarden: number | null;
  loadGardenData: () => Promise<void>;
  selectedGardenRecord: Garden | undefined;
  resetForNoGarden: () => void;
  noticeUnlessExpired: (msg: string) => (err: unknown) => void;
};

export function useGardenDataFlowEffects({
  token,
  loadGardens,
  loadCropTemplates,
  loadMe,
  loadCropTemplateSyncStatus,
  cropTemplateSyncStatus,
  selectedGarden,
  loadGardenData,
  selectedGardenRecord,
  resetForNoGarden,
  noticeUnlessExpired,
}: UseGardenDataFlowEffectsParams) {
  useEffect(() => {
    if (!token) {
      return;
    }

    loadGardens().catch(noticeUnlessExpired("Unable to load your gardens."));
    loadCropTemplates().catch(noticeUnlessExpired("Unable to load crop templates."));
    loadMe().catch(noticeUnlessExpired("Unable to load profile details."));
    loadCropTemplateSyncStatus(false).catch(noticeUnlessExpired("Unable to load crop sync status."));
  }, [token, loadGardens, loadCropTemplates, loadMe, loadCropTemplateSyncStatus, noticeUnlessExpired]);

  useEffect(() => {
    if (!token || !cropTemplateSyncStatus?.is_running) {
      return;
    }

    let intervalId: number | undefined;

    const poll = () => {
      loadCropTemplateSyncStatus().catch(() => undefined);
    };

    const startPolling = () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
        intervalId = undefined;
      }
      if (document.visibilityState === "hidden") {
        return;
      }
      poll();
      intervalId = window.setInterval(poll, 5000);
    };

    startPolling();
    const onVisibility = () => {
      startPolling();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [token, cropTemplateSyncStatus?.is_running, loadCropTemplateSyncStatus]);

  useEffect(() => {
    if (!token || !selectedGarden) {
      return;
    }
    loadGardenData().catch(noticeUnlessExpired("Unable to refresh garden layout data."));
  }, [token, selectedGarden, loadGardenData, noticeUnlessExpired]);

  useEffect(() => {
    if (!token || !selectedGardenRecord) {
      resetForNoGarden();
    }
  }, [token, selectedGardenRecord, resetForNoGarden]);
}
