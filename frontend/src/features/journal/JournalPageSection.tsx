import { JournalPanel } from "./JournalPanel";
import { useJournalActions } from "../app/hooks/useJournalActions";

type JournalPageSectionProps = {
  journalActions: ReturnType<typeof useJournalActions>;
  selectedDate: string;
};

export function JournalPageSection({ journalActions, selectedDate }: JournalPageSectionProps) {
  return (
    <JournalPanel
      observations={journalActions.observations}
      isLoading={journalActions.isLoadingObservations}
      onCreateObservation={journalActions.createObservation}
      onDeleteObservation={(id) => journalActions.deleteObservation(id).catch(() => undefined)}
      selectedDate={selectedDate}
    />
  );
}
