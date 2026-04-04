import { Garden } from "../types";
import { TimelinePanel } from "./TimelinePanel";

type TimelinePageSectionProps = {
  selectedGardenRecord: Garden | undefined;
  selectedGardenName?: string;
  timeline: any;
  isLoading: boolean;
  loadTimelineForGarden: (garden: Garden, forceRefresh?: boolean) => Promise<void>;
};

export function TimelinePageSection({
  selectedGardenRecord,
  selectedGardenName,
  timeline,
  isLoading,
  loadTimelineForGarden,
}: TimelinePageSectionProps) {
  return (
    <TimelinePanel
      selectedGardenName={selectedGardenName}
      timeline={timeline}
      isLoading={isLoading}
      onRefresh={() => {
        if (selectedGardenRecord) {
          loadTimelineForGarden(selectedGardenRecord, true).catch(() => undefined);
        }
      }}
    />
  );
}
