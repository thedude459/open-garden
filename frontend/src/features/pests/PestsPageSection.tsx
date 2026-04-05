import { PestLogPanel } from "./PestLogPanel";
import { usePestLogActions } from "../app/hooks/usePestLogActions";

type PestsPageSectionProps = {
  pestLogActions: ReturnType<typeof usePestLogActions>;
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
