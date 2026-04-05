import { useCallback, useState } from "react";
import { FetchAuthed } from "../types";
import { AiCoachResponse, AiCoachScenario, CoachMessage, Garden } from "../../types";

interface UseCoachStateParams {
  fetchAuthed: FetchAuthed;
  selectedGardenRecord: Garden | undefined;
}

export function useCoachState({ fetchAuthed, selectedGardenRecord }: UseCoachStateParams) {
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const [coachDraftMessage, setCoachDraftMessage] = useState("");
  const [coachLatestResponse, setCoachLatestResponse] = useState<AiCoachResponse | null>(null);
  const [coachScenario, setCoachScenario] = useState<AiCoachScenario>({
    days_ahead: 7,
    rain_outlook: "normal",
    labor_hours: 2,
    water_budget: "normal",
  });
  const [isLoadingCoach, setIsLoadingCoach] = useState(false);

  const askCoach = useCallback(
    async (message: string, scenario: AiCoachScenario) => {
      if (!selectedGardenRecord || !message.trim()) return;
      const userMessage: CoachMessage = {
        id: Date.now(),
        role: "user",
        content: message.trim(),
      };
      setCoachMessages((current) => [...current, userMessage]);
      setCoachDraftMessage("");
      setIsLoadingCoach(true);
      try {
        const response: AiCoachResponse = await fetchAuthed("/ai/coach", {
          method: "POST",
          body: JSON.stringify({
            garden_id: selectedGardenRecord.id,
            message: message.trim(),
            scenario,
          }),
        });
        setCoachLatestResponse(response);
        setCoachMessages((current) => [
          ...current,
          { id: Date.now() + 1, role: "coach", content: response.reply },
        ]);
      } finally {
        setIsLoadingCoach(false);
      }
    },
    [fetchAuthed, selectedGardenRecord],
  );

  const resetCoach = useCallback(() => {
    setCoachMessages([]);
    setCoachLatestResponse(null);
    setCoachDraftMessage("");
  }, []);

  return {
    coachMessages,
    coachDraftMessage,
    setCoachDraftMessage,
    coachLatestResponse,
    coachScenario,
    setCoachScenario,
    isLoadingCoach,
    askCoach,
    resetCoach,
  };
}
