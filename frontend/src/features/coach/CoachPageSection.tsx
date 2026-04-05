import { CoachPanel } from "./CoachPanel";
import { useCoachState } from "../app/hooks/useCoachState";

type CoachPageSectionProps = {
  selectedGardenName?: string;
  coachState: ReturnType<typeof useCoachState>;
  pushNotice: (message: string, kind: "info" | "success" | "error") => void;
};

export function CoachPageSection({
  selectedGardenName,
  coachState,
  pushNotice,
}: CoachPageSectionProps) {
  return (
    <CoachPanel
      selectedGardenName={selectedGardenName}
      messages={coachState.coachMessages}
      isLoading={coachState.isLoadingCoach}
      draftMessage={coachState.coachDraftMessage}
      onDraftMessageChange={coachState.setCoachDraftMessage}
      scenario={coachState.coachScenario}
      onScenarioChange={coachState.setCoachScenario}
      latestResponse={coachState.coachLatestResponse}
      onAskCoach={async (msg, scenario) => {
        try {
          await coachState.askCoach(msg, scenario);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Unable to get coach response.";
          pushNotice(message, "error");
        }
      }}
    />
  );
}
