import { PestLogPanel } from "./PestLogPanel";

type PestsPageSectionProps = {
  pestLogActions: any;
  selectedDate: string;
};

export function PestsPageSection({
  pestLogActions,
  selectedDate,
}: PestsPageSectionProps) {
  return (
    <PestLogPanel
      pestLogs={pestLogActions.pestLogs}
      isLoading={pestLogActions.isLoadingPestLogs}
      onCreatePestLog={pestLogActions.createPestLog}
      onDeletePestLog={(id) => pestLogActions.deletePestLog(id).catch(() => undefined)}
      selectedDate={selectedDate}
    />
  );
}
