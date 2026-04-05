import { useEffect } from "react";
import { Garden } from "../../types";
import { CropTemplateSyncStatus } from "../../types";

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
  loadClimateForGarden: (garden: Garden) => Promise<void>;
  loadPlantingWindowsForGarden: (garden: Garden) => Promise<void>;
  loadSunPathForGarden: (garden: Garden) => Promise<void>;
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
  loadClimateForGarden,
  loadPlantingWindowsForGarden,
  loadSunPathForGarden,
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

    const intervalId = window.setInterval(() => {
      loadCropTemplateSyncStatus().catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(intervalId);
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
      return;
    }

    loadClimateForGarden(selectedGardenRecord).catch(noticeUnlessExpired("Unable to load climate guidance."));
    loadPlantingWindowsForGarden(selectedGardenRecord).catch(noticeUnlessExpired("Unable to load dynamic planting windows."));
    loadSunPathForGarden(selectedGardenRecord).catch(noticeUnlessExpired("Unable to load sun-path layout guidance."));
  }, [
    token,
    selectedGardenRecord,
    resetForNoGarden,
    loadClimateForGarden,
    loadPlantingWindowsForGarden,
    loadSunPathForGarden,
    noticeUnlessExpired,
  ]);
}
