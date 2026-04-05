import { useCallback } from "react";
import { FetchAuthed } from "../types";
import { Garden, SensorKind } from "../../types";

type NoticeKind = "info" | "success" | "error";

interface UseGardenSensorActionsParams {
  fetchAuthed: FetchAuthed;
  pushNotice: (message: string, kind: NoticeKind) => void;
  selectedGardenRecord: Garden | undefined;
  invalidateSensorCaches: (gardenId: number) => void;
  loadSensorSummaryForGarden: (garden: Garden, force?: boolean) => Promise<void>;
}

export function useGardenSensorActions({
  fetchAuthed,
  pushNotice,
  selectedGardenRecord,
  invalidateSensorCaches,
  loadSensorSummaryForGarden,
}: UseGardenSensorActionsParams) {
  const registerSensor = useCallback(
    async (payload: {
      bed_id: number | null;
      name: string;
      sensor_kind: SensorKind;
      unit: string;
      location_label: string;
      hardware_id: string;
    }) => {
      if (!selectedGardenRecord) return;
      await fetchAuthed("/sensors/register", {
        method: "POST",
        body: JSON.stringify({
          garden_id: selectedGardenRecord.id,
          bed_id: payload.bed_id,
          name: payload.name,
          sensor_kind: payload.sensor_kind,
          unit: payload.unit,
          location_label: payload.location_label,
          hardware_id: payload.hardware_id,
        }),
      });
      invalidateSensorCaches(selectedGardenRecord.id);
      await loadSensorSummaryForGarden(selectedGardenRecord, true);
      pushNotice("Sensor registered.", "success");
    },
    [fetchAuthed, selectedGardenRecord, invalidateSensorCaches, loadSensorSummaryForGarden, pushNotice],
  );

  const ingestSensorData = useCallback(
    async (sensorId: number, value: number) => {
      if (!selectedGardenRecord) return;
      await fetchAuthed(`/sensors/${sensorId}/data`, {
        method: "POST",
        body: JSON.stringify({ value }),
      });
      invalidateSensorCaches(selectedGardenRecord.id);
      await loadSensorSummaryForGarden(selectedGardenRecord, true);
      pushNotice("Sensor reading ingested.", "success");
    },
    [fetchAuthed, selectedGardenRecord, invalidateSensorCaches, loadSensorSummaryForGarden, pushNotice],
  );

  return {
    registerSensor,
    ingestSensorData,
  };
}
