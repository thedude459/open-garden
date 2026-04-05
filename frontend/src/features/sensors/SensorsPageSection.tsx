import { Garden, GardenSensorsSummary, SensorKind, Bed } from "../types";
import { SensorsPanel } from "./SensorsPanel";

type GardenSensorActions = {
  registerSensor: (payload: {
    bed_id: number | null;
    name: string;
    sensor_kind: SensorKind;
    unit: string;
    location_label: string;
    hardware_id: string;
  }) => Promise<void>;
  ingestSensorData: (sensorId: number, value: number) => Promise<void>;
};

type SensorsPageSectionProps = {
  selectedGardenName?: string;
  selectedGardenRecord: Garden | undefined;
  beds: Bed[];
  summary: GardenSensorsSummary | null;
  isLoading: boolean;
  loadSensorSummaryForGarden: (garden: Garden, forceRefresh?: boolean) => Promise<void>;
  gardenActions: GardenSensorActions;
  pushNotice: (message: string, kind: "info" | "success" | "error") => void;
};

export function SensorsPageSection({
  selectedGardenName,
  selectedGardenRecord,
  beds,
  summary,
  isLoading,
  loadSensorSummaryForGarden,
  gardenActions,
  pushNotice,
}: SensorsPageSectionProps) {
  return (
    <SensorsPanel
      selectedGardenName={selectedGardenName}
      beds={beds}
      summary={summary}
      isLoading={isLoading}
      onRefresh={() => {
        if (selectedGardenRecord) {
          loadSensorSummaryForGarden(selectedGardenRecord, true).catch(() => undefined);
        }
      }}
      onRegisterSensor={async (payload) => {
        try {
          await gardenActions.registerSensor(payload);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Unable to register sensor.";
          pushNotice(message, "error");
        }
      }}
      onIngestReading={async (sensorId, value) => {
        try {
          await gardenActions.ingestSensorData(sensorId, value);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Unable to ingest sensor reading.";
          pushNotice(message, "error");
        }
      }}
    />
  );
}
