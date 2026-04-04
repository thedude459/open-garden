import { Garden } from "../types";
import { SensorsPanel } from "./SensorsPanel";

type SensorsPageSectionProps = {
  selectedGardenName?: string;
  selectedGardenRecord: Garden | undefined;
  beds: any[];
  summary: any;
  isLoading: boolean;
  loadSensorSummaryForGarden: (garden: Garden, forceRefresh?: boolean) => Promise<void>;
  gardenActions: any;
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
        } catch (err: any) {
          pushNotice(err?.message || "Unable to register sensor.", "error");
        }
      }}
      onIngestReading={async (sensorId, value) => {
        try {
          await gardenActions.ingestSensorData(sensorId, value);
        } catch (err: any) {
          pushNotice(err?.message || "Unable to ingest sensor reading.", "error");
        }
      }}
    />
  );
}
